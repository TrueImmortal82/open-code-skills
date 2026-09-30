---
name: assistant-runtime-architecture
description: Architecture and debugging runbook for a long-lived personal/companion AI assistant — GUI supervisor + runtime child over a stdin pipe (QProcess, supervisor_lost), durable turn/delivery transactions with prepare_delivery/complete_delivery and message projection, output contracts and voice/TTS (subprocess stdin=DEVNULL), and morphological Russian gender enforcement via pymorphy3 clause stacks. Use when designing an assistant runtime, wiring a supervisor to a child process, adding durable message delivery, building output post-processing, or debugging stored-history corruption, spurious shutdowns, or gender/addressing errors («согласен» vs «согласна») in a Russian-language assistant.
---

# Assistant runtime — architecture & debugging runbook

A production assistant of this shape is three tiers: a **supervisor GUI**, a
**runtime child process**, and a **messaging gateway**. Most production
incidents in this design come from four places, each documented below with the
rule that prevents it:

| Failure | Rule | Detail |
| --- | --- | --- |
| Child dies seconds after a voice reply | every nested subprocess must detach stdin | `references/process-topology.md` |
| Reply stored, then changed by a background job | stored rows are append-only; the pipeline owns content | `references/turn-pipeline.md` |
| Model calls itself masculine, then "the fix" breaks correct text | repair only trusted frames; keep repairs idempotent | `references/russian-gender-contract.md` |
| «согласен» flips to «согласна» at random | inspect the live pipeline and projection first, never the corpus | `references/diagnostics.md` |

Read the relevant reference before changing runtime code. Each one ends with the
incident that produced the rule.

## Diagnostic order (use this first)

When an output bug appears, walk top-down and stop at the first divergence:

1. **Candidate text** — log the raw model output before any post-processing.
2. **Contract layer** — what did the output-contract pipeline change, and why?
   Log a token-level diff of every rewrite.
3. **Turn transaction** — is `tx.response_text` the same string as step 2's
   result? A mismatch here is a serialization or mutation bug.
4. **Projection** — is `messages.content` byte-identical to
   `tx.response_text`? If not, something is rewriting stored rows. That is
   almost always the bug. Do **not** go read the corpus.
5. **Only then** the corpus — to measure blast radius, never to guess a cause.

Background jobs that mass-rewrite stored messages with heuristics are the
prime suspect for "the text is wrong at rest but right in the log". If a
rewrite is not idempotent and not anchored to a specific known-bad message,
delete it. See `references/turn-pipeline.md`.

## Hard rules

- **Durability before acknowledgement.** Never ack an inbound message until its
  transaction is committed. Recovery must be able to replay
  generated-but-undelivered runs.
- **The projection is authoritative.** `messages.content` is written once, from
  the committed transaction, verbatim.
- **No regex word-mutation over stored text.** Heuristics that rewrite words
  corrupt natural speech and quoted text.
- **Repairs are idempotent.** `f(f(x)) == f(x)` must hold for every output
  transform. Assert it in tests.
- **Every incident ends with a regression test** named after the failure, plus a
  note in the project's agent instructions. Do not re-enable removed behavior
  without its guard.

## Reference map

- `references/process-topology.md` — supervisor/child split, death detection,
  event stream, the stdin-inheritance trap, secrets handling.
- `references/turn-pipeline.md` — the turn spine, durable transactions,
  prepare/complete delivery, projection, recovery.
- `references/output-contracts.md` — contract pipeline layers, soft vs hard
  violations, repair dispatch.
- `references/russian-gender-contract.md` — pymorphy3-based morphological
  gender, clause-stack tracking, strict mode, repair guards, known false
  positives.
- `references/diagnostics.md` — corpus auditing, idempotency checks,
  regression-test discipline.
- `references/reference-implementation.md` — a worked example codebase mapping
  each pattern above to real files, for when you want a concrete reference.
