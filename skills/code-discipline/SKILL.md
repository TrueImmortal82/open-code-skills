---
name: code-discipline
description: Code standards and hard size budgets - match the file's existing conventions, no speculative abstractions, and a prohibition on growing files or adding dependencies beyond what the task needs. Use when writing, reviewing, refactoring, or splitting source code; when the user says too long, bloated, bloat, fat, refactor, extract, clean up, split the file; or when touching `package.json`, `pyproject.toml`, `utils.ts`, or deciding whether to add a library or dependency. Not for formatter and linter configuration, and not for API or database schema design.
---

# Code discipline

Writing code that stays small enough to still be understood in a year. Two
halves: **standards** for how to write, and **hard budgets** for how big
anything is allowed to get.

The budgets are a prohibition, not a guideline. Exceeding them is a defect to
fix, the same way a failing test is.

## The budgets

| Thing | Target | Hard limit — must split |
| --- | --- | --- |
| Source file | 300 lines | 500 lines |
| Function or method | 30 lines | 50 lines |
| Nesting depth | 3 levels | 4 levels |
| Positional parameters | 4 | 6 |
| `SKILL.md` | 300 lines | 500 lines |
| New dependencies in a task | 0 | ask the user first |
| README language copies of the same prose | 1 canonical | 3 copies is a bug |

The target is where you *split by choice*. The hard limit is where you *stop
and split by force*. A file at 480 lines is not acceptable because it is under
500 — it is on its way to 800 and everyone knew it was coming.

Hitting a hard limit means the thing has more than one responsibility. That is
the real signal, and the number is only the alarm.

## Standards

1. **Local convention beats global rule.** Read the file and two neighbours
   before writing a line. If they use `x = x || y`, use that — not `x = x ?? y`
   because it is more correct. A drive-by style upgrade in an existing file is
   a defect: it buries a semantic change inside a cosmetic diff and makes the
   reviewer check both.
2. **No speculative generality.** One call site means no wrapper, no interface,
   no factory, no config flag. Add the abstraction when the second call site
   exists and you can see what the shared shape actually is. Guessing the shape
   wrong costs more than the duplication did.
3. **Errors stay visible.** No empty `catch`, no bare `except: pass`, no
   silent default, no `try` that swallows and continues. If a failure genuinely
   may be ignored, log it somewhere a human will see it and say so in a comment.
   A swallowed error is a bug that reports itself as working code.
4. **Delete, do not memorialize.** Commented-out code is dead weight; git
   remembers it. Comment the *why*, never the *what* — the what is the code.
5. **Refactor and behaviour change never share a change.** A commit that both
   restructures and changes behaviour hides which of the two caused the
   regression, and you cannot revert one without the other.
6. **Validate at the edge, trust inside.** Parse and check once at the
   boundary. Re-validating the same value three layers down is defensive noise
   that hides where the real contract is.

## The prohibition

Do not do these, even when each feels locally reasonable:

- **Do not grow a file past its limit to avoid creating a module.** The split
  costs ten minutes now; not splitting costs an archaeology dig later.
- **Do not create a `utils` / `helpers` / `common` bag.** Those names mean the
  ownership boundary was never found. Split by domain instead — two
  `text_utils`-shaped files beat one `utils.ts` that collects whatever had
  nowhere else to go.
- **Do not add a dependency for something the standard library does.** Check in
  order: standard library → already a transitive dependency → five lines
  yourself. Only then consider a package, and ask before adding it.
- **Do not vendor a third-party repo into the product tree.** If vendoring is
  genuinely required, put it in a marked directory, pin the version, keep the
  licence, and keep it out of the modules you edit by hand.
- **Do not add a config option with one consumer.** Config is a public API;
  every option is a promise to keep it working forever. Add it when the second
  consumer exists.
- **Do not mirror one body of prose in several languages inside one file.**
  Trilingual means three times the review cost and three places to drift apart.
  One canonical file, then per-language files that link to it.
- **Do not leave "for later" branches, unused exports, or flags nobody reads.**
  `TODO` in a comment is allowed; dead code in the tree is not.
- **Do not refactor code the task did not touch.** It turns a five-line fix
  into a diff nobody reviews.

## Smells and what they actually mean

| Symptom | Real cause | Action |
| --- | --- | --- |
| File only ever grows | no module boundary | extract the cohesive part by domain |
| `utils.ts` over 200 lines | mixed ownership | split by domain, delete the bag |
| Wrapper with exactly one caller | premature abstraction | inline it |
| Package for a five-line job | reach for a library | write the five lines |
| Option with exactly one consumer | speculative config | delete until needed |
| Large commented-out block | fear of losing code | delete; git remembers |
| Same prose three times over | translation by copying | one canonical + per-language files |
| Function over 50 lines | several responsibilities | extract the part that has its own name |
| Test that asserts the mock | testing the test double | assert observable behaviour |

## Exemptions

Generated code, vendored code, migrations, and large data fixtures are exempt
from the budgets — but only inside a directory named `vendor`, `generated`, or
`migrations`, so a reviewer can tell at a glance what is not hand-maintained.
Never mix generated output into hand-written files: the next person cannot tell
which lines to edit, and the next generator run overwrites them.

## Machine check

```powershell
node scripts/check-size.mjs <dir> [--max-lines 500] [--warn-lines 300] [--max-deps 40]
```

Walks a tree, skips `node_modules` and the exempt directories, prints files over
the warning line sorted worst-first, reports the direct dependency count, and
exits nonzero when anything crosses the hard limit. Wire it into a pre-commit
hook or CI so the budget is enforced rather than remembered.

## Checklist

- [ ] Followed the file's existing conventions rather than a better standard
- [ ] No file over the hard line; nothing left one edit away from it
- [ ] No function, wrapper, or config option with a single consumer
- [ ] No new dependency without asking; stdlib was not enough
- [ ] No `utils`-style bag created
- [ ] Errors surface instead of being swallowed
- [ ] Behaviour change and refactor are separable
- [ ] `node scripts/check-size.mjs .` exits 0

## Related

- `skill-authoring` — the same budget discipline applied to skills; use it
  before writing a new skill, since this one governs code, not prose.
- `self-improvement` — a "this file grew past the limit" incident is a lesson
  to capture here, not a rule to remember mentally.
- `powershell-windows` — a bloated script is often a script that should be a
  sequence of typed commands instead.
