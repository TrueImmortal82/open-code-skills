#!/usr/bin/env node
// Classify a failed provider request into a retry decision.
// Usage: node classify.mjs <http-status|error> [--code <error.code>] [--retry-after <seconds>] [--attempt <n>]
//   node classify.mjs 429 --code rate_limit_error --retry-after 4 --attempt 2
//   node classify.mjs ECONNRESET
//   node classify.mjs --json
// Exit codes: 0 retry advised, 1 do not retry (permanent), 2 could not classify.

const argv = process.argv.slice(2)

function flag(key, fallback = null) {
  const i = argv.indexOf(`--${key}`)
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

// Number(null) is 0 and Number("") is 0, so an absent flag must be rejected
// before numeric coercion or it reads as a zero-second Retry-After.
function numberFlag(key) {
  const raw = flag(key)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

if (argv.includes("--help")) {
  console.log(
    "usage: node classify.mjs <http-status|error> [--code <c>] [--retry-after <s>] [--attempt <n>] [--json]",
  )
  process.exit(0)
}

const subject = argv.find((a) => !a.startsWith("--"))
if (!subject) {
  console.error("usage: node classify.mjs <http-status|error> [--code <c>] [--retry-after <s>] [--attempt <n>] [--json]")
  process.exit(2)
}

// Billing and quota codes arrive as 429 but no retry can clear them. Retrying
// them just burns the attempt budget against a condition that needs a human.
const NON_RETRYABLE_429 = new Set([
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
])

const RETRYABLE_STATUS = new Map([
  [408, "request timeout"],
  [409, "conflict"],
  [425, "too early"],
  [429, "rate limited"],
  [500, "internal server error"],
  [502, "bad gateway"],
  [503, "service unavailable"],
  [504, "gateway timeout"],
  [529, "overloaded"],
])

const RETRYABLE_NETWORK = new Map([
  ["ECONNRESET", "connection reset by peer"],
  ["ECONNREFUSED", "connection refused"],
  ["ETIMEDOUT", "socket timeout"],
  ["EPIPE", "broken pipe"],
  ["EHOSTUNREACH", "host unreachable"],
  ["ENETUNREACH", "network unreachable"],
  ["EAI_AGAIN", "temporary DNS failure"],
  ["ENOTFOUND", "DNS not found"],
  ["ECONNABORTED", "request aborted"],
  ["UND_ERR_CONNECT_TIMEOUT", "undici connect timeout"],
  ["UND_ERR_SOCKET", "undici socket failure"],
  ["UND_ERR_HEADERS_TIMEOUT", "undici headers timeout"],
])

const PERMANENT_NETWORK = new Map([
  ["ENOTSUPPORTED", "operation not supported"],
  ["EACCES", "permission denied"],
  ["EAI_NONAME", "permanent DNS failure"],
])

const PERMANENT_STATUS = new Map([
  [400, "malformed request"],
  [401, "authentication failed"],
  [403, "forbidden"],
  [404, "not found"],
  [405, "method not allowed"],
  [413, "payload too large"],
  [415, "unsupported media type"],
  [422, "unprocessable entity"],
])

function backoffMs(attempt) {
  const base = 500
  const capped = Math.min(base * 2 ** attempt, 30000)
  // Full jitter: a fixed schedule makes every client retry in lockstep and
  // reproduces the overload that caused the 503.
  return Math.round(capped * (0.5 + Math.random() * 0.5))
}

function decide() {
  const code = flag("code")
  const retryAfter = numberFlag("retry-after")
  const attempt = numberFlag("attempt") ?? 0
  const label = subject.toUpperCase()

  if (label === "429" && code && NON_RETRYABLE_429.has(code)) {
    return {
      verdict: "do-not-retry",
      reason: `429 ${code} is a billing or quota limit; no retry clears it`,
      action: "raise the limit or add credit, then retry manually",
    }
  }

  if (label === "429") {
    return {
      verdict: "retry",
      reason: "429 rate limit clears with time",
      action: `respect Retry-After (${Number.isFinite(retryAfter) ? `${retryAfter}s` : "absent; use backoff"})`,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
    }
  }

  const net = RETRYABLE_NETWORK.get(label)
  if (net) {
    return {
      verdict: "retry",
      reason: `${net} is transient`,
      action: "retry with the same Idempotency-Key so a completed request is not billed twice",
    }
  }

  const bad = PERMANENT_NETWORK.get(label)
  if (bad) return { verdict: "do-not-retry", reason: bad, action: "fix the environment" }

  const status = Number(subject)
  if (Number.isInteger(status)) {
    const reason = RETRYABLE_STATUS.get(status)
    if (reason) {
      return {
        verdict: "retry",
        reason: `${status} ${reason} is transient`,
        action:
          status === 503 || status === 529 || status === 429
            ? "honor Retry-After when present, then back off with jitter"
            : "back off with jitter and retry",
      }
    }
    const permanent = PERMANENT_STATUS.get(status)
    if (permanent) return { verdict: "do-not-retry", reason: `${status} ${permanent}`, action: "fix the request" }
    if (status >= 500) return { verdict: "retry", reason: `${status} is a server fault`, action: "back off with jitter" }
    if (status >= 400 && status < 500) {
      return { verdict: "do-not-retry", reason: `${status} is a client fault`, action: "fix the request" }
    }
  }

  return { verdict: "unknown", reason: `unclassified: ${subject}`, action: "inspect the raw error before retrying" }
}

const result = decide()
const retryAfter = numberFlag("retry-after")
const jittered = result.verdict === "retry" ? backoffMs(numberFlag("attempt") ?? 0) : null
// Retry-After is authoritative: never suggest sleeping less than the server asked.
const suggested =
  jittered === null ? null : Number.isFinite(retryAfter) ? Math.max(retryAfter * 1000, 0) : jittered
const authoritative = jittered !== null && Number.isFinite(retryAfter)

if (argv.includes("--json")) {
  console.log(JSON.stringify({ subject, ...result, suggestedBackoffMs: suggested }, null, 2))
} else {
  console.log(`${result.verdict.toUpperCase()}  ${subject}${flag("code") ? ` (${flag("code")})` : ""}`)
  console.log(`  why:    ${result.reason}`)
  console.log(`  action: ${result.action}`)
  if (suggested !== null) {
    console.log(
      authoritative
        ? `  wait:   ${suggested}ms (Retry-After, authoritative; ignore backoff)`
        : `  backoff: ~${suggested}ms (jittered, cap 30s)`,
    )
  }
}

process.exit(result.verdict === "retry" ? 0 : result.verdict === "do-not-retry" ? 1 : 2)