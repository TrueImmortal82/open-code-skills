---
name: test-first-fix
description: Prove a fix by making the failure observable before changing code. Use when fixing a bug, or changing existing behaviour; when deciding whether a test is worth writing and which one; when a test passes both before and after the change; when reviewing a diff and wondering what would catch a regression; or when a command returns exit 0 but printed nothing. Ships scripts/repro-check.mjs, which reports whether a command matched `--expect-fail` or `--expect-ok`, and can require a minimum `--min-bytes` or a `--require` substring.
---

# Test first, then fix

A fix is a claim: "this was the cause, and this resolves it." Before the edit,
turn that claim into something a machine can disagree with. If you cannot make
the failure appear, you do not yet know what you are fixing.

## When to use this

- Fixing a bug, or changing behaviour other code already depends on.
- Deciding whether a change needs a test, and which one.
- A test passes both before and after your change, so it proves nothing.
- Reviewing a diff and asking what would catch a regression.
- A command exits 0 but produced no output, and you assumed it worked.

## The order

1. **Reproduce first.** Find the smallest input that shows the wrong behaviour.
2. **Pin it.** Turn that input into a check that fails now, for the right reason.
3. **Fix.**
4. **Watch the check flip**, and confirm the reason flipped too.
5. **Keep the check.** Delete only if it cannot fail again.

Steps 1 and 2 come first because a check written after the fix is shaped by the
fix. It reproduces your reasoning rather than testing it, and it passes for
reasons you already agree with.

## Rules

1. **A check that passes before the change is not a test.** It is a smoke test
   that will not notice the regression you are about to prevent. If you cannot
   watch it fail, you have not verified that it works.
2. **Watch it fail for the stated reason.** "Red" is not enough. A check that
   fails on a typo in the test, or on a missing fixture, is red for the wrong
   reason and will mislead you. Read the failure message and confirm it names
   the defect.
3. **Test behaviour, not implementation.** Assert on what a caller observes:
   return value, output, exit code, written file. An assertion that a mock was
   called a specific number of times fails on every refactor and catches no bug.
4. **One reason to fail.** A check asserting five unrelated things reports only
   the first failure and hides the rest. Split them.
5. **Assert the seam, not the whole.** Prefer the smallest public entry point
   that still exercises the defect. A full end-to-end run to check one branch is
   slow, so it will not get run.
6. **The regression case is the test.** The valuable test is the exact input
   that broke, named after the defect, not a generic happy path added alongside.
7. **Empty output is a failure.** Exit 0 with nothing on stdout is a bug that
   reports itself as success. Treat a missing or suspiciously short output as a
   failed check even when the exit code is 0.

## Smallest useful check

Ask: what is the least code that runs the real thing and reports disagreement?

```bash
node scripts/repro-check.mjs --expect-fail --min-bytes 100 -- ./some-command
```

- `--expect-fail` — the bug must still be there.
- `--expect-ok` — the bug must be gone.
- `--min-bytes N` — catches "exited 0, printed nothing".
- `--require "<text>"` — the output must actually say the thing.
- `--timeout <s>` — default 120.

Exit codes: `0` expectation met, `1` expectation violated, `2` bad invocation.

`--expect-fail` before the fix and `--expect-ok` after is the whole discipline
in two commands. It fails loudly in the case that is easiest to fool yourself
about: a command that exits 0 and does nothing.

## Not every change needs a test

| Change | Test? |
| --- | --- |
| Bug fix | yes, the exact reproduction |
| Behaviour others depend on | yes |
| Parsing, money, permissions, migrations | yes |
| Refactor with no behaviour change | only if existing tests miss the path |
| Typo in a comment or log message | no |
| Pure rename visible in one commit | no |

Writing a test for a typo is the same error as writing none for a bug: it
spends attention where it buys nothing.

## Checklist

- [ ] Reproduced the failure before editing anything
- [ ] The check failed first, and for the reason stated
- [ ] It asserts observable behaviour, not mock calls
- [ ] One reason to fail per check
- [ ] It flipped to passing after the fix
- [ ] Kept the check, and it can still fail
- [ ] Nothing asserts only that a command exited 0
