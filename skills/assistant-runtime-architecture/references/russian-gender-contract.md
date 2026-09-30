# Russian gender contract — morphological enforcement

Enforcing the assistant's own grammatical gender and the addressee's gender in
Russian requires morphology, not regex. Regex on Russian gender is a research
project that never ships; `pymorphy3` gives parses, tags, and lemmas.

## What the contract enforces

Two independent axes:

- **Self-gender**: which gender the assistant's own predicates must agree with
  («я готов» vs «я готова»).
- **Addressee gender**: how the assistant refers to the user («готов?» vs
  «готова?»), which for a Russian assistant is usually tied to the addressee's
  gender, not the assistant's.

Keeping them separate matters: fixing one with the other's rule produces text
that is wrong in both directions.

## Clause-stack tracking

The core structure is a stack of frames, one per clause.

- Explicit nominative pronouns (**я / ты / он / она**) **set** the current frame's
  gender and mark it trusted.
- Subordinating conjunctions («когда», «если», «что», «потому что») **push** a
  frame, inheriting the current gender.
- Coordinating conjunctions («и», «но», «а») **pop** — they end the clause they
  were coordinating.
- Nominative nouns **reset** the frame to no-gender. «Он пришёл, помощь
  нужна» — the second clause has no subject to inherit from.
- «мы / вы / они» **reset to plural**, which carries no gender. A plural frame
  is a hard stop for mutation.

## Strict mode (2026-08-16)

An **implicit first-person guess** — a sentence starting with a gendered
predicate and no explicit «я» — is **detection-only**: reported with
`replacement=None`, text never rewritten.

A parallel `subject_explicit` stack tracks whether each frame came from an
explicit pronoun or a guess. Mutations are permitted only on trusted frames.

Rationale: guessing wrong is worse than leaving text alone. A detected
violation is a log line you can act on; a wrong rewrite is user-visible damage.

## Mutations that ARE allowed (trusted frames only)

- explicit я/ты/он/она agreement
- imperative and 2nd-person verb forms («Готов?» → «Готова?»)
- addressee-question predicates («Ты готова?» → «Ты готов?»)
- elliptic «или»-questions where an explicit «я» appears later
- vocative address adjectives («Я здесь, любимый»)
- inverted «…ли я» constructions
- adjective-noun agreement («какая ты человек» → «какой»)

Everything else is detection-only.

## Parsing guards

### Adjective-noun pairing must not run forward over a postpositive adjective

Russian freely puts the adjective after the noun: «чай зелёный». Pairing a
postpositive adjective with the *following* noun corrupted logs — «чай
зелёное». Skip the pairing when the previous token's top parse is a NOUN.

### Accusative full adjectives are attributes, not predicates

In «эту влажную, теплую игру» the adjectives are object attributes. Letting
them reach the predicate check produces «этот влажного». Extend the attributive
scan *through* ADJF chains to the agreeing noun instead.

Also skip tokens with a personal VERB reading: in «Я целую тебя» the parse must
not be allowed to pair «целую» as an adjective, or «я целое» appears.

### `_best_gendered_parse` guards

Reject candidate parses for:

- **OOV words** — no parse, no mutation.
- **Archaic lemmas** — the model's archaic register should not drive grammar.
- **Participle-only readings** — participles agree differently and produce
  garbage when treated as predicates.

Without these, an implicit «я» flips verbs against object nouns:
«Кардиомагнил принял» → «приняла».

## Sentence splitting

Split on `.`, `!`, `?` but **respect quote pairs**: «...!» inside guillemets is
not a sentence terminator. Naive splitting on `!` produces fragments whose
clause stacks are garbage, and every downstream mutation becomes random.

## Testing discipline

- `tests/test_gender_contract.py`: strict mode, postpositive adjectives,
  object-adjective chains, trusted-repair guards.
- **Idempotency test** over a corpus: `enforce(enforce(t)) == enforce(t)`. A
  violation here is a design bug, not a data bug.
- Corpus audit: run the contract over all stored assistant messages, diff
  token-by-token, classify by scope, check idempotency. A healthy enforcer
  produces **zero mutations on already-correct stored text**. Nonzero mutations
  on correct text means the enforcer, not the corpus, is broken.

## Known false positives

Track these separately from strict-mode behavior — they are detection noise, not
bugs to fix:

- third-person overreach after «и»-coordination inside an «она»-clause
- apology-imperative re-attribution: «прости, проглядела»
- vocative adjectives in a possessive frame
