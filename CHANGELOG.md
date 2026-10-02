# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/).

## [1.1.0] — 2026-10-02

A new skill, and the release gates it needed to ship cleanly.

### Added

- `task-closure` — deciding that a task is finished instead of improving it
  forever. Supplies stop conditions agreed before the work starts, a
  four-question done test, and an explicit list of the work that belongs in a
  follow-up. Its load-bearing rule is that a passing gate is a stop signal
  rather than a green light, since the gate exists to say when the job is over.

### Changed

- Repository description now says 16 skills, and lists `task-closure` among
  the topics it covers.
- Added the `best-practices`, `code-quality`, and `task-management` topics.

### Fixed

- The local copy of `pre-publish.mjs` in `~/.config/opencode/skills` had drifted
  from the repository copy and was missing the marker-gate fix, so it failed a
  release on three files that were only documenting the gate. The two copies
  are byte-identical again.

## [1.0.1] — 2026-10-02

Release hygiene. The v1.0.0 tag was published before the repository metadata
caught up, so this release carries the documentation and the metadata fix.

### Added

- `CHANGELOG.md` and `CONTRIBUTING.md`.
- Bug report and new-skill issue templates, both asking for the evidence a fix
  needs — the exact command and its output, and the trigger not yet claimed.
- README badges for release, licence, minimum opencode version, and skill count.

### Fixed

- `README.ru.md` and `README.uz.md` were missing all seven skills added in
  1.0.0. The 1.0.0 notes claimed all three READMEs had been updated; only the
  English one had. All three now list all 15 skills.
- `package.json` was at 0.1.0 while tag v1.0.0 was already published, and
  `npm run validate` invoked `validate-skill.mjs` without the folder argument it
  requires, so it exited 2 on every run. `validate` now runs the pre-publish
  gates; `check-size` was added.
- The marker gate matched its own documentation, because `release-checklist`
  names the markers it searches for, so it failed on a repository whose only
  unfinished work was the sentence describing the gate. It now skips fenced
  blocks and inline code, requires the trailing colon, and reports file and
  line. A tracked `TODO:` is still caught; an untracked one is not.

## [1.0.0] — 2026-10-01

First tagged release. 15 skills, each with a description tuned to fire on a
specific situation, and a `scripts/` helper wherever the rule could be checked by
a machine rather than only read.

### Added

#### Skills

| Skill | What it is for |
| --- | --- |
| `powershell-windows` | PowerShell 5.1: chaining, `$?` vs `$LASTEXITCODE`, quoting, non-UTF-8 console encoding, native exes, UTC vs local timestamps |
| `opencode-config-authoring` | Writing and repairing `opencode.json` / `opencode.jsonc`, with a JSONC + schema validator |
| `skill-authoring` | Writing a skill that actually triggers — scaffolder and validator included |
| `self-improvement` | Turning a correction into a durable artifact instead of a forgotten intention |
| `code-discipline` | Code standards and hard size budgets, zero new dependencies without asking |
| `assistant-runtime-architecture` | Long-lived assistant runtime: supervisor/child topology, durable delivery, output contracts |
| `opencode-tool-output` | Parsing `opencode debug` JSON instead of regexing it, plus the Windows GUI-binary and `.cmd` shim spawn traps |
| `test-first-fix` | Making a failure observable before changing code |
| `git-safety` | Reading a git tree before a destructive command, and recovering work already lost |
| `github-repo-ops` | Driving `gh` with the scopes you actually have, and recovering from 403 |
| `release-checklist` | The release gates that get skipped under time pressure, failing on all of them at once |
| `troubleshooting-tree` | Halving the search space on an unknown cause instead of guessing fixes |
| `long-task-continuity` | A durable checkpoint so a long task survives a context reset or a crash |
| `api-doc-recall` | Verifying an API against the installed source instead of remembered documentation |
| `research-synthesis` | Turning several sources into one answer that says what is confirmed, inferred, and unknown |

#### Helper scripts

Each ships under its skill's `scripts/`, has documented exit codes, and was
tested with a case that makes it fail:

| Script | Purpose |
| --- | --- |
| `validate-config.mjs` | JSONC + JSON Schema validation for opencode config |
| `new-skill.mjs`, `validate-skill.mjs` | Scaffold and validate a skill |
| `check-size.mjs` | Enforce the 300/500 line budgets |
| `inspect-skill.mjs` | Locate which source a skill was loaded from |
| `repro-check.mjs` | Match a reproduction by exit status, with `--expect-fail` |
| `git-preflight.mjs` | Report what `git reset --hard`, `clean -fd`, or `branch -D` would lose, before it does |
| `gh-preflight.mjs` | Report auth, scopes, visibility, branch protection, and a capability table |
| `bisect-check.mjs` | Bisect an ordered candidate list and refuse a non-monotonic property |
| `checkpoint.mjs` | Store, show, and clear a durable task checkpoint |
| `api-check.mjs` | Locate a member's declaration in the installed source |
| `pre-publish.mjs` | Run every release gate and name every failure at once |

### Fixed

- `gh-preflight.mjs` advertised a `--remote` flag that was not implemented. It
  now reads the named remote, which matters in a fork where `origin` is your
  fork and `upstream` is the original.
- `pre-publish.mjs` scanned markers across the whole filesystem while its
  documentation promised tracked files only. Both the secret gate and the marker
  gate now use `git ls-files`.
- `git-preflight.mjs` reported `git branch -D` as unconditionally safe. Whether a
  delete loses work depends on the named branch and on other remotes, so it is
  now marked `?` — undetermined — and does not affect the exit code.

### Documentation

- `README.md`, `README.ru.md`, and `README.uz.md` document all 15 skills.
- Rules added from real failures: `Out of memory` in a subprocess can mean a full
  disk rather than RAM; a contradiction in the evidence outranks the working
  theory; log timestamps are UTC while `Get-Date` is local; and a grep for your
  own search terms matches your searches.

[1.0.1]: https://github.com/TrueImmortal82/open-code-skills/releases/tag/v1.0.1
[1.0.0]: https://github.com/TrueImmortal82/open-code-skills/releases/tag/v1.0.0
