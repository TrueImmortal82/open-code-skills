#!/usr/bin/env node
// Drive a bisection: ask a yes/no question that splits the candidates, and let
// the script do the bookkeeping. Debugging by intuition skips the half of the
// space that was wrong, which is the half worth knowing about.
//
// Usage: node bisect-check.mjs --candidates <a,b,c> --probe <cmd> [--json]
//   The probe command is run once per candidate and must exit 0 for "good"
//   and nonzero for "bad". Candidates may be versions, commits, files, env
//   values, or any token you substitute via BISECT_CANDIDATE.
// Exit 0 = narrowed to one candidate, 1 = probe disagreed with itself,
//         2 = bad usage or probe failure.

import { spawnSync } from "node:child_process"
import { extname } from "node:path"

const argv = process.argv.slice(2)
const flag = (key) => {
  const i = argv.indexOf(`--${key}`)
  return i === -1 || i === argv.length - 1 ? undefined : argv[i + 1]
}
const asJson = argv.includes("--json")

function die(message, code) {
  console.error(`bisect-check: ${message}`)
  process.exit(code)
}

const candidateList = flag("candidates")
const probe = flag("probe")
if (!candidateList || !probe) {
  die("usage: bisect-check.mjs --candidates <a,b,c> --probe <cmd> [--json]", 2)
}

const candidates = candidateList.split(",").map((s) => s.trim()).filter(Boolean)
if (candidates.length < 2) die("need at least two candidates to bisect", 2)

// How the probe is launched depends on what kind of file it is. On Windows a
// `.ps1` is the trap: `shell: true` hands it to cmd.exe, which cannot run it and
// reports exit 0 for every candidate, so a bisection over a PowerShell probe
// would "prove" the extremes agree and stop. A direct spawn fails too, with
// EFTYPE. Only `powershell -File` propagates the real exit code.
function resolveProbe() {
  const ext = extname(probe).toLowerCase()
  if (process.platform === "win32" && (ext === ".ps1" || ext === ".psm1")) {
    return { cmd: "powershell.exe", args: (candidate) => ["-NoProfile", "-File", probe, candidate], shell: false }
  }
  if (ext === ".ps1" || ext === ".psm1") {
    return { cmd: "pwsh", args: (candidate) => ["-NoProfile", "-File", probe, candidate], shell: false }
  }
  return { cmd: probe, args: (candidate) => [candidate], shell: process.platform === "win32" }
}

// The probe sees the candidate in the environment and in argv, so the same
// command works for a version, a commit sha, a filename, or a config value.
function evaluate(candidate) {
  const runner = resolveProbe()
  const res = spawnSync(runner.cmd, runner.args(candidate), {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env, BISECT_CANDIDATE: candidate },
    shell: runner.shell,
  })
  if (res.error) die(`probe failed to start: ${res.error.message}`, 2)
  if (res.status === null) return { good: false, exit: null, note: "probe timed out" }
  return { good: res.status === 0, exit: res.status }
}

// A bisection is only valid if the property is monotonic across the candidates.
// Running the extremes first proves the ordering, and a disagreement here means
// the candidate list is not a sequence, so any narrowing from it would be noise.
function main() {
  const results = new Map()

  const first = candidates[0]
  const last = candidates[candidates.length - 1]
  const a = evaluate(first)
  const b = evaluate(last)
  if (a.good === b.good) {
    if (asJson) {
      console.log(JSON.stringify({ candidates, error: "extremes agree", first, last, firstGood: a.good }, null, 2))
    } else {
      console.log(`first candidate (${first}) and last (${last}) both ${a.good ? "pass" : "fail"}.`)
      console.log("The property is not ordered along this list, so narrowing by it would be meaningless.")
      console.log("Reorder the candidates, or choose a different probe.")
    }
    process.exit(1)
  }

  // good at one end, bad at the other: keep the interval, halve it each round.
  const ordered = a.good ? candidates : [...candidates].reverse()
  let low = 0
  let high = ordered.length - 1
  const trace = [{ candidate: ordered[low], good: true }, { candidate: ordered[high], good: false }]

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    const r = evaluate(ordered[mid])
    trace.push({ candidate: ordered[mid], good: r.good })
    if (r.good) low = mid
    else high = mid
  }

  // The boundary sits between the last good and the first bad.
  const culprit = ordered[high]
  const steps = Math.ceil(Math.log2(ordered.length))

  if (asJson) {
    console.log(JSON.stringify({ candidates: ordered, culprit, boundary: { lastGood: ordered[low], firstBad: culprit }, steps, trace }, null, 2))
    process.exit(0)
  }

  console.log(`candidates: ${ordered.length}  steps: ${steps}  (linear would be ${ordered.length})\n`)
  for (const t of trace) console.log(`  ${t.good ? "pass" : "FAIL"}  ${t.candidate}`)
  console.log(`\nlast good: ${ordered[low]}`)
  console.log(`first bad: ${culprit}`)
  console.log(`\nstart with the difference between those two, not with a fix.`)
  process.exit(0)
}

main()
