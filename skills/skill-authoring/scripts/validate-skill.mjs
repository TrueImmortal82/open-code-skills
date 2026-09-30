#!/usr/bin/env node
// Validate an Agent Skills folder against the spec plus trigger-quality rules.
// Usage: node validate-skill.mjs <skill-folder> [--strict]
// Exit 0 clean, 1 violations, 2 could not check.

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { resolve, join, relative } from "node:path"

const STRICT = process.argv.includes("--strict")
const arg = process.argv.slice(2).find((a) => !a.startsWith("--"))
if (!arg) {
  console.error("usage: node validate-skill.mjs <skill-folder> [--strict]")
  process.exit(2)
}

const dir = resolve(arg)
const skillFile = join(dir, "SKILL.md")
const folder = dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop()

const errors = []
const warns = []
const notes = []
const err = (m) => errors.push(m)
const warn = (m) => warns.push(m)

if (!existsSync(skillFile)) {
  console.error(`no SKILL.md in ${dir}`)
  process.exit(2)
}

// ---- frontmatter ----
const raw = readFileSync(skillFile, "utf8")
const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
if (!fmMatch) {
  console.error("SKILL.md has no YAML frontmatter block (must start with --- on line 1)")
  process.exit(1)
}

const fmText = fmMatch[1]
const body = raw.slice(fmMatch[0].length)

// Minimal key scanner: top-level `key: value`, honoring folded/block scalars.
function parseFrontmatter(text) {
  const out = {}
  const lines = text.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const m = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line)
    if (!m) {
      i++
      continue
    }
    const [, key, rest] = m
    if (rest === ">" || rest === "|" || rest === ">-") {
      const parts = []
      i++
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        parts.push(lines[i].trim())
        i++
      }
      out[key] = parts.join(" ").trim()
      continue
    }
    out[key] = rest.trim().replace(/^["'](.*)["']$/, "$1")
    i++
  }
  return out
}

const fm = parseFrontmatter(fmText)

const ALLOWED = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"])
for (const k of Object.keys(fm)) {
  if (!ALLOWED.has(k)) err(`unknown frontmatter key "${k}" (spec allows: ${[...ALLOWED].join(", ")})`)
}

// ---- name ----
const name = fm.name ?? ""
if (!name) {
  err("frontmatter missing `name` (required)")
} else {
  if (name.length > 64) err(`name is ${name.length} chars; max is 64`)
  if (name !== name.toLowerCase()) err(`name "${name}" must be lowercase`)
  if (!/^[a-z0-9-]+$/.test(name)) err(`name "${name}" has invalid characters (allowed: a-z 0-9 -)`)
  if (name.startsWith("-") || name.endsWith("-")) err(`name "${name}" has a leading or trailing hyphen`)
  if (name.includes("--")) err(`name "${name}" contains consecutive hyphens`)
  if (name !== folder) err(`name "${name}" != folder "${folder}" (spec requires they match)`)
}

// ---- description ----
const desc = fm.description ?? ""
if (!desc) {
  err("frontmatter missing `description` (required — a skill without one is filtered out and never surfaced)")
} else {
  if (desc.length > 1024) err(`description is ${desc.length} chars; max is 1024`)
  if (desc.length < 40) warn(`description is only ${desc.length} chars; too short to carry triggers`)
  notes.push(`description: ${desc.length}/1024 chars, ~${Math.round(desc.length / 4)} tokens`)
  const lower = desc.toLowerCase()
  if (!/use when|use this|use for|when the user|when you|when working|when asked/.test(lower)) {
    warn('description has no explicit trigger clause ("Use when ...")')
  }
  if (!/[.]/.test(desc)) warn("description is a single sentence with no period; multi-sentence reads better")
  const concrete = desc.match(
    /`[^`]+`|"[^"]{2,}"|«[^»]{2,}»|\$[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9_.-]+\.(json|jsonc|md|ts|tsx|js|mjs|py|ps1|db|toml|yaml|yml)|_[A-Z][A-Z0-9_]+|\b[A-Z]{2,}[A-Z0-9]+\b/g,
  )
  notes.push(`literal tokens in description: ${concrete ? concrete.length : 0} (want >= 3 for reliable triggering)`)
  if (!concrete || concrete.length < 3) {
    warn(
      "description has few literal keywords (filenames, flags, env vars, error strings) — trigger matching relies on them",
    )
  }
}

if (fm.compatibility && fm.compatibility.length > 500) {
  err(`compatibility is ${fm.compatibility.length} chars; max is 500`)
}

// ---- body ----
const bodyLines = body.split(/\r?\n/).length
notes.push(`body: ${bodyLines} lines${bodyLines > 500 ? "  (over the 500-line target)" : ""}`)
if (bodyLines > 500) {
  const over = STRICT ? err : warn
  over(`body is ${bodyLines} lines; split detail into references/ (target under 500)`)
}

if (body.trim().length < 80) warn("body is nearly empty")
if (!/^#\s/m.test(body)) warn("body does not start with a level-1 heading")

// ---- link resolution ----
// Link check runs on prose only: fenced blocks contain illustrative directory
// trees, not real references.
const prose = body.replace(/```[\s\S]*?```/g, "")
const SEP = process.platform === "win32" ? "\\" : "/"
const linkRe = /`?(?:\]\()?((?:\.\/|references\/|scripts\/|assets\/)[A-Za-z0-9_./-]+\.md)/g
// Single-letter and provider-name segments are how docs write examples
// (`references/x.md`, `references/aws.md`); they are not meant to resolve.
const PLACEHOLDER = /^(x|y|z|foo|bar|aws|gcp|azure|topic|name|example)$/i
const seen = new Set()
let m
while ((m = linkRe.exec(prose))) {
  const rel = m[1]
  if (seen.has(rel)) continue
  if (rel.split("/").some((seg) => PLACEHOLDER.test(seg))) continue
  seen.add(rel)
  const abs = join(dir, rel.split("/").join(SEP))
  if (!existsSync(abs)) err(`body references "${rel}" but ${relative(dir, abs)} does not exist`)
}
notes.push(`internal links checked: ${seen.size}`)
if (seen.size === 0 && bodyLines > 300) {
  warn("long body with no references/ links — consider splitting for progressive disclosure")
}

// ---- bundled resources ----
for (const sub of ["references", "scripts", "assets"]) {
  const p = join(dir, sub)
  if (!existsSync(p)) continue
  const n = readdirSync(p).length
  if (n === 0) warn(`${sub}/ exists but is empty`)
  notes.push(`${sub}/: ${n} file(s)`)
}

// ---- nested skill.md ----
for (const sub of ["references", "assets"]) {
  const p = join(dir, sub)
  if (!existsSync(p)) continue
  for (const f of readdirSync(p)) {
    if (/^SKILL\.md$/i.test(f)) warn(`${sub}/${f} looks like a nested skill; opencode will load it as a separate skill`)
  }
}

// ---- report ----
for (const n of notes) console.log(`info  ${n}`)
for (const w of warns) console.log(`warn  ${w}`)
for (const e of errors) console.log(`ERROR ${e}`)
console.log(`\n${folder}: ${errors.length} error(s), ${warns.length} warning(s)${STRICT ? " [strict]" : ""}`)

process.exit(errors.length ? 1 : 0)
