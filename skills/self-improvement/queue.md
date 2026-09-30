# Lesson queue

Captured lessons awaiting promotion. Appended at the moment of learning; promoted
entries stay here with a `promoted ->` status so the history is auditable.

Shape: date — one-line title, then **Triggered by**, **Rule**, **Status**.
Three lines. Elaborate entries do not get promoted.

See `../SKILL.md` for the classify/promote procedure.

## Pending

(nothing yet)

## Promoted

### 2026-09-30 — Lessons must land in files, not conversation
**Triggered by:** user request to make the agent able to learn
**Rule:** a correction that is not written to an artifact has not been learned.
Capture at the moment of failure, in the same session.
**Status:** promoted -> self-improvement/SKILL.md (2026-09-30)

### 2026-09-30 — Two skills covering one domain suppress each other
**Triggered by:** choosing between `assistant-runtime-architecture` and
`opencode-config-authoring` descriptions during authoring
**Rule:** before creating a skill, check whether an existing description already
claims the trigger. Extend it instead.
**Status:** promoted -> self-improvement/SKILL.md (2026-09-30)

### 2026-09-30 — Node argv[0] is the exe path, not the script
**Triggered by:** `validate-skill.mjs` reported the node binary as the skill
folder on first run
**Rule:** `process.argv.find(a => !a.startsWith("--"))` picks up `argv[0]`.
Always `process.argv.slice(2)` in a node script. Same class of bug in every
language's arg handling.
**Status:** promoted -> fixed in skill-authoring/scripts/validate-skill.mjs (2026-09-30)

### 2026-09-30 — Recursive config scans must not walk the home directory
**Triggered by:** `validate-config.mjs` hung scanning the home directory
**Rule:** when walking parent directories looking for a project root, stop at
the home directory and only accept directories that look like a project
(`package.json`, `.git`, `.opencode`). Bound recursion depth and file counts.
**Status:** promoted -> fixed in opencode-config-authoring/scripts/validate-config.mjs (2026-09-30)

### 2026-09-30 — Vendored skills may assume tools that do not exist here
**Triggered by:** `skill-creator` invokes `claude -p` and bash `nohup`/`kill`
**Rule:** when vendoring third-party skills, check their external dependencies
and note in the local skill which parts cannot run in this environment, so the
agent does not confidently emit a command that will fail.
**Status:** promoted -> skill-authoring/SKILL.md "Related" section (2026-09-30)

### 2026-09-30 — Files and dependency graphs have hard budgets
**Triggered by:** user request to write a skill covering code standards and a
ban on bloating files and libraries
**Rule:** file 300 target / 500 hard, function 30 / 50, nesting 3, new
dependency 0 without asking. Crossing the hard limit means more than one
responsibility — that is the real signal, the number is only the alarm.
**Status:** promoted -> code-discipline/SKILL.md (2026-09-30)

### 2026-09-30 — Duplicated prose is bloat, even when the duplication is requested
**Triggered by:** my own README in this repo, which carried the same three
paragraphs of install instructions three times for RU/EN/UZ, ~190 lines to say
what ~70 lines say once
**Rule:** one canonical body, then per-language files that link to it. Review
cost and drift both scale with the number of copies, and a copy that is edited
without its siblings silently rots.
**Status:** promoted -> code-discipline/SKILL.md, "The prohibition" (2026-09-30)


### 2026-09-30 — Temp-profile browser runs still write REAL runtime state
**Triggered by:** BionicFirefoxEngine persistence probe on a `tempfile.mkdtemp()`
profile overwrote `Data/Runtime/aris_firefox_session.json` (pages -> []) and
rewrote `Data/Runtime/social_sessions_cookies.json`, leaking a probe cookie into
Vlad's real aggregate jar.
**Rule:** the profile dir is per-instance, but `SESSION_STATE_PATH` and the
`save_cookies_backup` target are MODULE-LEVEL CONSTANTS pinned to Data/Runtime.
Passing a temp `profile_dir` does NOT sandbox the writes. Before any live-browser
probe: (1) grep the engine for module-level path constants, (2) monkeypatch them
to the temp dir, (3) verify afterwards that real runtime files were untouched, or
(4) copy the jars and diff. "Throwaway profile" is not a sandbox.
**Status:** queued
