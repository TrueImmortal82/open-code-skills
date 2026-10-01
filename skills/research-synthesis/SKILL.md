---
name: research-synthesis
description: Turn several web sources into one answer that says which parts are confirmed, which are inferred, and which are unknown. Use when answering a question that needs more than one lookup; when sources disagree, are outdated, or are vendor marketing; when asked to research, compare, survey, or find out what changed; when summarising docs or release notes; or when a claim will be acted on and so needs a source. Ranks a `CHANGELOG` above an undated blog post, treats `package.json` and README as primary over a summary, and never counts a repeated claim as corroboration. Not for one fact a single lookup would answer.
---

# Research synthesis

Most bad research answers are not wrong in a detectable way. They are fluent,
plausible, and assembled from sources that did not actually say those things.
The defence is not more searching; it is keeping the seams visible.

## When to use this

- Answering a question that needs more than one lookup.
- Sources disagree, or are outdated, or are vendor marketing.
- Asked to research, compare, survey, or find out what changed.
- Summarising documentation, changelogs, or release notes.
- A claim will be acted on, so it needs a source someone can check.

Not for a single fact that one lookup would answer.

## Rules

1. **Separate what a source said from what you concluded.** "The docs say X" and
   "X is probably true" are different claims with different failure modes. Write
   them differently, and never upgrade an inference into a citation.
2. **A source that states something is not the same as a source that verifies
   it.** A tutorial saying a library works is one person's experience. A test
   suite or a changelog entry is closer to a fact.
3. **Prefer the most recent primary source.** The project's own docs and source
   beat a blog post about them, and a dated post beats an undated one. If you
   use a secondary source, say so.
4. **When sources conflict, report the conflict.** Do not average them, and do
   not silently pick the one that fits your answer. A disagreement between two
   sources is information about the question.
5. **Check the date and the version.** An answer about "how to do X" is only
   true for some version of something. Say which.
6. **Say what you did not find.** "No source covers this" is a finding, and it
   tells the reader whether to trust the rest. Silence reads as completeness.
7. **Cite the specific claim, not the general topic.** A link that supports one
   sentence in a paragraph is misleading if the reader assumes it supports all.
8. **Stop when the marginal source stops changing the answer.** A third source
   repeating the first two is not more confidence; it is the same claim counted
   twice, which looks like corroboration and is not.

## Shape of an answer

1. **The answer**, in one or two sentences, first.
2. **What supports it**, with sources attached to specific claims.
3. **What is uncertain or contested**, named explicitly.
4. **What is not covered**, if it came up.

Confident where the evidence is, hedged where it is not, and never the reverse.
The failure mode of this skill is hedging uniformly, which is its own kind of
dishonesty: it hides the parts you actually know.

## Judging a source

| Signal | Reads as | Treat as |
| --- | --- | --- |
| Primary docs or source | authority for current versions | strongest available |
| Changelog, release notes | what changed, and when | strong |
| Issue tracker | real bugs, real constraints | strong for limitations |
| Blog with a date | one opinion, time-bound | moderate |
| Blog without a date | unknown vintage | weak |
| Vendor comparison page | selected against the competitor | marketing, not evidence |
| Stack Overflow answer | solved something once | verify before trusting |
| AI summary of a doc | second-hand | never a source itself |

## When you cannot verify

Say what you would need: the version, a reproduction, a file, a command. An
unverified answer with a stated dependency is usable; an unverified answer
presented as verified is not.

## Checklist

- [ ] Answer stated first, then supported
- [ ] Every source attached to the specific claim it supports
- [ ] Inferences written as inferences, not as citations
- [ ] Conflicts reported rather than resolved by preference
- [ ] Version or date given where it changes the answer
- [ ] Gaps named explicitly
- [ ] Searched until the answer stopped changing
