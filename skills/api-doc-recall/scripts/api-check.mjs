#!/usr/bin/env node
// Read the actual source of an installed package instead of trusting memory of
// its API. A version bump moves a signature; a blog post is not a changelog.
//
// Usage: node api-check.mjs <package> [members...]
//        node api-check.mjs <package> --grep <pattern> [--limit N]
//   package   package name or a path to a directory
//   members   export names to locate; with none, lists the package's exports
// Exit 0 = every member found, 1 = a member was not found, 2 = package unreadable.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

const argv = process.argv.slice(2)
const packageArg = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")))
const flag = (key, fallback) => {
  const i = argv.indexOf(`--${key}`)
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1]
}
const members = argv.filter((a, i) => !a.startsWith("--") && i > 0 && argv[i - 1] !== "--grep")
const grep = flag("grep")
const limit = Number(flag("limit", "20"))

function die(message, code) {
  console.error(`api-check: ${message}`)
  process.exit(code)
}

const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", "vendor", "test", "tests", "__tests__"])
const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"])

// Breadth-first, bounded, and skipping generated output: the declaration the
// reader wants is in the source, and `dist` usually contains ten copies of it.
function walk(root, cap = 4000) {
  const found = []
  const queue = [root]
  while (queue.length && found.length < cap) {
    const dir = queue.shift()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && !entry.name.startsWith(".")) queue.push(full)
      } else if (SOURCE_EXT.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        found.push(full)
      }
    }
  }
  return found
}

function locatePackage(name) {
  // A path is taken as given; a bare name is resolved from this file's own
  // node_modules chain, which is the install the caller is actually using.
  if (existsSync(name) && statSync(name).isDirectory()) return resolve(name)
  try {
    return dirname(createRequire(import.meta.url).resolve(`${name}/package.json`))
  } catch {
    try {
      return dirname(createRequire(process.cwd() + "/x.js").resolve(`${name}/package.json`))
    } catch {
      return null
    }
  }
}

function readPackageJson(dir) {
  const file = join(dir, "package.json")
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

// `export const foo`, `export function foo`, `export class foo`, and the
// re-export forms. Declaration lines are short and this keeps the excerpt
// readable; a multi-line type is followed separately when it matters.
const patterns = (member) => [
  new RegExp(`^\\s*export\\s+(?:declare\\s+)?(?:async\\s+)?(?:function|class|const|let|var|interface|type|enum|abstract class)\\s+${member}\\b`, "m"),
  new RegExp(`^\\s*export\\s*\\{[^}]*\\b${member}\\b[^}]*\\}`, "m"),
  new RegExp(`^\\s*export\\s+default\\s+(?:async\\s+)?function\\s+${member}\\b`, "m"),
]

// Matches when any one of the patterns matches the line.
function search(files, regexes) {
  const hits = []
  for (const file of files) {
    let text
    try {
      text = readFileSync(file, "utf8")
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (const [i, line] of lines.entries()) {
      if (regexes.some((re) => re.test(line))) {
        hits.push({ file, line: i + 1, text: line.trim().slice(0, 160) })
        if (hits.length >= limit) return hits
      }
    }
  }
  return hits
}

function main() {
  if (!packageArg) die("usage: api-check.mjs <package> [members...] [--grep <pattern>]", 2)
  const dir = locatePackage(packageArg)
  if (!dir) die(`cannot locate package "${packageArg}" from this directory`, 2)

  const pkg = readPackageJson(dir)
  const files = walk(dir)
  if (!files.length) die(`no source files under ${dir}`, 2)

  console.log(`package: ${pkg?.name ?? packageArg}${pkg?.version ? ` ${pkg.version}` : ""}`)
  console.log(`path:    ${dir}`)
  console.log(`files:   ${files.length} source file(s) searched`)

  if (!members.length && !grep) {
    const entry = pkg?.exports ? Object.keys(pkg.exports) : pkg?.main ? [pkg.main] : []
    if (entry.length) console.log(`exports: ${entry.join(", ")}`)
    else console.log(`exports: (not declared in package.json)`)
    console.log("\nname a member to see its declaration, or pass --grep <pattern>.")
    process.exit(0)
  }

  const targets = members.length ? members : [grep]
  let missing = 0

  for (const target of targets) {
    const regexes = grep && !members.length ? [new RegExp(grep)] : patterns(target)
    const hits = search(files, regexes)
    if (!hits.length) {
      missing += 1
      console.log(`\n${target}: NOT FOUND in ${files.length} file(s)`)
      continue
    }
    console.log(`\n${target}: ${hits.length} declaration(s)`)
    for (const hit of hits.slice(0, 5)) {
      console.log(`  ${hit.file}:${hit.line}`)
      console.log(`    ${hit.text}`)
    }
    if (hits.length > 5) console.log(`  ... ${hits.length - 5} more`)
  }

  process.exit(missing ? 1 : 0)
}

main()
