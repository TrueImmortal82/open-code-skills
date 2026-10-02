---
name: task-closure
description: Deciding that a task is finished instead of continuing to improve it, using stop conditions agreed before the work starts. Use when work looks done and the pull is toward one more refactor, edge case, or abstraction; when the user asks "is it done", "is it ready", "can I ship", or "should I polish"; when a change has grown past the original ask or touched files the request never mentioned; when wrapping up a session or handing work off; or before making any completion claim. Includes a four-question done test, the rule that a passing gate means stop rather than continue, the anti-rationalizations for "while I'm here" and "it's a small change", and what belongs in a follow-up instead. Not for judging whether a technical approach is correct — use code-discipline or test-first-fix for that.
---

# Task closure

The failure this prevents is not doing too little. It is never declaring done,
so a good change turns into a long tail of small improvements that each add risk
to the part that already worked. The fix is a **stop condition agreed before the
work starts**, checked at the end.

## When to use this

- The stated task is met, and something suggests it could be a bit better.
- The change has touched files the request never mentioned.
- A fix is in and working, and the next idea is hardening, not correctness.
- You are about to hand off, wrap up, or ship and want an honest verdict.

## The done test

Answer all four. Any *no* means the task is not done — and any *no* that names
scope you were never asked for is a **stop**, not a task.

1. **Asked for.** Every change traces to something the user asked for, or to a
   failure a check actually produced.
2. **Verified.** The thing runs, or the failure is reproduced. Not "should work".
3. **Whole.** No half-migrated caller, no feature flag left permanent, no `TODO`
   standing in for the step that was the point of the task.
4. **Reviewable.** Someone else could read this diff and see why each hunk is
   there.

## Stop conditions

Stop and report when any of these is true, even if the work could go further:

| Signal | What it means | Action |
| --- | --- | --- |
| The gate passes | the check you set out to fix now passes | done — extra polish is unrequested scope |
| The next change is separable | it fixes nothing, only improves | name it as a follow-up, do not do it |
| It needs a decision only the user can make | a tradeoff, a preference, a name | ask, do not guess silently |
| It touches unrelated files | the change has outgrown its request | stop; split or discard |
| Cost rose above value | more effort than the bug was worth | report the ceiling, let the user choose |

The one to internalize: **a passing gate is a stop signal, not a green light.**
The gate exists to say when the job is over. Passing it twice is not progress.

## What belongs in a follow-up, not this change

- Second and third call sites of an abstraction you just extracted.
- Error paths for conditions the caller cannot produce yet.
- Performance work with no measurement behind it.
- Naming and layout churn in code you only touched once.
- Anything that would have its own commit message.

These are not defects. Writing them down is the deliverable; writing them is not.

## The three failure shapes

| Shape | What it looks like | Fix |
| --- | --- | --- |
| **Perfectionism** | "while I'm here" edits nobody asked for | revert them; they belong in a commit of their own |
| **Specification drift** | solving a bigger, imagined problem | restate the original ask, cut to it, note the rest |
| **Unverified closure** | reporting done on code never run | reproduce the failure, then fix it, then re-run |

The third is the dangerous one. The first two waste time; the third ships a
break and calls it a win.

## Closing honestly

A completion report has three parts, in this order:

1. **What changed** — one line per commit or hunk.
2. **How it was verified** — the exact command and its result. If there was no
   verification, say so in those words.
3. **What was deliberately left** — the follow-ups, and why they are not here.

Never report done with a caveat in the same sentence as the claim; put the
caveat in part three where it is a fact rather than a hedge. "Done, though I
could not verify it" is not a verdict.

## Anti-rationalization

- "It's a small change" — small changes are how diffs become unreviewable.
- "It's obviously correct" — then it needs no new test, and no new code either.
- "The user will want it" — ask; that is one sentence, not an extra commit.
- "I'd do it that way anyway" — that is a separate task, not a freebie.
- "I'll clean it up first" — you are now in the long tail you are avoiding.

## Checklist

- [ ] Done test answers yes four times
- [ ] Every hunk traces to the request or to a real failure
- [ ] No gate-driven polish; follow-ups named rather than written
- [ ] Verification command and result stated explicitly
- [ ] Unverified work reported as unverified
- [ ] Stop condition reached, or the user asked for more

## Related

- `code-discipline` — budgets that tell you a thing is too big, and the split
  that follows. Read it when "one more refactor" is on the table.
- `release-checklist` — the gates to run before a change leaves the machine.
- `test-first-fix` — proving a fix before claiming it; the done test's step 2.
- `long-task-continuity` — persisting the next step when the task is not done
  yet and genuinely continues into another session.