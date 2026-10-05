---
name: provider-reconnect
description: Deciding whether a failed model request should be retried, and retrying so it does not cost a second execution. Classifies HTTP status and network error codes into retryable and permanent, sets backoff with jitter and an attempt budget, and covers the failures that cost money: a stream that died after bytes arrived, a timeout on a POST that may already have run, and resume via Idempotency-Key. Use when a request fails with ECONNRESET, ETIMEDOUT, EAI_AGAIN, socket hang up, fetch failed, 429, 500, 502, 503, 504, or 529; when an answer stops mid-stream; when the user says the connection dropped, it is rate limited, the request failed, or the network is unstable; or when wiring retry logic into an agent runtime.
---

# provider reconnect

Retry a failed model request without paying for it twice, and never retry a
failure that needs a human instead of time.

## When to use this

- A model request failed and you must decide: retry, stop, or change something
  other than the timing.
- An answer stopped part-way through a stream.
- You are adding retry logic to an HTTP client, an agent runtime, or a
  supervisor that outlives a single request.

Not for: replaying a user's own unfinished task across sessions (see
`long-task-continuity`), or supervising a long-lived child process (see
`assistant-runtime-architecture`).

## Rules

Ordered by how often they are wrong.

### 1. 429 is two different failures wearing one status code

Retrying a rate limit clears with time. Retrying an exhausted credit balance
never does — OpenAI's own error guide states plainly that retrying billing,
spend, or quota errors "won't restore API access".

Branch on `error.code`, not on the status:

| `error.code` on a 429 | Verdict |
| --- | --- |
| `rate_limit_error`, `slow_down`, `rpm_exceeded`, `tpm_exceeded` | retry, after `Retry-After` |
| `credit_balance_exhausted` | stop, add credit |
| `organization_spend_limit_exceeded`, `project_spend_limit_exceeded` | stop, raise the limit |
| `organization_usage_limit_exceeded` | stop, it clears at period reset |

A handler that retries every 429 burns its whole attempt budget and still
returns the same error. A handler that gives up on every 429 turns a
two-second rate limit into a user-visible failure.

Also check the `code` on your 5xx: a 503 with
`service_unavailable_error` / `server_is_overloaded` is a capacity problem
that clears. OpenAI has moved some overload responses from 429 to 503, so code
that treats throttling as "429 only" silently misses real overload.

### 2. `Retry-After` overrides your backoff schedule

When the header is present, wait at least that long and ignore your own
exponential schedule. Applying backoff *instead* of the header is the usual
cause of a retry that arrives while the server is still shedding load.

When it is absent, use exponential backoff with **full jitter**
(`random(0, min(cap, base * 2**attempt))`). A fixed schedule makes every client
retry in lockstep and reproduces the overload that caused the error. Cap at
30s. Stop at 3-5 attempts and surface the failure — an unbounded retry loop
converts a provider incident into an outage in your process.

### 3. A retry of a POST may be a second execution

A timeout tells you the server did not answer. It does not tell you the server
did not run. Retrying a completion that actually succeeded bills you twice and
can create a second side effect.

Send an `Idempotency-Key` header on every retryable non-streaming POST, and
reuse **the same key for every attempt of one logical request**. Generate the
key once, store it with the request, and pass it on each retry. A fresh UUID per
attempt throws away the protection you just built.

Two caveats to verify against the provider you actually use, because they are
not uniform across OpenAI-compatible gateways:

- Retained keys are typically held for a bounded window (commonly 24h). Beyond
  that window a replay is processed and billed as new work.
- Some gateways reject a streaming request that carries `Idempotency-Key`
  outright, because a stored replay cannot faithfully reproduce a stream that
  died mid-flight. Confirm before you assume the header is always accepted.

If you cannot establish idempotency for an operation, do not silently retry it.
Say that the request may have run.

### 4. A stream that died is not a result

If bytes arrived and then the connection dropped, the partial text is
incomplete: no finish reason, possibly truncated mid-token or mid-tool-call.
Do not persist it as the assistant's answer, and do not treat it as success.

Decide explicitly, and tell the user which happened:

- **Discard and restart** — safe when nothing was committed downstream.
- **Resume** — only where the provider exposes a resume handle. Most
  OpenAI-compatible streaming endpoints do not, so assume restart.
- **Fall back to non-streaming** — for short outputs, this makes retries
  idempotency-key-able, at the cost of no incremental delivery.

Restarting a stream duplicates the text already shown; that is usually better
than a truncated answer presented as complete, but say which you chose.

### 5. Do not retry a client fault

`400`, `401`, `403`, `404`, `405`, `413`, `415`, `422` are the request's
problem. Retrying an unchanged request gets the identical error and, for auth
failures, can look like a credential-stuffing pattern to the provider.

`ENOTFOUND` and `EAI_NONAME` are worth one retry, then a check of the base URL
and proxy — usually a typo or a DNS outage, not a blip. `EACCES` and
`ENOTSUPPORTED` are environment faults; stop.

### 6. Count the SDK's retries, not just yours

Official SDKs retry `429` and `5xx` themselves, by default more than once, and
may give up early when a server delay exceeds what they support. If you also
retry at the application layer the two budgets multiply: 3 SDK attempts inside
5 of yours is up to 15 requests against one logical call.

Pick one layer to own retries, and keep a request-id per attempt so support can
tell the attempts apart.

## Reference

`scripts/classify.mjs` applies rules 1, 2 and 5 as a decision, so the
classification is testable instead of remembered:

```
node scripts/classify.mjs 429 --code rate_limit_error --retry-after 4
node scripts/classify.mjs 429 --code credit_balance_exhausted
node scripts/classify.mjs 503 --code server_is_overloaded
node scripts/classify.mjs ECONNRESET
node scripts/classify.mjs 401
```

Exit `0` means retry, `1` means do not retry, `2` means unclassified — inspect
the raw error rather than guessing. Add `--attempt <n>` for a backoff
estimate, `--retry-after <s>` to test header handling, `--json` for machine
output.

For support escalation, log the `x-request-id` from the response and your own
`X-Client-Request-Id` (ASCII, 512 characters max) before each attempt. When a
timeout means you never saw the response header, the client request id is the
only handle that survives.

## Checklist

- [ ] Every 429 was branched on `error.code`, so a credit exhaustion was not
      retried as a rate limit.
- [ ] `Retry-After` is respected when present; backoff carries jitter.
- [ ] Every retried POST reuses one `Idempotency-Key`, or the code says
      explicitly that a retry may duplicate work.
- [ ] A partial stream was discarded or resumed, never stored as complete.
- [ ] Attempts are capped, and exhausted retries surface as a real failure.
- [ ] Retries live in one layer, not stacked on the SDK's own.