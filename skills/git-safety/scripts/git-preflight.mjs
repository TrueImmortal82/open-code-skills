#!/usr/bin/env node
// Report what git would lose, before it loses it. Every destructive git command
// has a recoverable and an unrecoverable form; this reports which one applies to
// the working tree as it is right now.
//
// Usage: node git-preflight.mjs [dir] [--json] [--quiet]
// Exit 0 = nothing at risk, 1 = work would be lost, 2 = not a usable repo.
// A command marked `?` does not affect the exit code: "undetermined" is not the
// same as "at risk", and a preflight that cries wolf gets ignored.

import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const argv = process.argv.slice(2)
const dir = resolve(argv.find((a) => !a.startsWith("--")) ?? process.cwd())
const asJson = argv.includes("--json")
const quiet = argv.includes("--quiet")

function die(message, code) {
  console.error(`git-preflight: ${message}`)
  process.exit(code)
}

function git(...args) {
  const res = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  if (res.error) die("git is not available on PATH", 2)
  return { ok: res.status === 0, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim() }
}

function lines(text) {
  return text ? text.split(/\r?\n/).filter(Boolean) : []
}

function collect() {
  const inside = git("rev-parse", "--is-inside-work-tree")
  if (!inside.ok || inside.out !== "true") die(`not a git working tree: ${dir}`, 2)

  const head = git("rev-parse", "--short", "HEAD")
  const branch = git("rev-parse", "--abbrev-ref", "HEAD")
  const detached = branch.out === "HEAD"

  const status = lines(git("status", "--porcelain=v1", "--untracked-files=all").out)
  const staged = status.filter((l) => l[0] !== " " && l[0] !== "?")
  const unstaged = status.filter((l) => l[1] !== " " && l[0] !== "?")
  const untracked = status.filter((l) => l.startsWith("??"))
  const conflicted = status.filter((l) => l[0] === "U" || l.slice(1, 2) === "U")

  // `--dry-run` keeps this side-effect free: it reports without deleting.
  // `git clean` rejects --untracked-files, so list directories separately and
  // rely on `status` for the flat file list.
  const cleanDry = lines(git("clean", "-nd").out)
  const ignored = lines(git("clean", "-ndX").out)

  // Unpushed commits are the ones a `reset --hard` or `clean` cannot bring back
  // once they are no longer referenced by any ref.
  const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
  const hasUpstream = upstream.ok && upstream.out.length > 0
  const unpushed = hasUpstream ? lines(git("log", "--oneline", "@{u}..HEAD").out) : []
  const diverged = hasUpstream ? lines(git("log", "--oneline", "HEAD..@{u}").out) : []

  const stashes = lines(git("stash", "list").out)
  const reflog = git("reflog", "--oneline", "-n", "5")

  return {
    dir,
    head: head.out || "(no commits)",
    branch: detached ? "(detached)" : branch.out,
    hasUpstream,
    upstream: hasUpstream ? upstream.out : null,
    staged,
    unstaged,
    untracked,
    conflicted,
    cleanDry,
    ignored,
    unpushed,
    diverged,
    stashes,
    reflog: lines(reflog.out),
  }
}

// What a single command would destroy, which is the part people get wrong.
// Each entry is a predicate over the collected state, evaluated at print time.
const RISKS = [
  {
    what: "git reset --hard",
    loses: "every staged and unstaged edit in the tree",
    safe: (r) => r.unstaged.length === 0 && r.staged.length === 0,
  },
  {
    what: "git checkout . / git restore .",
    loses: "every unstaged edit (staged work survives)",
    safe: (r) => r.unstaged.length === 0,
  },
  {
    what: "git clean -fd",
    loses: "every untracked file and directory",
    safe: (r) => r.cleanDry.length === 0,
  },
  {
    what: "git branch -D <name>",
    loses: "commits reachable only from that branch",
    // Undetermined, not safe: whether a delete loses work depends on the named
    // branch and on other remotes, neither of which the tree state describes.
    // Reporting ok here would be a claim the script cannot support.
    safe: () => null,
    note: "cannot be judged from the tree alone; check that branch specifically",
  },
  {
    what: "git push --force",
    loses: "remote commits made by someone else",
    safe: (r) => r.diverged.length === 0,
  },
  {
    what: "git reflog expire / gc (or cloning afresh)",
    loses: "unpushed commits, once nothing references them",
    safe: (r) => r.unpushed.length === 0,
  },
  {
    what: "git stash",
    loses: "nothing; the work is parked in the stash",
    safe: () => true,
  },
]

function verdict(r) {
  return RISKS.map(({ what, loses, safe, note }) => ({ what, loses, safe: safe(r), note: note ?? null }))
}

function main() {
  const r = collect()
  const risks = verdict(r)

  if (asJson) {
    console.log(JSON.stringify({ ...r, risks }, null, 2))
    process.exit(risks.some((x) => x.safe === false) ? 1 : 0)
  }

  const line = (label, items) => console.log(`  ${items.length ? `${label}: ${items.length}` : `${label}: none`}`)
  console.log(`repo:  ${r.dir}`)
  console.log(`head:  ${r.head} on ${r.branch}${r.upstream ? ` (tracking ${r.upstream})` : " (no upstream)"}`)
  console.log("working tree:")
  line("staged", r.staged)
  line("unstaged", r.unstaged)
  line("untracked", r.untracked)
  line("conflicted", r.conflicted)
  line("git clean -fd would remove", r.cleanDry)
  line("ignored (also removable by -x)", r.ignored)
  line("unpushed commits", r.unpushed)
  line("remote-only commits", r.diverged)
  line("stashes", r.stashes)

  const atRisk = risks.filter((x) => x.safe === false)
  const unknown = risks.filter((x) => x.safe === null)
  console.log("\nif you run these now:")
  for (const x of risks) {
    const mark = x.safe === null ? "?   " : x.safe ? "ok  " : "LOST"
    console.log(`  [${mark}] ${x.what.padEnd(30)} ${x.loses}${x.note ? `  (${x.note})` : ""}`)
  }

  if (!quiet && r.untracked.length) {
    console.log(`\nuntracked files git clean -fd would delete:`)
    for (const f of r.untracked.slice(0, 20)) console.log(`  ${f.slice(3)}`)
    if (r.untracked.length > 20) console.log(`  ... and ${r.untracked.length - 20} more`)
  }

  if (atRisk.length) {
    console.log(`\n${atRisk.length} operation(s) would lose work right now.`)
    process.exit(1)
  }
  if (unknown.length) {
    const plural = unknown.length === 1 ? "needs" : "need"
    console.log(`\nnothing at risk that this script can see, but ${unknown.length} ${plural} a closer look.`)
    process.exit(0)
  }
  console.log("\nnothing at risk.")
}

main()
