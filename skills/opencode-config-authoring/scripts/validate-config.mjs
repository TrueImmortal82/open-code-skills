#!/usr/bin/env node
// Validate an opencode.json / opencode.jsonc against the published schema.
// Usage: node validate-config.mjs <path> [--no-fetch]
// Exit 0 = clean, 1 = violations found, 2 = could not check.

import { readFileSync } from "node:fs"
import { dirname, resolve, join, basename } from "node:path"

const SCHEMA_URL = "https://opencode.ai/config.json"

const FLAT_ONLY_PERMISSION = new Set([
  "todowrite",
  "question",
  "webfetch",
  "websearch",
  "doom_loop",
])

const errors = []
const warns = []
const err = (m) => errors.push(m)
const warn = (m) => warns.push(m)

function stripJsonc(input) {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  let out = ""
  let i = 0
  const n = text.length
  let inStr = false
  while (i < n) {
    const c = text[i]
    if (inStr) {
      out += c
      if (c === "\\") {
        out += text[i + 1] ?? ""
        i += 2
        continue
      }
      if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      i++
      continue
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i++
      continue
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out.replace(/,(\s*[}\]])/g, "$1")
}

const arg = process.argv[2]
if (!arg) {
  console.error("usage: node validate-config.mjs <opencode.json(c)> [--no-fetch]")
  process.exit(2)
}
const file = resolve(arg)
const baseDir = dirname(file)

let raw
try {
  raw = readFileSync(file, "utf8")
} catch (e) {
  console.error(`cannot read ${file}: ${e.message}`)
  process.exit(2)
}

let cfg
try {
  cfg = JSON.parse(stripJsonc(raw))
} catch (e) {
  console.error(`JSON parse failed after comment strip: ${e.message}`)
  process.exit(1)
}

if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
  console.error("top level must be a JSON object")
  process.exit(1)
}

// ---- schema fetch (best effort) ----
let schema = null
if (!process.argv.includes("--no-fetch")) {
  try {
    const ctl = AbortSignal.timeout(15000)
    const res = await fetch(SCHEMA_URL, { signal: ctl })
    if (res.ok) schema = await res.json()
    else warn(`schema fetch returned HTTP ${res.status}; skipped schema checks`)
  } catch (e) {
    warn(`schema fetch failed (${e.message}); ran local checks only`)
  }
}

function schemaProps(node) {
  if (!node) return null
  if (node.$ref) return null
  return node.properties ?? null
}

if (schema) {
  // The published schema root is `{"$ref": "#/$defs/Config", ...}`, so the real
  // property list lives behind the ref.
  const refName = String(schema.$ref ?? "").split("/").pop()
  const root = schemaProps(refName ? schema.$defs?.[refName] : schema)
  if (root) {
    if (refName) {
      console.log(`schema: resolved #/$defs/${refName} (${Object.keys(root).length} top-level keys)`)
    }
    for (const k of Object.keys(cfg)) {
      if (!(k in root)) err(`unknown top-level key "${k}" (additionalProperties: false -> ConfigInvalidError)`)
    }
  } else {
    warn("could not resolve schema root properties; skipped unknown-key check")
  }
}

// ---- local shape checks ----

if (cfg.model !== undefined && typeof cfg.model === "string" && !cfg.model.includes("/")) {
  err(`model "${cfg.model}" needs a provider prefix, e.g. "anthropic/${cfg.model}"`)
}
if (cfg.small_model !== undefined && typeof cfg.small_model === "string" && !cfg.small_model.includes("/")) {
  err(`small_model "${cfg.small_model}" needs a provider prefix`)
}

if (cfg.skills !== undefined) {
  if (Array.isArray(cfg.skills)) err(`skills must be an object {paths, urls}, not an array`)
  else if (typeof cfg.skills !== "object" || cfg.skills === null) err("skills must be an object")
  else {
    if (cfg.skills.paths !== undefined && !Array.isArray(cfg.skills.paths))
      err("skills.paths must be an array of strings")
    if (cfg.skills.urls !== undefined && !Array.isArray(cfg.skills.urls))
      err("skills.urls must be an array of strings")
  }
}

