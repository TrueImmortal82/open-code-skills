# open-code-skills

[![release](https://img.shields.io/github/release/TrueImmortal82/open-code-skills?display_name=tag)](https://github.com/TrueImmortal82/open-code-skills/releases/latest)
[![license](https://img.shields.io/github/license/TrueImmortal82/open-code-skills)](LICENSE)
[![opencode](https://img.shields.io/badge/requires-opencode-%3E%3D1.18.0-ff8800)](https://opencode.ai)
[![skills](https://img.shields.io/badge/skills-17-blue)](skills/)

[English](README.md) · [Русский](README.ru.md) · [Oʻzbekcha](README.uz.md)

> **This file is the canonical version.** Translations may lag behind it; when
> they disagree, this document wins. Please do not edit all three by hand —
> change this one and translate what changed.

An installable [OpenCode](https://opencode.ai) plugin that ships a curated set
of agent skills. Install it once; every session gets them.

| | |
| --- | --- |
| Plugin ID | `open-code-skills` |
| Requires | OpenCode `>= 1.18.0` |
| Runtime | Bun — no Node.js needed |
| Licence | MIT |

## How it works

The plugin exports one `config` hook. At startup it appends its bundled
`skills/` directory to `skills.paths` in the live config, and OpenCode's own
skill discovery picks them up. Nothing is copied into global directories.

## Skills

| Skill | What it is for |
| --- | --- |
| `powershell-windows` | PowerShell 5.1 rules: chaining, `$?` vs `$LASTEXITCODE`, quoting, non-UTF-8 console encoding, native exes |
| `opencode-config-authoring` | Writing and repairing `opencode.json` / `opencode.jsonc`, with a JSONC + schema validator |
| `skill-authoring` | How to write a skill that actually triggers — scaffolder and validator included |
| `self-improvement` | Turning a correction into a durable artifact instead of a forgotten intention |
| `code-discipline` | Code standards and hard size budgets — file 300/500 lines, function 30/50, zero new dependencies without asking |
| `assistant-runtime-architecture` | Long-lived assistant runtime: supervisor/child topology, durable delivery, output contracts |
| `opencode-tool-output` | Parsing `opencode debug` JSON instead of regexing it, plus the Windows GUI-binary and `.cmd` shim spawn traps |
| `test-first-fix` | Making a failure observable before changing code, so a fix is a claim a machine can reject |
| `git-safety` | Reading a git tree before running a destructive command, and recovering work that was already lost |
| `github-repo-ops` | Driving `gh` with the scopes you actually have, and recovering from 403 "Resource not accessible" |
| `release-checklist` | The release gates that get skipped under time pressure, failing on all of them at once |
| `troubleshooting-tree` | Halving the search space on an unknown cause instead of guessing fixes |
| `long-task-continuity` | A durable checkpoint so a long task survives a context reset or a crash |
| `api-doc-recall` | Verifying an API against the installed source instead of against remembered documentation |
| `research-synthesis` | Turning several sources into one answer that says what is confirmed, inferred, and unknown |
| `task-closure` | Deciding a task is finished instead of improving it forever: stop conditions, a done test, and what belongs in a follow-up |
| `provider-reconnect` | Retrying a failed model request without paying twice: retryable vs permanent errors, backoff with jitter, `Idempotency-Key`, and dead streams |

Each skill is a plain directory with a `SKILL.md` and YAML frontmatter, per the
[Agent Skills specification](https://agentskills.io/specification). Copy any of
them out of this repo and use them without the plugin.

## Install

Add to `~/.config/opencode/opencode.jsonc` (global) or
`.opencode/opencode.json` (per project):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:TrueImmortal82/open-code-skills"]
}
```

Restart OpenCode afterwards — config is not hot-reloaded.

### If the GitHub spec does not resolve

Direct GitHub install depends on whether your OpenCode version hands the spec
to its package installer. If it does not, clone and point at the directory,
which every version supports:

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["C:/path/to/open-code-skills"]
}
```

Use forward slashes; escape backslashes if you write a Windows path literally.

### Verify

```bash
opencode debug skill
```

Every skill should appear, and its `location` should point inside your
installed copy of this repository.

## Using a subset

Skills are registered per directory, so deleting a skill folder from your
checkout removes it from the install. To keep a local edit to one skill while
still updating the rest, copy it to `~/.config/opencode/skills/` — local
skills join the same discovery pass.

## Development

```bash
git clone https://github.com/TrueImmortal82/open-code-skills.git
cd open-code-skills
npm run validate
```

`npm run validate` runs the bundled validator over every skill and fails on
frontmatter errors, broken internal links, and over-long bodies.

```bash
node skills/skill-authoring/scripts/new-skill.mjs
node skills/skill-authoring/scripts/validate-skill.mjs skills/<your-skill>
node skills/code-discipline/scripts/check-size.mjs .   # file/dependency budget
```

## Contributing

- The plugin module must keep **exactly one** export, the default object.
  OpenCode's legacy loader treats every named export as a separate plugin and
  throws on anything that is not a function.
- The `config` hook receives the live config; its return value is discarded and
  thrown errors are swallowed. Mutate in place and never throw.
- Never nest a `SKILL.md` inside another skill directory — skill paths are
  scanned with a recursive `**/SKILL.md` glob, so a nested file registers as a
  second, unintended skill.
- Keep machine-specific values (absolute paths, console codepages, home
  directories) out of skills. Detect the environment instead.
- `SKILL.md` documents behaviour, not file layout — say what the script does,
  not which module holds which check.
- `self-improvement/queue.md` is a live log; add your own entries freely.

## Licence

MIT — see [LICENSE](LICENSE).
