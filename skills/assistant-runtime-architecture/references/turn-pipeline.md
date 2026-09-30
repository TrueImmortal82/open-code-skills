# The turn pipeline — durability, delivery, projection

## The spine

```
inbound update
  -> runtime intake
  -> agent_loop.start_run            -> (run_id, candidate_text)
  -> output contracts (soft repair)  -> response_text
  -> turn_transaction.prepare_delivery   # persists tx.response_text
  -> delivery (gateway send, optional voice)
  -> turn_transaction.complete_delivery
  -> _project_assistant_history          # messages.content = tx.response_text
```

## Acknowledge only after the commit

The inbound update is **not** acknowledged until its transaction is durably
persisted. A durability error aborts the run loudly rather than acking and
hoping.

State machine per run:

| State | Meaning | Crash recovery |
| --- | --- | --- |
| `received` | update seen, nothing generated | replayable |
| `generated` | text exists, not delivered | **replay and deliver** |
| `delivered` | send succeeded, not projected | project only, do not resend |
| `completed` | projected | terminal |

Recovery replays `generated` runs. It must not resend `delivered` ones — that
produces duplicate messages in the user's chat, which is worse than a lost one
from the user's point of view. This is the single most important invariant in
the whole pipeline: **exactly-once delivery**, achieved with at-least-once
plumbing plus an idempotency key per run.

## Projection is authoritative

`messages.content` after `complete_delivery` MUST equal `tx.response_text`
byte for byte. `_project_assistant_history` is the only writer.

### Lesson: never sanitize stored rows

Incident, 2026-08-12: a background sanitizer rewrote the last 100 assistant
messages every 5 minutes with regex word mutations (a feminine-self-reference
enforcer plus a masculine-addressing enforcer). It corrupted *correctly
enforced* text — «полностью с тобой согласна» → «согласен», «вопрос был» →
«была» — so the model's own in-pipeline repairs appeared to be "floating",
unexplained, and unfixable.

Rules:

- No DB-wide or periodic regex word-mutation over stored messages, ever.
- Heuristic rewrites are not just risky, they are **unreviewable**: you cannot
  see what a background job did to yesterday's conversation.
- Regex word mutation also breaks natural speech and quoted text. The
  feminine-self-reference word rewriter is disabled in the contract pipeline for
  this reason.
- If output is wrong, fix it at write time in the pipeline, where the diff is
  logged and reviewable.

## Backfill, if you must

If historical rows are genuinely wrong, repair them with a **one-shot,
reviewed, dry-run-first** script that:

1. prints every row it would change with a token-level diff,
2. refuses to run unless the dry run output is explicitly approved,
3. applies each change inside a transaction, batching by id,
4. is itself idempotent, so a re-run is a no-op.

Never run it on a schedule.

## Ordering with voice

Voice delivery happens after the text commit and before completion. A voice
failure must not roll back the text — record `voice_state=failed` on the run
and continue. The reverse (text only after voice succeeds) loses the reply
whenever TTS is down.

Re-running delivery after a crash must skip voice if the audio was already
written; check the artifact, not just the flag.
