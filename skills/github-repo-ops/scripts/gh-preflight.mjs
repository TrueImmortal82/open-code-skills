#!/usr/bin/env node
// Report what `gh` can and cannot do for a repository right now, before an
// operation depends on one of those answers. The frequent failure is a token
// with `repo` but not `workflow`, or an unprotected branch that silently
// accepts a force-push.
//
// Usage: node gh-preflight.mjs [repo] [--json] [--remote <name>]
//   [repo]  "owner/name", or omitted to read it from the git remote
// Exit 0 = ready, 1 = something needed is missing, 2 = gh unusable here.

import { spawnSync } from "node:child_process"

const argv = process.argv.slice(2)
const asJson = argv.includes("--json")
const flag = (key) => {
  const i = argv.indexOf(`--${key}`)
  return i === -1 ? undefined : argv[i + 1]
}
const repoArg = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")))

function die(message, code) {
  console.error(`gh-preflight: ${message}`)
  process.exit(code)
}

function gh(...args) {
  const res = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  return { code: res.status, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim(), error: res.error }
}

function ghJson(...args) {
  const res = gh(...args)
  if (res.error) die("the gh CLI is not on PATH", 2)
  if (res.code !== 0) return { ok: false, error: res.err || res.out || `exit ${res.code}` }
  try {
    return { ok: true, data: JSON.parse(res.out) }
  } catch {
    return { ok: false, error: `could not parse gh output: ${res.out.slice(0, 200)}` }
  }
}

function readRemote(cwd, remote) {
  const res = spawnSync("git", ["-C", cwd, "remote", "get-url", remote], { encoding: "utf8" })
  if (res.error || res.status !== 0) return null
  const url = (res.stdout ?? "").trim()
  const match = url.match(/github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/)
  return match ? `${match[1]}/${match[2]}` : null
}

function scopesOf(statusText) {
  const line = statusText.split(/\r?\n/).find((l) => l.includes("Token scopes"))
  if (!line) return []
  return line
    .replace(/.*Token scopes:\s*/, "")
    .replace(/[‘’]/g, "'")
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean)
}

// What each operation needs. A missing scope is the usual cause of a 403 that
// reads like a repository permissions problem instead.
//
// `need` is a list of alternatives, not a conjunction: the `repo` scope already
// covers issues, pull requests and releases, so a separate `issues` scope is
// never additionally required. `public_repo` is the read-only public-repo
// equivalent of `repo`.
const NEEDS = {
  "push code": [["repo", "public_repo"]],
  "create a pull request": [["repo", "public_repo"]],
  "create or edit an issue": [["repo", "public_repo"], ["issues"]],
  "upload a release asset": [["repo", "public_repo"]],
  "run or trigger a workflow": [["repo", "public_repo"], ["workflow"]],
  "manage branch protection": [["repo", "admin:repo_hook"]],
  "read organisation secrets": [["read:org"]],
}

function capability(need, scopes) {
  return need.some((group) => group.some((scope) => scopes.includes(scope)))
}

function main() {
  const remote = flag("remote") ?? "origin"
  const repo = repoArg ?? readRemote(process.cwd(), remote)
  if (!repo) die(`no repository given and no GitHub remote found for "${remote}"; pass owner/name or --remote <name>`, 2)

  const auth = gh("auth", "status")
  if (auth.error) die("the gh CLI is not on PATH", 2)
  const authed = auth.code === 0
  const scopes = authed ? scopesOf(auth.out) : []
  const account = authed ? (auth.out.match(/account (\S+)/)?.[1] ?? null) : null

  const view = authed ? ghJson("repo", "view", repo, "--json", "nameWithOwner,visibility,defaultBranchRef,url,description,isArchived") : { ok: false, error: "not authenticated" }
  const data = view.ok ? view.data : null
  const defaultBranch = data?.defaultBranchRef?.name ?? null

  let protection = { ok: false, error: "unknown" }
  if (authed && defaultBranch) {
    protection = ghJson("api", `repos/${repo}/branches/${defaultBranch}/protection`)
  }

  // An unreadable repository is a hard blocker, not a footnote: every check
  // below it would otherwise report on a repo that may not exist at all.
  const missing = []
  if (!authed) missing.push("gh is not authenticated — run `gh auth login`")
  if (authed && !view.ok) missing.push(`repository not reachable: ${view.error.slice(0, 160)}`)
  if (data?.isArchived) missing.push("repository is archived; pushes will be rejected")
  if (defaultBranch && !protection.ok) {
    const unprotected = /not protected/i.test(protection.error)
    missing.push(
      unprotected
        ? `${defaultBranch} is not protected: force-push and direct push are not blocked`
        : `could not read branch protection: ${protection.error.slice(0, 120)}`,
    )
  }

  const capabilities = Object.entries(NEEDS).map(([what, need]) => ({
    what,
    need,
    ok: capability(need, scopes),
  }))

  const report = {
    repo,
    authenticated: authed,
    account,
    scopes,
    reachable: view.ok,
    visibility: data?.visibility ?? null,
    defaultBranch,
    branchProtected: protection.ok,
    protectionError: protection.ok ? null : protection.error,
    url: data?.url ?? null,
    capabilities,
    missing,
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(missing.length ? 1 : 0)
  }

  console.log(`repo:     ${repo}${report.url ? `  (${report.url})` : ""}`)
  console.log(`account:  ${authed ? account : "NOT AUTHENTICATED — run `gh auth login`"}`)
  console.log(`scopes:   ${scopes.length ? scopes.join(", ") : "none reported"}`)
  console.log(`visible:  ${report.visibility ?? (view.ok ? "unknown" : view.error.slice(0, 120))}`)
  console.log(`branch:   ${defaultBranch ?? "unknown"}${defaultBranch ? (protection.ok ? "  (protected)" : "  (NOT protected)") : ""}`)

  console.log("\ncapabilities:")
  for (const c of capabilities) {
    const need = c.need.length ? `one of: ${c.need.map((g) => g.join("|")).join(" or ")}` : "no extra scope"
    console.log(`  [${c.ok ? "ok  " : "NO  "}] ${c.what.padEnd(28)} ${need}`)
  }

  if (missing.length) {
    console.log("\nbefore you rely on this repo:")
    for (const m of missing) console.log(`  - ${m}`)
  } else {
    console.log("\nready.")
  }

  process.exit(missing.length ? 1 : 0)
}

main()
