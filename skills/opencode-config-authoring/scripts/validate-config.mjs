#!/usr/bin/env node
// Validate an opencode.json / opencode.jsonc against the published schema.
// Usage: node validate-config.mjs <path> [--no-fetch]
// Exit 0 = clean, 1 = violations found, 2 = could not check.

import { readFileSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { Report } from "./lib/report.mjs"
import { stripJsonc } from "./lib/jsonc.mjs"
import { checkUnknownKeys, loadSchema } from "./lib/schema.mjs"
import { checkReferences, checkShape, checkSkillFrontmatter } from "./lib/checks.mjs"
import { scanScopes } from "./lib/scan.mjs"

const arg = process.argv[2]
if (!arg) {
  console.error("usage: node validate-config.mjs <opencode.json(c)> [--no-fetch]")
  process.exit(2)
}

const file = resolve(arg)
const baseDir = dirname(file)

function readConfig(path) {
  let raw
  try {
    raw = readFileSync(path, "utf8")
  } catch (e) {
    console.error(`cannot read ${path}: ${e.message}`)
    process.exit(2)
  }
  try {
    return JSON.parse(stripJsonc(raw))
  } catch (e) {
    console.error(`JSON parse failed after comment strip: ${e.message}`)
    process.exit(1)
  }
}

const cfg = readConfig(file)
if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
  console.error("top level must be a JSON object")
  process.exit(1)
}

const report = new Report()

const schema = await loadSchema(report, { enabled: !process.argv.includes("--no-fetch") })
checkUnknownKeys(cfg, schema, report)

checkShape(cfg, report)

const mdFiles = scanScopes(baseDir)
checkReferences(cfg, report, { baseDir, mdFiles })
checkSkillFrontmatter(mdFiles, report)

for (const w of report.warnings) console.log(`warn  ${w}`)
for (const e of report.errors) console.log(`ERROR ${e}`)
console.log(
  `\n${basename(file)}: ${report.errors.length} error(s), ${report.warnings.length} warning(s)` +
    (schema ? "" : " (schema not checked)"),
)
process.exit(report.errors.length ? 1 : 0)
