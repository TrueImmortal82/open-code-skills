#!/usr/bin/env node
// Gate a publish or a push: run the checks that would otherwise be skipped,
// and report every failure rather than the first one. This is a checklist that
// cannot be forgotten because forgetting it is the failure mode.
//
// Usage: node pre-publish.mjs [dir] [--json] [--quick] [--skip <name>]
// Exit 0 = all gates passed, 1 = at least one failed, 2 = could not run.

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

const argv = process.argv.slice(2)
const asJson = argv.includes("--json")
const quick = argv.includes("--quick")
const flag = (key) => {
  const i = argv.indexOf(`--${key}`)
  return i === -1 ? undefined : argv[i + 1]
}
const dirArg = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")) && !a.startsWith("--"))
const dir = resolve(dirArg ?? process.cwd())
const skip = new Set((flag("skip") ?? "").split(",").map((s) => s.trim()).filter(Boolean))

function die(message, code) {
  console.error(`pre-publish: ${message}`)
  process.exit(code)
}

function run(cmd, args, cwd = dir) {
  const res = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd })
  return { code: res.status, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim(), error: res.error }
}

// A gate is either a git query or a local script. Each returns a pass/fail with
// one line of evidence, because "failed" without a reason is not actionable.
const gates = [
  {
    name: "clean tree",
    quick: false,
    check: () => {
      const r = run("git", ["status", "--porcelain"])
      if (r.error || r.code !== 0) return { ok: true, why: "skipped: not a git working tree", skipped: true }
      if (!r.out) return { ok: true, why: "no uncommitted changes" }
      const n = r.out.split(/\r?\n/).length
      return { ok: false, why: `${n} uncommitted change(s); commit or stash them first` }
    },
  },
  {
    name: "branch pushed",
    quick: false,
    check: () => {
      const up = run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
      if (up.error || up.code !== 0) return { ok: true, why: "skipped: no upstream", skipped: true }
      const ahead = run("git", ["log", "--oneline", "@{u}..HEAD"])
      const n = ahead.code === 0 && ahead.out ? ahead.out.split(/\r?\n/).length : 0
      return n === 0 ? { ok: true, why: "up to date with upstream" } : { ok: false, why: `${n} commit(s) not pushed` }
    },
  },
  {
    name: "no secrets in tracked files",
    quick: true,
    check: () => {
      const res = run("git", ["ls-files"])
      if (res.error || res.code !== 0) return { ok: true, why: "skipped: no git index", skipped: true }
      // Cheap, high-signal patterns only. A full scanner is a separate concern
      // and this must not become the thing that blocks a five-line change.
      const RULES = [
        [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/, "a GitHub token"],
        [/\bsk-[A-Za-z0-9]{20,}\b/, "an OpenAI-style key"],
        [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key id"],
        [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
      ]
      const hits = []
      for (const file of res.out.split(/\r?\n/).filter(Boolean)) {
        if (file.split("/").some((p) => p === "node_modules" || p === "vendor")) continue
        let text
        try {
          text = readFileSync(join(dir, file), "utf8")
        } catch {
          continue
        }
        for (const [re, label] of RULES) {
          if (re.test(text)) hits.push(`${file} (${label})`)
        }
      }
      const uniq = [...new Set(hits)]
      return uniq.length ? { ok: false, why: `possible secret in ${uniq.slice(0, 3).join(", ")}` } : { ok: true, why: "no obvious key material" }
    },
  },
  {
    name: "package version present",
    quick: true,
    check: () => {
      const file = join(dir, "package.json")
      if (!existsSync(file)) return { ok: true, why: "no package.json" }
      const pkg = JSON.parse(readFileSync(file, "utf8"))
      if (!pkg.version) return { ok: false, why: "package.json has no version" }
      return { ok: true, why: `${pkg.name ?? "package"} ${pkg.version}` }
    },
  },
  {
    name: "skill validation",
    quick: true,
    // Only meaningful for a skills repository, so it is discovered rather than
    // assumed: a gate that fires on an unrelated project is noise.
    check: () => {
      const validator = join(dir, "skills", "skill-authoring", "scripts", "validate-skill.mjs")
      if (!existsSync(validator)) return { ok: true, why: "not a skills repo" }
      const root = join(dir, "skills")
      const failures = []
      let count = 0
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const target = join(root, entry.name)
        if (!existsSync(join(target, "SKILL.md"))) continue
        count += 1
        const r = run("node", [validator, target])
        const m = r.out.match(/(\d+) error\(s\), (\d+) warning/)
        if (r.code !== 0 || (m && Number(m[1]) > 0)) failures.push(entry.name)
      }
      if (!count) return { ok: true, why: "no skills found" }
      return failures.length
        ? { ok: false, why: `${failures.length}/${count} skill(s) failed: ${failures.slice(0, 4).join(", ")}` }
        : { ok: true, why: `${count} skill(s) valid` }
    },
  },
  {
    name: "no leftover markers",
    quick: true,
    check: () => {
      // Tracked files only, same as the secret gate. A TODO in someone's editor
      // buffer or an unrelated scratch file is not a blocker for this release.
      const res = run("git", ["ls-files"])
      const files = res.code === 0 && !res.error
        ? res.out.split(/\r?\n/).filter(Boolean)
        : null
      if (!files) {
        return { ok: true, why: "skipped: no git index", skipped: true }
      }
      const hits = []
      for (const file of files) {
        if (!/\.(ts|tsx|js|mjs|cjs|md|json|jsonc)$/.test(file)) continue
        if (file.split("/").some((p) => p === "node_modules" || p === "vendor")) continue
        let text
        try {
          text = readFileSync(join(dir, file), "utf8")
        } catch {
          continue
        }
        if (/\b(TODO|FIXME|XXX|HACK)\b:/.test(text)) hits.push(file)
      }
      return hits.length
        ? { ok: false, why: `${hits.length} file(s) with TODO/FIXME markers: ${hits.slice(0, 3).join(", ")}` }
        : { ok: true, why: "none" }
    },
  },
  {
    name: "build or test",
    quick: false,
    check: () => {
      const pkgFile = join(dir, "package.json")
      if (!existsSync(pkgFile)) return { ok: true, why: "no package.json" }
      const pkg = JSON.parse(readFileSync(pkgFile, "utf8"))
      const script = pkg.scripts?.test ?? pkg.scripts?.build
      if (!script) return { ok: true, why: "no test or build script defined" }
      const r = run("npm", ["run", pkg.scripts?.test ? "test" : "build", "--silent"])
      return r.code === 0
        ? { ok: true, why: `${pkg.scripts?.test ? "test" : "build"} passed` }
        : { ok: false, why: `${pkg.scripts?.test ? "test" : "build"} failed (exit ${r.code})` }
    },
  },
]

function main() {
  if (!existsSync(dir)) die(`no such directory: ${dir}`, 2)

  // In quick mode the slow gates are reported as skipped rather than silently
  // dropped, so the output never implies a check passed that did not run.
  const results = gates.map((g) => {
    if (skip.has(g.name)) return { name: g.name, ok: true, why: "skipped by --skip", skipped: true }
    if (quick && !g.quick) return { name: g.name, ok: true, why: "not run in --quick mode", skipped: true }
    try {
      return { name: g.name, ...g.check() }
    } catch (error) {
      return { name: g.name, ok: false, why: `gate threw: ${error.message}` }
    }
  })

  const failed = results.filter((r) => !r.ok)

  if (asJson) {
    console.log(JSON.stringify({ dir, quick, results, failed: failed.length }, null, 2))
    process.exit(failed.length ? 1 : 0)
  }

  console.log(`${quick ? "quick" : "full"} pre-publish check: ${dir}\n`)
  for (const r of results) {
    const mark = r.skipped ? "skip" : r.ok ? "ok  " : "FAIL"
    console.log(`  [${mark}] ${r.name.padEnd(28)} ${r.why}`)
  }

  if (failed.length) {
    console.log(`\n${failed.length} gate(s) failed: ${failed.map((f) => f.name).join(", ")}`)
    process.exit(1)
  }
  console.log("\nall gates passed.")
}

main()
