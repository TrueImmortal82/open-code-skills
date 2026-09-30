# Diagnostics & regression discipline

## Every incident ends with a guard

1. A regression test named after the failure, e.g.
   `test_strict_mode_postpositive_adjectives_are_not_paired_forward`.
2. A note in the project's agent instructions (`AGENTS.md` or equivalent)
   recording the rule the test enforces.
3. The removed behavior stays removed. Do not re-enable it "temporarily"
   without its guard — that is how the same incident returns with a new name.

Name tests after the *failure*, not the mechanism. A test called
`test_parse_adjective_pairs` tells you nothing six months later;
`test_postpositive_adjective_not_paired_forward` tells you exactly which
production bug prevents its removal.

## Reading logs for this system

| Log line | Means |
| --- | --- |
| `supervisor_lost` | the child saw stdin EOF it did not expect — check nested subprocess stdin first |
| `contract.rewrite` | a soft violation was auto-corrected; `diff` field shows exactly what changed |
| `contract.detect` | a violation was detected and deliberately **not** rewritten (strict mode) |
| `contract.hard_violation` | regeneration budget consumed; check whether a degraded candidate shipped |
| `turn.state` | state transition; `replayed=true` marks recovery-driven delivery |
| `projection.mismatch` | stored text diverged from the transaction — treat as data-loss incident |

Two logs, in this order, answer most questions:

- Runtime **stdout** — event stream, contract diffs, turn states.
- Runtime **stdout log file** — survives supervisor crash; this is where
  `supervisor_lost` shows up after the pipe is gone.

## Corpus audit procedure

Run when a transform's behavior is in question, not when text "looks" wrong.

1. Snapshot. Take a copy of the messages table. Audits mutate.
2. Run the contract over all assistant messages, in a dry run, no writes.
3. Diff token-by-token and classify every change:
   - `should-have-changed` — the stored text was genuinely wrong
   - `false-positive` — the enforcer is wrong (fix the enforcer)
   - `already-correct-but-mutated` — non-idempotent transform; find the
     double-application
   - `cosmetic-only` — whitespace/punctuation normalization, safe
4. Check idempotency: `f(f(x))` vs `f(x)` for the whole corpus. Any
   difference is a bug regardless of classification.
5. Report counts by class **before** touching anything.
6. Only then decide: fix the enforcer, or one-shot repair the rows per the
   dry-run rules in `turn-pipeline.md`.

A healthy enforcer on already-correct text yields **zero mutations**. If your
audit reports thousands of mutations on text you believe is correct, the
enforcer is broken — stop, do not repair the rows.

## Things that look like output bugs but are not

- the model ignoring instructions → not a contract bug; it is a prompt issue.
- correct text in logs, wrong text in chat → projection or gateway bug, not
  contract.
- correct text before restart, wrong after → a startup-time migration or
  sanitizer, not the pipeline.
- wrong only in one group chat → scope dispatch bug (owner-private vs
  group-owner).
- wrong only after a crash → recovery replay double-applying a repair.

## Performance

- Contract transforms run per message on the hot path. Profile before
  optimizing; `pymorphy3` parse caching by word is usually the whole win.
- Keep a module-level parse cache keyed by lowercase word. Parses are pure.
- Bounded transforms: skip above a length cap rather than regexing 200kB.