for (const key of ["agent", "command", "mcp", "references", "permission"]) {
  const v = cfg[key]
  if (v !== undefined && (v === null || typeof v !== "object" || Array.isArray(v))) {
    err(`"${key}" must be an object keyed by name`)
  }
}

if (Array.isArray(cfg.agent)) err('"agent" must be an object keyed by name, not an array')
if (Array.isArray(cfg.command)) err('"command" must be an object keyed by name, not an array')

if (cfg.plugin !== undefined && !Array.isArray(cfg.plugin)) err("plugin must be an array")

if (cfg.mcp && typeof cfg.mcp === "object") {
  for (const [name, def] of Object.entries(cfg.mcp)) {
    if (def === null || typeof def !== "object") {
      err(`mcp.${name} must be an object`)
      continue
    }
    if (def.enabled === false) continue
    if (typeof def.type !== "string") err(`mcp.${name}.type is required (local | remote)`)
    if (def.type === "local") {
      if (!Array.isArray(def.command)) err(`mcp.${name}.command must be an array of strings, never a string`)
      else if (def.command.some((c) => typeof c !== "string")) err(`mcp.${name}.command entries must all be strings`)
      if (def.url) warn(`mcp.${name} is type local but has a url`)
    }
    if (def.type === "remote" && typeof def.url !== "string") err(`mcp.${name}.url is required for type remote`)
    if (def.url === "" ) err(`mcp.${name}.url is empty`)
  }
}

if (cfg.permission && typeof cfg.permission === "object" && !Array.isArray(cfg.permission)) {
  for (const [tool, val] of Object.entries(cfg.permission)) {
    if (FLAT_ONLY_PERMISSION.has(tool) && val !== null && typeof val === "object" && !Array.isArray(val)) {
      err(`permission.${tool} accepts only a flat action ("allow"|"ask"|"deny"), not a pattern object`)
    }
  }
  if (typeof cfg.permission === "string" && cfg.permission === "allow") {
    warn('top-level "permission": "allow" disables all prompts')
  }
}

for (const m of ["bash", "edit", "read"]) {
  const v = cfg.permission?.[m]
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const keys = Object.keys(v)
    const broadFirst = keys.findIndex((k) => k === "*")
    if (broadFirst !== -1 && broadFirst < keys.length - 1) {
      warn(`permission.${m} has "*" at position ${broadFirst}; last match wins, so narrow rules after it are dead`)
    }
  }
}

if (cfg.agent && typeof cfg.agent === "object") {
  for (const [name, def] of Object.entries(cfg.agent)) {
    if (def === null || typeof def !== "object") { err(`agent.${name} must be an object`); continue }
    if (def.prompt && def.mode === undefined && false) { /* noop */ }
    if (def.mode && !["primary", "subagent", "all"].includes(def.mode))
      err(`agent.${name}.mode "${def.mode}" must be primary | subagent | all`)
  }
}

if (cfg.default_agent) {
  const target = cfg.agent?.[cfg.default_agent]
  if (target && target.hidden === true) err(`default_agent "${cfg.default_agent}" is hidden`)
  if (target && target.mode && target.mode !== "primary")
    err(`default_agent "${cfg.default_agent}" has mode "${target.mode}"; must be primary`)
  else if (!target) warn(`default_agent "${cfg.default_agent}" is not defined in this file (may come from another scope)`)
}

// ---- referenced file existence ----
import { existsSync, readdirSync, statSync } from "node:fs"

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "target", ".venv", "__pycache__"])
const MAX_FILES = 4000

function listMarkdown(dir, depth = 0) {
  const found = []
  if (depth > 6 || found.length > MAX_FILES) return found
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return found }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".opencode") continue
    if (SKIP_DIRS.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) found.push(...listMarkdown(p, depth + 1))
    else if (e.isFile() && e.name.endsWith(".md")) found.push(p)
  }
  return found
}

function isDir(p) {
  try { return statSync(p).isDirectory() } catch { return false }
}
function isFile(p) {
  try { return statSync(p).isFile() } catch { return false }
}

