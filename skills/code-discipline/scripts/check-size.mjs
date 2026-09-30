#!/usr/bin/env node
// Enforce file-size and dependency budgets on a tree.
// Usage: node check-size.mjs <dir> [--max-lines 500] [--warn-lines 300] [--max-deps 40] [--json]
// Exit 0 = within budget, 1 = budget exceeded, 2 = bad input.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname, relative, resolve, sep } from "node:path"

const DEFAULTS = { maxLines: 500, warnLines: 300, maxDeps: 40, json: false }

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", "coverage",
  "vendor", "generated", "__generated__", "migrations", "__pycache__",
  ".venv", "venv", ".mypy_cache", ".pytest_cache",
])

const SOURCE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs",
  ".java", ".kt", ".swift", ".rb", ".php", ".cs", ".c", ".h", ".cpp", ".hpp",
])

// process.argv.slice(2): a plain find() also returns argv[0] (the node binary),
// which silently turns the target directory into the node executable.
const argv = process.argv.slice(2)

// Flags that are booleans: present means true, and they take no value.
const BOOL_FLAGS = new Set(["json"])

function flag(key, fallback) {
  const i = argv.indexOf(`--${key}`)
  if (i === -1) return fallback
  const raw = argv[i + 1]
  if (BOOL_FLAGS.has(key)) return raw === undefined || raw !== "false"
  if (raw === undefined) fail(`--${key} needs a value`)
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) fail(`--${key} must be a positive integer, got "${raw}"`)
  return n
}

function fail(message) {
  console.error(`check-size: ${message}`)
  process.exit(2)
}

const dir = resolve(argv.find((a) => !a.startsWith("--")) ?? ".")
const opts = {
  maxLines: flag("max-lines", DEFAULTS.maxLines),
  warnLines: flag("warn-lines", DEFAULTS.warnLines),
  maxDeps: flag("max-deps", DEFAULTS.maxDeps),
  json: flag("json", DEFAULTS.json),
}
if (opts.warnLines > opts.maxLines) {
  fail(`--warn-lines (${opts.warnLines}) cannot exceed --max-lines (${opts.maxLines})`)
}

const files = []
const skipped = new Set()

function walk(root) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch (e) {
    fail(`cannot read ${root}: ${e.message}`)
  }
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        skipped.add(entry.name)
        continue
      }
      walk(full)
    } else if (entry.isFile() && SOURCE_EXT.has(extname(entry.name))) {
      files.push(full)
    }
  }
}

function countLines(text) {
  if (text.length === 0) return 0
  const lines = text.split("\n")
  // A trailing newline produces an empty final element that is not a real line.
  if (lines[lines.length - 1] === "") lines.pop()
  return lines.length
}

function directDeps(root) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  } catch {
    return null
  }
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
  return { total: names.size, prod: Object.keys(pkg.dependencies ?? {}).length }
}

function main() {
  let info
  try {
    info = statSync(dir)
  } catch (e) {
    fail(`cannot stat ${dir}: ${e.message}`)
  }
  if (!info.isDirectory()) fail(`${dir} is not a directory`)

  walk(dir)

  const measured = files
    .map((f) => {
      let text
      try {
        text = readFileSync(f, "utf8")
      } catch {
        return null
      }
      return { file: relative(dir, f).split(sep).join("/"), lines: countLines(text) }
    })
    .filter(Boolean)

  const over = measured.filter((m) => m.lines > opts.maxLines)
  const warn = measured.filter((m) => m.lines > opts.warnLines && m.lines <= opts.maxLines)
  const deps = directDeps(dir)
  const depsOver = deps !== null && deps.total > opts.maxDeps

  warn.sort((a, b) => b.lines - a.lines)
  over.sort((a, b) => b.lines - a.lines)

  if (opts.json) {
    console.log(JSON.stringify({ root: dir, budget: opts, over, warn, deps, skipped: [...skipped] }, null, 2))
  } else {
    console.log(`check-size ${dir}`)
    console.log(`  ${measured.length} source file(s) measured, budget ${opts.warnLines}/${opts.maxLines} lines`)
    for (const m of over) console.log(`  OVER  ${String(m.lines).padStart(6)}  ${m.file}`)
    for (const m of warn) console.log(`  warn  ${String(m.lines).padStart(6)}  ${m.file}`)
    if (deps) console.log(`  dependencies: ${deps.total} direct (${deps.prod} prod), budget ${opts.maxDeps}`)
    if (skipped.size) console.log(`  skipped: ${[...skipped].join(", ")}`)
  }

  if (over.length === 0 && !depsOver) return
  const parts = []
  if (over.length) parts.push(`${over.length} file(s) over ${opts.maxLines} lines`)
  if (depsOver) parts.push(`${deps.total} direct dependencies over budget ${opts.maxDeps}`)
  console.error(`check-size: budget exceeded — ${parts.join("; ")}. Split the file or drop the dependency.`)
  process.exit(1)
}

main()
