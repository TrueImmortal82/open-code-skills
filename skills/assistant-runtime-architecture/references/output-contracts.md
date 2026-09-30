# Output contracts — the post-processing layer

The contract pipeline rewrites the model's final text **once, in process,
immediately before delivery**. It is the last chance to fix output, and the
only place fixes are allowed to happen.

## Layers, in order

1. **User addressing** — how the assistant refers to the addressee in
   owner-private scope (formal/informal, name vs «ты»).
2. **Group-owner addressing** — different rules when the assistant is speaking
   in a group chat to a room rather than to one person.
3. **Peer-reply repair** — fixes shapes that come from the model treating a
   group thread as a direct reply.
4. **Identity semantics** — self-reference and role statements.
5. **Gender contract** — see `russian-gender-contract.md`.

Order matters: addressing runs before gender, because gender repair keys off the
frame that addressing establishes.

## Hard vs soft violations

- **Hard violation** → the candidate is rejected and regenerated. Budgeted
  retries (typically one or two), then either deliver the best candidate with a
  flag or fail the turn. Never loop unboundedly; a model that cannot satisfy a
  hard contract will not satisfy it on attempt four.
- **Soft violation** → auto-corrected in-process, no model round trip. Log the
  rewrite with a token-level diff.

Dispatch mirrors this: a gender violation in owner-private scope goes to the
owner-private gender enforcer, otherwise to the scope-appropriate addressing
enforcer. Getting the scope wrong here produces repairs that fight each other
across a session.

## Rules for every transform in this layer

- **Idempotent**: `f(f(x)) == f(x)`. Enforced by test, not by hope. Most
  non-idempotent transforms come from a "make it more X" step that adds a
  prefix or an intensifier on each pass.
- **Total**: no exceptions on model output. Model text is untrusted input and
  will contain whatever the model produces, including empty strings and 200kB
  of repeated punctuation.
- **Bounded**: skip transforms past a length cap. A regex over a huge string is
  both slow and pointless.
- **Logged**: every rewrite emits `{rule, before, after, diff}`. A rewrite you
  cannot see in logs is a rewrite you cannot debug.
- **Order-stable**: rules must not depend on iteration order over a dict or
  set. Sort deterministically.

## Anti-patterns

| Anti-pattern | Why it hurts |
| --- | --- |
| Background/periodic mass rewrite of stored rows | corrupt correct history, unreviewable |
| Word-level regex mutation of self-reference | breaks natural speech and quotes |
| Repair keyed on a guessed frame | flips verbs against unrelated nouns |
| Repair applied twice (pipeline + projection) | non-idempotent drift |
| Silently swallowing a hard-violation retry limit | user gets uncontracted text, no signal |
| Repairing in the gateway layer, after persistence | stored text and sent text diverge |
