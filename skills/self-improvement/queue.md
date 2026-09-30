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
