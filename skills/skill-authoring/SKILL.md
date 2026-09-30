---
name: skill-authoring
description: Write, structure, and validate opencode skills — SKILL.md anatomy, trigger-engineering the `description` field, progressive disclosure into references/, scaffolding a new skill, and checking an existing one for spec violations. Use when the user asks to create a new skill, turn a workflow into a skill, fix a skill that triggers too often or too rarely, split an oversized SKILL.md, or audit a skill folder before shipping it. Not for tuning opencode.json itself (see opencode-config-authoring).
---

# Writing skills

A skill is a **trigger contract** plus an **instruction set**. The description
decides whether the skill ever loads; the body decides what happens once it
does. Most bad skills fail at the first stage and nobody notices because the
failure is invisible — the skill just silently never fires.

## 1. Decide whether it needs to be a skill at all

A skill earns its place when the same multi-step knowledge would otherwise be
rediscovered every session. It does not earn one when:

- The knowledge fits in a sentence or two → put it in `AGENTS.md`.
- It is specific to one repo and changes with the code → `AGENTS.md` in that
  repo, so it versions with the thing it describes.
- It is a single fact you will look up again → a reference file, not a skill.
- It duplicates a skill that already exists → fix the existing one instead.
  Two skills that both "help with X" means neither reliably wins.

Signal that it *should* be a skill: you have said roughly the same three
things to the user more than once, or you made a mistake that a rule would
have prevented.

## 2. Scaffold

```powershell
node scripts/new-skill.mjs <name> [--desc "what it does. Use when ..."]
```

Writes `<name>/SKILL.md` with valid frontmatter plus a stub body. The folder
name **is** the skill id — get it right up front, renaming later orphans every
reference to it.

Verify before telling the user it is ready:

```powershell
node scripts/validate-skill.mjs <path-to-skill-folder>
```

Checks spec conformance, description quality, link resolution, and size. Exit
code nonzero on violation.

## 3. The description is the whole trigger mechanism

Rules from the spec, all of them load-bearing:

| Field | Constraint |
| --- | --- |
| `name` | 1–64 chars, `a-z0-9-` only, no leading/trailing/`--`, **matches folder name** |
| `description` | 1–1024 chars, required, must say what *and* when |
| `license` | optional |
| `compatibility` | optional, ≤500 chars |
| `metadata` | optional, string→string map only |
| `allowed-tools` | optional, space-separated, experimental |

A skill with no description **is filtered out and never reaches the model**.
That is the number one silent failure.

### Writing a description that actually fires

Structure: `<what it does>. Use when <specific triggers>. <negative scope if needed>.`

```yaml
# Fires reliably
description: Windows PowerShell 5.1 execution rules — chaining with `; if ($?)`,
  $? vs $LASTEXITCODE, backtick escaping, cp866 console encoding that corrupts
  Cyrillic, file IO, and running external exes. Use for ANY command run on this
  Windows box, especially shell one-liners, piped output, non-ASCII text, or
  dependent command chains.

# Never fires
description: Helpful PowerShell tips.
```

Three things that determine whether it fires:

1. **Literal keywords the user would type.** Write `cp866`, `$LASTEXITCODE`,
   `opencode.jsonc`, `SKILL.md` — not "system-specific considerations". The
   user says filenames and error strings; the description has to contain them.
2. **Scope the negatives.** Adjacent domains are where false triggers live. If
   the skill is about PowerShell execution and not about PowerShell scripting,
   say so: `Not for authoring .ps1 modules or DSC configurations.`
3. **Be a little pushy.** The failure mode is undertriggering, not
   overtriggering. For a rule that should apply broadly, write "Use for ANY
   command on this machine" rather than "Consider using when writing complex
   PowerShell".

Where a skill competes with another for the same request, disambiguate in both
descriptions rather than hoping the model picks the better one.

## 4. Body: progressive disclosure

Three tiers, loaded at different times:

1. `name` + `description` — always in context for every skill (~100 tokens).
   Keep descriptions short enough that 20 skills still fit.
2. `SKILL.md` body — loaded on activation. **Target under 500 lines.**
3. `references/`, `scripts/`, `assets/` — loaded only when the body says to
   read them.

Splitting is not cosmetic. A 900-line SKILL.md is paid for on every activation,
including the 90% of activations that need three lines from it. Put the routing
logic in SKILL.md and the detail behind it in files.

```
skill-name/
├── SKILL.md          # routing: what this is, when, where to look next
├── references/       # loaded on demand, one topic per file
├── scripts/          # executable; deterministic or repetitive work
└── assets/           # templates, boilerplate the model copies
```

