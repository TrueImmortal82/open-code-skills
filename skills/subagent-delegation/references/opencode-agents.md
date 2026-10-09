# opencode agents: verified shape

Read against the opencode documentation (agents page) and the installed
`@opencode-ai/sdk` (v1.15.10) `.d.ts`. This is the contract a delegation is
written against.

## Built-in subagents

| Name | Mode | Read-only | Purpose |
| --- | --- | --- | --- |
| `general` | subagent | no (full tools) | researching complex questions, multi-step tasks, parallel work |
| `explore` | subagent | yes | find files by pattern, search keywords, answer codebase questions |
| `scout` | subagent | yes | external docs / dependency research; clones repos into the managed cache |

Primary agents: `build` (full tools, the default) and `plan` (analysis only,
`edit` and `bash` set to `ask`). Hidden system agents `compaction`, `title`,
`summary` run automatically and are not selectable.

## Invocation

- A primary agent invokes a subagent through the Task tool, by `subagent_type`.
- A subagent can also be invoked by hand with an `@` mention:
  `@general help me search for this function`.
- Child sessions can be navigated with `session_child_first`,
  `session_child_cycle`, `session_child_cycle_reverse`, `session_parent`.
- Subagents that are `hidden: true` are not in the `@` menu but can still be
  invoked by a model via the Task tool if permissions allow.

## Configuration surface (JSON: `"agent": {...}`, or markdown in
`~/.config/opencode/agents/` and `.opencode/agents/`)

- `description` — required; this is what makes a primary agent autoselect a
  subagent for a task.
- `mode` — `"subagent" | "primary" | "all"`. Default `all`.
- `model` — if unset, a subagent uses the invoking primary agent's model.
- `permission` — keys `read`, `edit`, `glob`, `grep`, `list`, `bash`, `task`,
  `external_directory`, ... with `"allow" | "ask" | "deny"` or a
  glob→action object. Keys are matched as wildcard patterns against tool
  names.
- `permission.task` — glob control of which subagents this agent may invoke via
  the Task tool. `"*": "deny"` removes a subagent from the Task tool
  description entirely. Rules evaluated in order, **last match wins**.
- `steps` — max agentic iterations before forced text-only summarization.
  (`maxSteps` is deprecated; use `steps`.)
- `temperature`, `top_p`, `hidden`, `disable`, `color` — see docs.
- Legacy `tools` block is deprecated; use `permission`.

## Invariants to keep in a delegation

- A subagent starts with fresh context; resume works only through `task_id` on
  the Task tool.
- Read-only subtypes (`explore`, `scout`) cannot modify files.
- `permission` is a safety boundary: match subtype to what the task needs.
- `steps` exists because an unbounded subagent iterates until it stops itself.