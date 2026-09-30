#!/usr/bin/env node
// Inspect `opencode debug skill` output as data instead of as text.
// Usage: node inspect-skill.mjs [<name>] [--content] [--source <substr>]
//                                 [--json] [--cmd <path>]
// Exit 0 = ok, 1 = no match, 2 = could not read opencode.

import { spawnSync, execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

const argv = process.argv.slice(2)

const flag = (key) => {
  const i = argv.indexOf(`--${key}`)
  return i === -1 ? undefined : argv[i + 1]
}
const has = (key) => argv.includes(`--${key}`)
// A bare argument is the skill name; a value following a --flag belongs to it.
const target = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")))

function die(message, code) {
  console.error(`inspect-skill: ${message}`)
  process.exit(code)
}

// On Windows the PATH entry is opencode.cmd, and spawning that shim from node
// returns exit 0 with two bytes of output instead of the JSON. Node cannot exec
// a .cmd directly either (EINVAL), so resolve the packaged executable the shim
// points at. Everywhere else plain `opencode` works.
function resolveCommand() {
  const override = flag("cmd") ?? process.env.OPENCODE_BIN
  if (override) return { cmd: override, shell: process.platform === "win32" }
  if (process.platform !== "win32") return { cmd: "opencode", shell: false }

  try {
    // `where` can list the desktop GUI build first and the CLI second. The GUI
    // binary is a windowed app that writes nothing to stdout, so pick the match
    // that actually has the opencode-ai package beside it, not the first one.
    const matches = execFileSync("where.exe", ["opencode"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const match of matches) {
      const exe = join(dirname(match), "node_modules", "opencode-ai", "bin", "opencode.exe")
      if (existsSync(exe)) return { cmd: exe, shell: false }
    }
  } catch {
    // where.exe missing or opencode not on PATH; fall back to the shim.
  }
  return { cmd: "opencode", shell: true }
}

// stdout can be preceded by progress noise depending on how opencode is
// invoked, so fall back to slicing from the first structural character.
function parseJson(text) {
  const trimmed = text.trim()
  const attempts = [trimmed]
  for (const [open, close] of [["[", "]"], ["{", "}"]]) {
    const start = trimmed.indexOf(open)
    const end = trimmed.lastIndexOf(close)
    if (start !== -1 && end > start) attempts.push(trimmed.slice(start, end + 1))
  }
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt)
    } catch {
      /* try the next shape */
    }
  }
  return null
}

function runOpencode() {
  const { cmd, shell } = resolveCommand()
  const res = spawnSync(cmd, ["debug", "skill"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: 180_000,
    shell,
  })
  if (res.error) die(`${cmd} failed to start: ${res.error.message}`, 2)
  if (res.status !== 0) die(`${cmd} exited ${res.status}: ${(res.stderr || "").slice(0, 400)}`, 2)

  const parsed = parseJson(res.stdout || "")
  if (parsed === null) {
    die(
      `no JSON from \`${cmd} debug skill\` (got ${(res.stdout || "").length} bytes).\n` +
        "  A windowed GUI binary writes nothing to stdout; set OPENCODE_BIN to the\n" +
        "  packaged opencode-ai CLI executable.",
      2,
    )
  }
  return parsed
}

// `debug skill` emits one entry per name: a second file claiming a name that is
// already taken is silently dropped, so shadowing cannot be detected from this
// output. Always report the location that actually won.
function toRows(data) {
  const list = Array.isArray(data) ? data : (data?.skills ?? [])
  if (!Array.isArray(list)) die("unexpected shape: expected an array of skills", 2)
  return list
    .filter((s) => s && typeof s.name === "string")
    .map((s) => ({ name: s.name, location: s.location ?? "", description: s.description ?? "", content: s.content ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function main() {
  const rows = toRows(runOpencode())
  const sourceFilter = flag("source")
  let selected = rows

  if (target) selected = selected.filter((r) => r.name === target)
  if (sourceFilter) selected = selected.filter((r) => r.location.includes(sourceFilter))

  if (has("json")) {
    console.log(JSON.stringify(selected, null, 2))
    process.exit(selected.length ? 0 : 1)
  }

  if (!selected.length) {
    console.log(target ? `no skill named "${target}"` : "no skills matched")
    process.exit(1)
  }

  for (const row of selected) {
    console.log(`${row.name}\n  location: ${row.location || "(none)"}`)
    if (row.description) console.log(`  about: ${row.description.slice(0, 160)}`)
  }
  console.log(`\n${selected.length} of ${rows.length} skill(s)`)

  if (has("content")) {
    for (const row of selected) console.log(`\n--- ${row.name} ---\n${row.content}`)
  }
}

main()
