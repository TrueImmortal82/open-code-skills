// Local validation rules: config shape, referenced-file existence, and skill
// frontmatter sanity. No network, no schema — purely local facts.

import { existsSync, readFileSync } from "node:fs"
import { basename, dirname } from "node:path"
import { expandPath, listMarkdown } from "./scan.mjs"

// These tools take only a flat action string. A pattern object is silently
// accepted by the config parser but never applied, which reads as "allowed".
const FLAT_ONLY_PERMISSION = new Set(["todowrite", "question", "webfetch", "websearch", "doom_loop"])

const OBJECT_KEYED = ["agent", "command", "mcp", "references", "permission"]

export function checkShape(cfg, report) {
  if (typeof cfg.model === "string" && !cfg.model.includes("/")) {
    report.err(`model "${cfg.model}" needs a provider prefix, e.g. "anthropic/${cfg.model}"`)
  }
  if (typeof cfg.small_model === "string" && !cfg.small_model.includes("/")) {
    report.err(`small_model "${cfg.small_model}" needs a provider prefix`)
  }

  if (cfg.skills !== undefined) {
    if (Array.isArray(cfg.skills)) {
      report.err("skills must be an object {paths, urls}, not an array")
    } else if (typeof cfg.skills !== "object" || cfg.skills === null) {
      report.err("skills must be an object")
    } else {
      if (cfg.skills.paths !== undefined && !Array.isArray(cfg.skills.paths)) {
        report.err("skills.paths must be an array of strings")
      }
      if (cfg.skills.urls !== undefined && !Array.isArray(cfg.skills.urls)) {
        report.err("skills.urls must be an array of strings")
      }
    }
  }

  for (const key of OBJECT_KEYED) {
    const v = cfg[key]
    if (v !== undefined && (v === null || typeof v !== "object" || Array.isArray(v))) {
      report.err(`"${key}" must be an object keyed by name`)
    }
  }

  if (Array.isArray(cfg.agent)) report.err('"agent" must be an object keyed by name, not an array')
  if (Array.isArray(cfg.command)) report.err('"command" must be an object keyed by name, not an array')
  if (cfg.plugin !== undefined && !Array.isArray(cfg.plugin)) report.err("plugin must be an array")

  checkMcp(cfg, report)
  checkPermission(cfg, report)
  checkAgents(cfg, report)
}

// A top-level string permission is a separate shape from the object form, so it
// has to be checked before the object guard rather than inside it.
function checkPermission(cfg, report) {
  if (cfg.permission === "allow") {
    report.warn('top-level "permission": "allow" disables all prompts')
  }

  if (cfg.permission && typeof cfg.permission === "object" && !Array.isArray(cfg.permission)) {
    for (const [tool, val] of Object.entries(cfg.permission)) {
      if (FLAT_ONLY_PERMISSION.has(tool) && val !== null && typeof val === "object" && !Array.isArray(val)) {
        report.err(`permission.${tool} accepts only a flat action ("allow"|"ask"|"deny"), not a pattern object`)
      }
    }
  }

  for (const tool of ["bash", "edit", "read"]) {
    const val = cfg.permission?.[tool]
    if (!val || typeof val !== "object" || Array.isArray(val)) continue
    const keys = Object.keys(val)
    const broad = keys.indexOf("*")
    if (broad !== -1 && broad < keys.length - 1) {
      report.warn(`permission.${tool} has "*" at position ${broad}; last match wins, so narrow rules after it are dead`)
    }
  }
}

function checkMcp(cfg, report) {
  if (!cfg.mcp || typeof cfg.mcp !== "object") return
  for (const [name, def] of Object.entries(cfg.mcp)) {
    if (def === null || typeof def !== "object") {
      report.err(`mcp.${name} must be an object`)
      continue
    }
    if (def.enabled === false) continue
    if (typeof def.type !== "string") report.err(`mcp.${name}.type is required (local | remote)`)
    if (def.type === "local") {
      if (!Array.isArray(def.command)) {
        report.err(`mcp.${name}.command must be an array of strings, never a string`)
      } else if (def.command.some((c) => typeof c !== "string")) {
        report.err(`mcp.${name}.command entries must all be strings`)
      }
      if (def.url) report.warn(`mcp.${name} is type local but has a url`)
    }
    if (def.type === "remote" && typeof def.url !== "string") {
      report.err(`mcp.${name}.url is required for type remote`)
    }
    if (def.url === "") report.err(`mcp.${name}.url is empty`)
  }
}

