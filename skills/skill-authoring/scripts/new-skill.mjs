#!/usr/bin/env node
// Scaffold a new opencode skill with valid frontmatter.
// Usage: node new-skill.mjs <name> [--desc "..."] [--out <dir>]
// Prints the created path on success. Exit 0 ok, 1 bad input, 2 write failure.

import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))

const argv = process.argv.slice(2)
const name = argv.find((a) => !a.startsWith("--"))
function flag(key, fallback) {
  const i = argv.indexOf(`--${key}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback
}

if (!name) {
  console.error("usage: node new-skill.mjs <name> [--desc \"...\"] [--out <dir>]")
  process.exit(1)
}

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
if (name.length > 64) {
  console.error(`name "${name}" is ${name.length} chars; max is 64`)
  process.exit(1)
}
if (!NAME_RE.test(name)) {
  console.error(
    `invalid name "${name}".\n` +
      "  must be lowercase a-z, digits, and single hyphens; no leading, trailing, or doubled hyphens",
  )
  process.exit(1)
}

const desc = flag("desc", "")
if (!desc) {
  console.error("--desc is required (a skill without a description is never surfaced to the model)")
  console.error(`example: --desc "What it does. Use when <specific triggers>."`)
  process.exit(1)
}
if (desc.length > 1024) {
  console.error(`description is ${desc.length} chars; max is 1024`)
  process.exit(1)
}

const outRoot = resolve(flag("out", join(process.cwd(), ".opencode", "skills")))
const dir = join(outRoot, name)
if (existsSync(dir)) {
  console.error(`already exists: ${dir}`)
  process.exit(1)
}

const body = `# ${name.replace(/-/g, " ")}
<one line: what this is>

## When to use this

<what the reader should be doing when they open this file>

## Rules

<the three or four things that matter most, ordered by how often they are wrong>

## Reference

- \`references/<topic>.md\` — <what it covers>; read when <specific situation>
  <delete this section until you actually add the file>

## Checklist

- [ ] <how the reader knows they got it right>
`

const content = `---\nname: ${name}\ndescription: ${desc}\n---\n\n${body}`

try {
  // Only the skill folder itself: references/, scripts/, assets/ are created
  // when there is real content to put in them, not as empty placeholders.
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "SKILL.md"), content, "utf8")
} catch (e) {
  console.error(`write failed: ${e.message}`)
  process.exit(2)
}

console.log(`${join(dir, "SKILL.md")}`)
console.log(`\nnext: node ${join(HERE, "validate-skill.mjs")} ${dir}`)
