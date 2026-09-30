---
name: self-improvement
description: The learning loop for this agent — capture a correction or failure as a durable lesson, decide whether it belongs in a skill or AGENTS.md, and promote it so the mistake does not repeat. Use when the user corrects me, says "запомни", "не делай так", "ты ошибся", "я же говорил", when a command failed in a way that was avoidable, or at the end of a session where something non-obvious came up. Triggers on being wrong, not on being asked to learn.
---

# Learning loop

An agent has no weights to update. **Learning here means writing an artifact
that the next session will read before it can repeat the mistake.** If a lesson
does not end up in a file, it did not happen.

This is the single most-skipped discipline. The user will not remember to
repeat their instructions, and neither will you. Capture the lesson at the
moment you learn it, while the specifics are still in front of you.

## The loop

```
notice  ->  capture  ->  classify  ->  promote  ->  verify
failure     lesson      where does    edit/create   regression test
             (queue)     it belong?    the artifact   or validator
```

Most of the value is in **notice** and **promote**. A captured lesson that
never gets promoted is a note to self that nobody reads.

## 1. Notice — what counts as a lesson

Capture when **any** of these is true:

- The user corrected or contradicted something I did or said.
- A command failed in a way a rule would have prevented (encoding, quoting,
  wrong tool, wrong path).
- I reached for the corpus / guessed at a cause instead of reading the code.
- I repeated a mistake already recorded somewhere.
- The user said any of: «запомни», «не делай так», «ты ошибся», «я же
  говорил», «опять», «ты забыл».
- Something took three attempts to get right for a non-obvious reason.
- A skill fired wrongly, or failed to fire when it should have.

Do **not** capture: one-off environment noise, the user's preference for this
specific task stated once, or anything you have not verified.

The bar is: *would a rule have changed my behavior, and would the rule still be
true in a month?*

## 2. Capture — write it down immediately

Append to `queue.md` in this skill's directory. It is a plain markdown file;
append it like any other file. Entry shape:

```markdown
### 2026-09-30 — piping Cyrillic through `Select-String` in PS 5.1
**Triggered by:** user correction, wrong output (mojibake)
**Rule:** use the Grep tool for non-ASCII search; never pipe cmdlet output
through `>` (us-ascii).
**Status:** pending
```

Keep it to three lines. An elaborate lesson entry does not get promoted; a
terse one does. Capture within the same session — context you do not write
down is context you lose at the next restart.

Read `queue.md` at the start of any session where a relevant topic comes up,
and always before writing a new skill: an unpromoted lesson may already cover
half of what you are about to write.

## 3. Classify — where does this lesson belong

| Destination | Use when |
| --- | --- |
| **Existing skill** | the lesson falls inside a skill's stated scope; extend it |
| **New skill** | a new coherent domain, likely to recur ≥3 times, and not already covered |
| **Reference file** | detail for a skill that exists but pushes past its 500-line budget |
| **Script** | the lesson is "this must be checked exactly"; make it machine-checkable |
| **AGENTS.md** | repo-specific or always-true, too small to justify a skill |
| **Nothing** | verified one-off; delete the queue entry |

Two tests before creating a new skill:

1. **Recurrence.** Have I hit this three times, or is it near-certain to
   recur? One-off failures do not get skills.
2. **Coverage.** No existing skill's description claims this. If one does,
   extend it — a second skill on the same ground means neither fires
   reliably.

Prefer editing an existing skill. Trigger competition is the failure mode of
skill sprawl, and every new skill costs description tokens on every session
forever.

## 4. Promote — edit the artifact

Editing an existing skill:

1. Put the rule in the **body** if it changes what the reader does; in the
   **description** if it changes when the skill fires.
2. State the *why* in one clause. A rule with a reason generalizes to
   near-misses; a rule without one is memorized literally and fails on the
   variant.
3. Show the failure, not just the fix. The concrete failure is what lets the
   reader recognize the next occurrence.
4. If the skill is heading past 500 lines, split now: move detail to
   `references/<topic>.md` and leave routing in SKILL.md.

Creating a new skill: see `skill-authoring` — scaffold with
`scripts/new-skill.mjs`, write the description with literal trigger keywords
and negative scope, validate with `scripts/validate-skill.mjs`.

Make the lesson **checkable** when it can be. A rule that a script can verify
gets enforced; a rule that only exists as prose gets forgotten. This is why the
config skill ships `validate-config.mjs` rather than a paragraph about schemas.

Then mark the queue entry `Status: promoted -> <file> (date)` and update the
index below.

## 5. Verify — did the lesson stick

A lesson is only real if the failure cannot recur silently.

- **Scripted check** — best. Extend a validator, add a lint, or turn the case
  into a test.
- **Regression test** — for code: name it after the failure, not the mechanism.
- **Reproduction prompt** — if no code is involved, restate the trigger
  condition and re-check that the skill's description now contains the
  keywords that would catch it.

If you cannot describe how you'd notice the lesson failed to apply, the lesson
is not specific enough to be promoted yet.

## Anti-patterns

| Anti-pattern | Why it loses the lesson |
| --- | --- |
| capturing into the conversation only | gone at restart; this is what "I already told you" means |
| a lesson queue nobody reads | promote at capture time when it's a single obvious fix |
| one new skill per incident | triggers compete, descriptions rot, context cost is permanent |
| capturing unverified guesses | the "lesson" teaches a wrong rule, which is worse than none |
| editing a skill without re-running its validator | broken links and bad frontmatter ship silently |
| restating the incident instead of the rule | a rule needs to be actionable without the story |
| upgrading an old incident by speculation | check the code first; the code may already have changed |

## Queue index

Read `queue.md` before starting work in a familiar area — it may already
contain the answer, and promoting it is cheaper than rediscovering it.

Promoted lessons live in the skills themselves. This skill holds the loop, not
the accumulated content: when it gets long, the content belongs in a
`references/` file and this body should be the procedure.