function checkAgents(cfg, report) {
  if (cfg.agent && typeof cfg.agent === "object") {
    for (const [name, def] of Object.entries(cfg.agent)) {
      if (def === null || typeof def !== "object") {
        report.err(`agent.${name} must be an object`)
        continue
      }
      if (def.mode && !["primary", "subagent", "all"].includes(def.mode)) {
        report.err(`agent.${name}.mode "${def.mode}" must be primary | subagent | all`)
      }
    }
  }

  if (!cfg.default_agent) return
  const target = cfg.agent?.[cfg.default_agent]
  if (!target) {
    report.warn(`default_agent "${cfg.default_agent}" is not defined in this file (may come from another scope)`)
    return
  }
  if (target.hidden === true) report.err(`default_agent "${cfg.default_agent}" is hidden`)
  if (target.mode && target.mode !== "primary") {
    report.err(`default_agent "${cfg.default_agent}" has mode "${target.mode}"; must be primary`)
  }
}

export function checkReferences(cfg, report, { baseDir, mdFiles }) {
  const hasKind = (kind, name) => {
    const re = new RegExp(`[/\\\\]${kind}[/\\\\]${name}\\.md$`, "i")
    return mdFiles.some((f) => re.test(f))
  }

  for (const name of Object.keys(cfg.agent ?? {})) {
    if (!hasKind("agent", name) && !hasKind("agents", name)) {
      report.warn(`agent "${name}" has no .opencode/agent/${name}.md in scanned scopes (inline config is allowed)`)
    }
  }
  for (const name of Object.keys(cfg.command ?? {})) {
    if (!hasKind("command", name) && !hasKind("commands", name)) {
      report.warn(`command "${name}" has no matching .md in scanned scopes (inline template is allowed)`)
    }
  }

  for (const p of cfg.skills?.paths ?? []) {
    const abs = expandPath(p, baseDir)
    if (!existsSync(abs)) {
      report.err(`skills.paths entry does not exist: ${abs}`)
    } else if (!listMarkdown(abs).some((f) => /SKILL\.md$/i.test(f))) {
      report.warn(`skills.paths entry has no **/SKILL.md: ${abs}`)
    }
  }

  for (const [alias, raw] of Object.entries(cfg.references ?? {})) {
    const def = typeof raw === "string" ? { path: raw } : raw
    if (def?.path) {
      const abs = expandPath(def.path, baseDir)
      if (!existsSync(abs)) report.err(`references.${alias}.path does not exist: ${abs}`)
    }
    if (def && !def.repository && !def.path) {
      report.err(`references.${alias} needs a "path" or "repository"`)
    }
    if (def && !def.description) {
      report.warn(`references.${alias} has no description; it will not be advertised to agents`)
    }
  }
}

export function checkSkillFrontmatter(mdFiles, report) {
  for (const file of mdFiles.filter((f) => /SKILL\.md$/i.test(f))) {
    let text
    try {
      text = readFileSync(file, "utf8")
    } catch {
      continue
    }
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
    const folder = basename(dirname(file))

    if (!match) {
      report.err(`${file}: no YAML frontmatter block`)
      continue
    }
    const fm = match[1]
    if (!/^\s*name\s*:/m.test(fm)) report.err(`${file}: frontmatter missing "name" (folder is "${folder}")`)
    if (!/^\s*description\s*:/m.test(fm)) {
      report.err(`${file}: frontmatter missing "description" (skill will never surface)`)
    }
    const declared = /^\s*name\s*:\s*(\S+)/m.exec(fm)
    if (declared && declared[1] !== folder) {
      report.warn(`${file}: name "${declared[1]}" != folder "${folder}" (spec violation; opencode loads it by folder name)`)
    }
  }
}
