---
name: long-task-continuity
description: Keep a long task's goal, next step, and open items in a file that survives context compaction, instead of in the conversation. Use when a task spans many steps or more than one session; when work may be interrupted or resumed; when asked what you were doing, to continue, or to pick up where you left off; when a checklist has more than a handful of items; or when progress must survive a restart. Ships scripts/checkpoint.mjs, which records a goal and next step, marks items done with `done <task> <n>`, adds items, and prints state with `show`.
---

# Long task continuity

A task that fits in one turn needs nothing. A task that spans twenty turns
needs its state written down, because context is not storage: it is truncated,
summarised, and eventually replaced.

## When to use this

- The task has many steps, or spans more than one session.
- Work may be interrupted, or resumed by a later session.
- Being asked "what were you doing", "continue", or "pick up where you left off".
- A checklist has more than about five items.
- Progress must survive a restart or a compaction.

## Rules

1. **Write the goal and the next concrete step, not a narrative.** "Add
   validation to the parser" is a goal. "Then update the README" is a next step.
   A paragraph of context is neither, and neither is a restatement of the task.
2. **The next step must be actionable without rereading the whole task.** If it
   needs the conversation to make sense, it is not a step, it is a topic.
3. **One checkpoint per task, updated in place.** A new checkpoint that replaces
   the old one keeps the plan current; appending a second one leaves two plans,
   and the stale one is the one that gets acted on.
4. **Mark items done as you finish them, in the same turn.** A checklist that is
   updated at the end is a checklist that will be wrong.
5. **A todo list in the conversation is not a checkpoint.** It lives in context
   and dies with it. The file on disk is the durable one; the in-context list is
   the fast one. Use both, and do not treat either as sufficient alone.
6. **Write the checkpoint before the risky step, not after.** The point is to
   survive the thing going wrong.

## Checkpoint

```bash
node scripts/checkpoint.mjs set <task> --goal <text> --next <text> [--item <text>]...
node scripts/checkpoint.mjs show [task]
node scripts/checkpoint.mjs done <task> <n>
node scripts/checkpoint.mjs add <task> <text>
node scripts/checkpoint.mjs clear <task>
```

State lives in `~/.config/opencode/checkpoints.json`, one file for all tasks.

```bash
node scripts/checkpoint.mjs set publish --goal "ship the plugin" \
  --next "validate all skills" --item "fix the README" --item "push"
node scripts/checkpoint.mjs done publish 1
node scripts/checkpoint.mjs show
```

`set` replaces the item list, because a fresh plan makes the old items stale by
definition. Exit codes: `0` ok, `1` no such checkpoint, `2` bad usage.

## Resuming

1. `show` the checkpoint first, before deciding anything.
2. Trust the recorded `next` over your own reconstruction. The file was written
   at a point when you knew more than you know now.
3. Verify the world has not moved: check the files and git state the step names
   before acting on it. A next step from last week may already be done.
4. Update the checkpoint as you go, not at the end.

## When the plan changes

Re-`set` the whole checkpoint rather than editing items in place. A half-updated
plan is worse than a stale one, because it looks current. If only the next step
changed, `set` it again with the same goal and items.

## Checklist

- [ ] Goal and next step written, not a narrative
- [ ] Next step actionable without the conversation
- [ ] One checkpoint per task, updated in place
- [ ] Items marked done in the turn they finished
- [ ] Checkpoint written before the risky step
- [ ] Resumed from the file, then verified against reality