function scopeDirs() {
  const dirs = new Set([baseDir, join(process.env.USERPROFILE || "", ".config", "opencode")])
  // Only walk up from a config that actually lives in a project tree, never
  // from the global config (whose parent chain is the whole home directory).
  if (baseDir.includes(join(".config", "opencode"))) return [...dirs].filter(isDir)
  let up = dirname(baseDir)
  for (let i = 0; i < 8 && up && up.length > 2; i++) {
    const looksLikeProject =
      isFile(join(up, "package.json")) || isFile(join(up, ".git")) || isDir(join(up, ".opencode"))
    if (looksLikeProject) {
      dirs.add(up)
      dirs.add(join(up, ".opencode"))
    }
    const next = dirname(up)
    if (next === up) break
    up = next
  }
  return [...dirs].filter(isDir)
}

const dirs = scopeDirs()
const mdFiles = [...new Set(dirs.flatMap(listMarkdown))]

function hasKind(kind, name) {
  const re = new RegExp(`[/\\\\]${kind}[/\\\\]${name}\\.md$`, "i")
  return mdFiles.some((f) => re.test(f))
}
function hasSkill(name) {
  return mdFiles.some((f) => /SKILL\.md$/i.test(f) && basename(dirname(f)) === name)
}

for (const name of Object.keys(cfg.agent ?? {})) {
  if (!hasKind("agent", name) && !hasKind("agents", name)) {
    warns.push(`agent "${name}" has no .opencode/agent/${name}.md in scanned scopes (inline config is allowed)`)
  }
}
for (const name of Object.keys(cfg.command ?? {})) {
  if (!hasKind("command", name) && !hasKind("commands", name)) {
    warns.push(`command "${name}" has no matching .md in scanned scopes (inline template is allowed)`)
  }
}
for (const p of cfg.skills?.paths ?? []) {
  const abs = p.startsWith("~")
    ? join(process.env.USERPROFILE || "", p.slice(1))
    : resolve(baseDir, p)
  if (!existsSync(abs)) err(`skills.paths entry does not exist: ${abs}`)
  else if (!listMarkdown(abs).some((f) => /SKILL\.md$/i.test(f))) {
    warns.push(`skills.paths entry has no **/SKILL.md: ${abs}`)
  }
}
for (const p of cfg.references ? Object.entries(cfg.references) : []) {
  const [alias, def] = p
  const d = typeof def === "string" ? { path: def } : def
  if (d?.path) {
    const abs = d.path.startsWith("~")
      ? join(process.env.USERPROFILE || "", d.path.slice(1))
      : resolve(baseDir, d.path)
    if (!existsSync(abs)) err(`references.${alias}.path does not exist: ${abs}`)
  }
  if (d && !d.repository && !d.path) err(`references.${alias} needs a "path" or "repository"`)
  if (d && !d.description) warn(`references.${alias} has no description; it will not be advertised to agents`)
}

// ---- skill frontmatter sanity ----
for (const f of mdFiles.filter((f) => /SKILL\.md$/i.test(f))) {
  const text = (() => { try { return readFileSync(f, "utf8") } catch { return "" } })()
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const folder = basename(dirname(f))
  if (!m) { err(`${f}: no YAML frontmatter block`); continue }
  const fm = m[1]
  if (!/^\s*name\s*:/m.test(fm)) err(`${f}: frontmatter missing "name" (folder is "${folder}")`)
  if (!/^\s*description\s*:/m.test(fm)) err(`${f}: frontmatter missing "description" (skill will never surface)`)
  const nm = /^\s*name\s*:\s*(\S+)/m.exec(fm)
  if (nm && nm[1] !== folder) warn(`${f}: name "${nm[1]}" != folder "${folder}" (spec violation; opencode loads it by folder name)`)
}

// ---- report ----
for (const w of warns) console.log(`warn  ${w}`)
for (const e of errors) console.log(`ERROR ${e}`)
console.log(`\n${basename(file)}: ${errors.length} error(s), ${warns.length} warning(s)` + (schema ? "" : " (schema not checked)"))
process.exit(errors.length ? 1 : 0)
