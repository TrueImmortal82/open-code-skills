#!/usr/bin/env node
// Run a command and report whether it matches an expectation. This exists so
// "does it reproduce?" is answered by the machine, not by reading exit codes
// by eye, which is how a two-byte silent failure gets mistaken for success.
//
// Usage: node repro-check.mjs [--expect-fail|--expect-ok] [--min-bytes N]
//                              [--require <text>] -- <cmd> [args...]
// Exit 0 = expectation met, 1 = expectation violated, 2 = bad invocation.

import { spawnSync } from "node:child_process"

const argv = process.argv.slice(2)
const sep = argv.indexOf("--")

if (sep === -1 || sep === argv.length - 1) {
  console.error("usage: node repro-check.mjs [flags] -- <cmd> [args...]")
  process.exit(2)
}

const flags = argv.slice(0, sep)
const command = argv.slice(sep + 1)
// Keys are given bare, without the leading dashes.
const has = (key) => flags.includes(`--${key}`)
const value = (key, fallback) => {
  const i = flags.indexOf(`--${key}`)
  return i === -1 || i === flags.length - 1 ? fallback : flags[i + 1]
}

const expectFail = has("expect-fail")
const expectOk = has("expect-ok")
if (expectFail === expectOk) {
  console.error("repro-check: pass exactly one of --expect-fail or --expect-ok")
  process.exit(2)
}

const minBytes = Number(value("min-bytes", "0"))
const requireText = value("require")

// A process that exits 0 having printed nothing is the failure mode this script
// exists to catch, so output volume is checked even on the success path.
function judge(status, stdout) {
  const problems = []
  if (expectFail ? status === 0 : status !== 0) {
    problems.push(`exit code ${status} (wanted ${expectFail ? "nonzero" : "0"})`)
  }
  if (stdout.length < minBytes) problems.push(`stdout was ${stdout.length} bytes, wanted >= ${minBytes}`)
  if (requireText && !stdout.includes(requireText)) problems.push(`stdout did not contain ${JSON.stringify(requireText)}`)
  return problems
}

// Prefer a direct spawn: only a shell can find a .cmd shim, but a shell also
// hides a missing binary behind a localized "not recognized" message and a
// plain exit 1. Direct spawn reports ENOENT honestly, so a typo in the command
// is caught as a broken check instead of being read as a verdict on the bug.
function run() {
  const options = {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: Number(value("timeout", "120")) * 1000,
  }
  const direct = spawnSync(command[0], command.slice(1), options)
  if (!direct.error) return direct
  if (direct.error.code === "EINVAL") return spawnSync(command.join(" "), [], { ...options, shell: true })
  return direct
}

function main() {
  const res = run()

  const stdout = res.stdout ?? ""
  const stderr = (res.stderr ?? "").trim()
  const problems = judge(res.status, stdout)

  console.log(`cmd:    ${command.join(" ")}`)
  console.log(`exit:   ${res.status}`)
  console.log(`stdout: ${stdout.length} bytes`)
  if (stderr) console.log(`stderr: ${stderr.slice(0, 400)}`)

  if (res.error) {
    console.log(`\nrepro-check: could not run \`${command[0]}\` (${res.error.code ?? res.error.message}).`)
    console.log("  Fix the command before drawing any conclusion about the bug.")
    process.exit(2)
  }

  if (problems.length) {
    console.log(`\nNOT as expected: ${problems.join("; ")}`)
    if (expectFail) {
      console.log("The bug did not reproduce. Do not start fixing: find the input that triggers it,")
      console.log("or the bug is not the bug you think it is.")
    } else {
      console.log("The check is not proving anything yet. Make it fail before trusting it.")
    }
    process.exit(1)
  }

  console.log(`\nas expected (${expectFail ? "reproduced" : "fixed"})`)
  process.exit(0)
}

main()
