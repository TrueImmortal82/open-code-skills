// Filesystem scope discovery. Finds the config scopes and the markdown files
// inside them, so the checks can verify that referenced files really exist.

import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "target", ".venv", "__pycache__"])
const MAX_DEPTH = 6
const MAX_FILES = 4000

function isDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

// `budget` is threaded through the recursion because a per-call array length
// check never sees the files found by sibling calls.
export function listMarkdown(dir, budget = { left: MAX_FILES }, depth = 0) {
  const found = []
  if (depth > MAX_DEPTH || budget.left <= 0) return found

  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }

  for (const entry of entries) {
    if (budget.left <= 0) break
    if (entry.name.startsWith(".") && entry.name !== ".opencode") continue
    if (SKIP_DIRS.has(entry.name)) continue

    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...listMarkdown(full, budget, depth + 1))
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(full)
      budget.left--
    }
  }

  return found
}

export function expandPath(p, baseDir) {
  if (p.startsWith("~")) return join(process.env.USERPROFILE || "", p.slice(1))
  return resolve(baseDir, p)
}

export function scopeDirs(baseDir) {
  const dirs = new Set([baseDir, join(process.env.USERPROFILE || "", ".config", "opencode")])

  // Never walk up from the global config: its parent chain is the whole home
  // directory, which is how an earlier version of this script hung for 60s.
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

export function scanScopes(baseDir) {
  return [...new Set(scopeDirs(baseDir).flatMap((dir) => listMarkdown(dir)))]
}
