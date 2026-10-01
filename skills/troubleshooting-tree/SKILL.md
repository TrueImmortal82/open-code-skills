---
name: troubleshooting-tree
description: Narrow an unknown failure to a cause by halving the space of candidates, instead of guessing fixes. Use when something is broken and the cause is not yet known; when several hypotheses compete; when the same error appears in several places; when a workaround worked but revealed nothing; or when deciding which version, file, environment, or config value to check next. Ships `scripts/bisect-check.mjs`, which probes an ordered candidate list with `--candidates` and `--probe`, refuses a non-monotonic property, and reports the last good and first bad candidate. Not for a known bug that just needs a fix, which is test-first-fix.
---

# Troubleshooting tree

Debugging without a method is a sequence of guesses, and each guess that fails
feels like progress. Bisection is different: it converts "I do not know where the
bug is" into a number of questions, and each question eliminates half of what
is left.

## When to use this

- Something is broken and the cause is not yet known.
- Several hypotheses are competing and none has been ruled out.
- The same error appears in several places, so it is probably upstream.
- A workaround worked but revealed nothing about the cause.
- Deciding which version, file, environment, or config value to check next.

Not for a bug whose cause you already know. That is a fix, not a search.

## Rules

1. **Order the candidates before probing.** A bisection over an unordered set
   produces a boundary that means nothing. Versions ascend, files go from
   subsystem to symptom, configs from default to customised.
2. **The probe must be a yes/no question about one property.** "Does it still
   fail?" is a probe. "Is it the parser?" is not, unless it isolates the parser.
3. **Check that the property is monotonic across the list.** If the extremes
   behave the same, the list is not ordered by that property, and narrowing with
   it would confidently report nonsense. The script tests this first, before
   probing anything else.
4. **Reproduce exactly, not approximately.** A probe that sometimes fails
   bisects noise. Confirm the failure is reliable before trusting a boundary.
5. **Start at the boundary, not at a fix.** Two adjacent candidates that differ
   is a diff you can read. A candidate that "seems related" is a story you are
   telling yourself.
6. **Keep a written list of eliminated hypotheses.** Memory drops them silently,
   and the third cycle through the same ideas looks like the first.
7. **Change one variable at a time.** Two differences between the good and bad
   candidate make the boundary useless: you learn that something in that pair
   matters, and nothing about which.
8. **A contradiction is a gift, not an interruption.** When a measurement
   refuses to fit the working theory — "git could not allocate 1 MB while 22 GB
   of commit was free" — that fact points directly at the next hypothesis.
   Noting it and continuing down the list throws the pointer away. Evidence
   against your conclusion outranks evidence for it, and it becomes the next
   step before any lower-priority candidate.
9. **Read the resource a message names, and the one it hides.** `fatal: Out of
   memory, malloc failed` names memory, but Windows returns it when a write
   cannot be backed by *disk* either. When a subprocess reports exhaustion,
   check both resources before believing it: free space on every volume, and
   commit headroom. If both are ample, trust neither noun in the string.
10. **A bisection finds where, not why.** Knowing the file does not tell you the
    defect. That is the next task, and it is `test-first-fix`.

## Bisecting

```bash
node scripts/bisect-check.mjs --candidates <a,b,c> --probe <cmd> [--json]
```

The probe runs once per candidate and must exit `0` for good, nonzero for bad.
The candidate arrives both as `argv[1]` and as `BISECT_CANDIDATE`, so the same
probe works for a version, a commit, a file, or a config value.

Exit codes: `0` narrowed, `1` property not ordered along the list, `2` bad usage.

The probe is checked against both extremes before anything else. If they agree,
the run stops and says so, because a boundary derived from a non-monotonic
property is a confident wrong answer rather than a useless one.

Sixteen candidates take four probes. Linear search takes sixteen, and the point
is not the arithmetic — it is that each probe is a fact, and four facts locate
the boundary.

## Bisecting by hand

When the script does not apply, the method is the same:

1. Write the candidate list in order.
2. Probe the midpoint.
3. Keep the half that still contains the boundary.
4. Repeat until one candidate remains, then diff it against its neighbour.

`git bisect` automates this for commits and is the right tool when the property
is a build or test result.

## When there is no ordered list

Some faults have no sequence to bisect: a race, a load-dependent bug, an
interaction between two systems. For those, vary one dimension at a time and
hold the rest fixed, and expect a worse search. Say so rather than pretending
the bisection applies.

## Checklist

- [ ] Candidates ordered before probing
- [ ] Probe answers one yes/no question about one property
- [ ] Property confirmed monotonic across the list
- [ ] Failure reproduced exactly, not approximately
- [ ] Started at the boundary and read the diff
- [ ] One variable changed at a time
- [ ] Eliminated hypotheses written down, not remembered