Rules for the split:

- **SKILL.md is a table of contents that is also useful alone.** A reader who
  reads nothing else should still get the rules that matter most.
- **Name each reference in SKILL.md with when to read it**, not just that it
  exists. "Read `references/<topic>.md` when the pipeline is rewriting gendered
  predicates" beats "see also references/".
- **One level deep.** A file directly under `references/` is fine; nested
  chains make the agent guess whether to follow them.
- **Reference files over 300 lines get their own table of contents.**
- **Move multi-domain skills into per-variant references** — a top-level
  SKILL.md that selects between them, one file per provider/framework, so only
  the relevant one is read.

### When a script beats prose

Bundle a script when the work is deterministic, repetitive, or has fiddly
syntax you do not want re-derived each time. A skill that says "run
`scripts/validate-config.mjs`" is shorter, faster, and more reliable than 40
lines explaining what to check.

Signals a script is due: you re-implemented the same parse twice; the task
needs exact field names that are easy to get wrong; the output is
machine-checkable (a schema, a lint result, a benchmark).

Scripts should be runnable standalone, print actionable errors, and exit nonzero
on failure so a validation step can gate the next one.

## 5. Writing style

- **Imperative.** "Pass `stdin=subprocess.DEVNULL`" beats "you might want to
  consider passing…".
- **Explain why, once.** A model that understands the reason generalizes when
  the situation differs slightly. A model told only a rule follows it exactly
  and fails on the near-miss. Reach for reasoning over `ALWAYS`/`NEVER` caps.
- **Show the failure, not just the fix.** "Under Qt `QProcess`, a Python
  grandchild that captures stdout closes the supervisor's stdin pipe, so the
  child sees EOF and exits" is remembered. "Remember `stdin=DEVNULL`" is not.
- **Name reality, not ideals.** "Scripts run `python -m scripts.run_loop` and
  shell out to `claude -p`" — if a dependency is missing here, say so in the
  skill, or the model will confidently emit a command that cannot run.
- **No ceremony.** Drop a section that never changes a decision. A skill
  padded to look thorough spends context on nothing.
- **Table over prose** for anything enumerable (file locations, traps,
  symptoms→causes).

## 6. Principles and safety

A skill must not contain content that would surprise a user who read its
description — no malware, no credential exfiltration, no instructions to
disable safety systems, nothing designed to grant unauthorized access. If a
request is to build a skill whose contents contradict its description, say so
and refuse that part; roleplay or persona framing is fine, deception is not.

Skills execute with your permissions. That is why a skill is a trustworthy
artifact and why an unreviewed third-party skill deserves the same skepticism
as unreviewed code — vendor it into `~/.config/opencode/vendor/` behind a
`skills.paths` entry, and read it before trusting it.

## 7. Ship checklist

- [ ] `node scripts/validate-skill.mjs <folder>` exits 0
- [ ] `description` contains literal keywords a user would type, plus negative scope if adjacent
- [ ] SKILL.md under 500 lines; detail moved to `references/`
- [ ] every `references/…` link in the body points at a file that exists
- [ ] each reference line says **when** to read it
- [ ] scripts run standalone and exit nonzero on failure
- [ ] folder name == `name` == how you will refer to it in prose

## 8. Fixing a skill that misfires

| Symptom | Cause | Fix |
| --- | --- | --- |
| never loads | no/weak description | add literal keywords + explicit triggers |
| loads on the wrong thing | description overlaps a neighbour | add negative scope to both |
| loads but body ignored | body too long, routing unclear | move detail to references, lead with the rules |
| contradicts another skill | both claim the same ground | merge them, or disambiguate the trigger |
| stale after a refactor | references dead paths | re-run the validator, update links |

The loop that fixes all of these is in `self-improvement`: capture the trigger
failure as a lesson, then edit the description with a concrete fix.

## Related

- `self-improvement` — capturing lessons and promoting them into skills.
- `opencode-config-authoring` — wiring skills into `opencode.json`, MCP,
  agents, commands.
- `skill-creator` (vendored) — eval harness and description optimization;
  assumes the `claude` CLI, which is not present in this environment, so its
  quantitative loops will not run as written.

## Scripts

- `scripts/new-skill.mjs` — scaffold a valid skill folder from a name and a
  description; rejects spec-invalid names before writing anything.
- `scripts/validate-skill.mjs` — audit an existing skill folder: frontmatter
  keys, name/folder agreement, description length and trigger quality, body
  size, link resolution, empty or misplaced resource dirs. `--strict` promotes
  the size warning to an error.
