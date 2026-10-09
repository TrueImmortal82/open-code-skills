---
name: subagent-delegation
description: Deciding when to hand work to an opencode subagent instead of doing it inline, picking which subagent to invoke, and writing the delegation so a fresh-context subagent can actually answer it. Covers the Task tool with `subagent_type` `explore`/`general`/`scout`, parallel units of work, `task_id` resume, `@mention` invocation, hidden agents, `permission.task` gating, and the `steps` limit that stops a runaway subagent. Use when work is independent enough to delegate, when a subagent came back with something useless, when the main thread is doing one thing while a parallel lookup is the obvious move, or when wiring a new subagent into a runtime. Not for writing the agents config itself (see opencode-config-authoring).
---

# Subagent delegation

Handing a piece of work to a subagent is a transfer of context, not just a
button. The subagent starts fresh: it does not see this conversation, it only
knows what the delegation prompt carries. Nearly every useless subagent result
is a delegation that assumed shared memory.

## When to use this

Use this when there is a piece of work that can be walled off from the main
thread long enough for a subagent to answer it, and you are choosing between
doing it inline and delegating:

- Research that has a definite shape: "find every caller of X", "what versions
  of the SDK are installed".
- Parallel units of work that have no ordering constraint between them.
- A subagent just came back with something wrong and you need to see why it
  decoded the task differently.
- Wiring a new subagent into a runtime, or wondering why an existing one is
  not being invoked by the main agent.

Not for: adjusting the agent definitions themselves (see
`opencode-config-authoring`), or checkpointing a long task so it survives a
reset (see `long-task-continuity`).

## Rules

Ordered by how often they go wrong.

### 1. A subagent does not know the conversation

It has none. Everything it needs must be in the delegation prompt: paths,
patterns, the exact question, the format the answer must take. "Check that
function I mentioned" is a prompt failure, not a subagent failure.

You *can* resume one subagent session by passing its `task_id` to the Task tool
again — the session continues with its previous messages and tool outputs. That
is the only channel by which a subagent's context survives: either it is
recreated with the prompt, or it is resumed with its own `task_id`. Otherwise
assume a clean slate.

### 2. Pick the smallest read-only subagent that can answer

Match the capabilities to the task, because capabilities are also a safety
boundary:

| Need | `subagent_type` | Can it modify files? |
| --- | --- | --- |
| Find files, search code, answer a question about the codebase | `explore` | no |
| Research external docs, inspect a dependency's source | `scout` | no |
| Multi-step work, execute units in parallel | `general` | yes (full tools) |

Do not send a `general` agent to count callers — `explore` is cheaper, cannot
make changes, and has a narrower brief. The converse error is worse: sending a
read-only agent to do the one thing it cannot, and getting back a refusal.

Specify the thoroughness you want when the task is open-ended ("quick" vs
"very thorough"), and what to return — file paths, line numbers, a verdict, not
a summary of its own process.

### 3. Delegate by telling it what "done" looks like

The subagent cannot ask "what did you mean?", so pre-answer its questions:

- The inputs, verbatim if they came from the user.
- The output contract: question → claim → evidence, or a table, or "X and Y".
- What it must NOT do (do not change files, keep it 300 lines, no new deps).
- How to verify its own work if verification exists (a command to run).

Tell it explicitly whether it is allowed to write code or must only research —
a research subagent told "investigate" is fine; a general subagent told nothing
may decide to "fix" what it was sent to describe.

### 4. A useless result is a re-delegation, not a blame

When a subagent returns something off, find the gap in the prompt instead of
retrying blindly or folding the work back inline. The usual gaps:

- Ambiguous verb — "review" vs "rewrite vs "list".
- Missing context — it did not know why the shape matters.
- Missing return format — it summarized to comfort itself instead of answering.
- The wrong subtype — read-only agent asked for a write.

Re-delegate with the failure named: "you returned a summary; I need the exact
line numbers and the callers, in order." Re-run with the same `task_id` when
the continuation matters, or fresh when the misread was total.

### 5. An unbounded subagent is a bill without a receipt

A delegation with no limit can keep iterating until cost piles up. Put a cap
on the number of agentic steps (`steps`) when you configure the agent, and keep
the prompt bounded: one question, one deliverable. Parallel launches multiply
cost, so only parallelize what genuinely needs to be concurrent.

### 6. Keep the main thread the only writer

If two agents can edit the same file, the result is merge conflict theatre. A
subagent working on `utils.ts` while the main thread edits `utils.ts` is a bug
in your delegation, not in the tool. Wall off files per agent: if the work
touches what you are touching, do it inline or do it next, never both at once.

## Reference

- `references/opencode-agents.md` — the verified agent shape: built-in
  subagents, modes (`subagent`/`primary`/`all`), `hidden`, `permission.task`
  globs, and how a subagent inherits the invoking agent's model. Read when you
  reach for `subagent_type` outside the built-ins.

## The invisible_dots reference

The inspiration for this skill is the agent-per-VM model of
[feder-cr/invisible_dots](https://github.com/feder-cr/invisible_dots): each Dot
is a persistent agent with its own computer, memory and skills, and its own
conversation. What opencode subagents take from that design is *isolation* —
fresh context, walled-off state — with the difference that a Dot is durable
and a subagent is a bounded unit of work. Read the parallel as: give every
delegation the same self-sufficiency a Dot gets from its disk. If the subagent
has not been told it, it does not know it.

## Checklist

- [ ] The delegation prompt contains every input, the output contract, and the
      forbidden actions; nothing relies on "the conversation we were having"
- [ ] The smallest read-only subtype was chosen when read-only was enough
- [ ] The prompt says explicitly: research only, or code allowed
- [ ] A useless result was re-delegated with the gap named, or resumed via
      `task_id` when continuity mattered
- [ ] `steps` caps the work, and no two agents write the same file
- [ ] The subagent was told what to return and how to verify itself