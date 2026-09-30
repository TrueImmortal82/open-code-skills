---
name: opencode-config-authoring
description: Author and repair opencode's own configuration — opencode.json/opencode.jsonc, agents, commands, skills, plugins, MCP servers, permissions, references. Use when creating or editing anything under .opencode/ or ~/.config/opencode/, when opencode fails to start with ConfigInvalidError, when wiring a skill/agent/command/plugin, or when validating config shapes against the published JSON Schema before writing.
---

# Authoring opencode configuration

opencode loads config **once at startup** and hard-fails on an invalid shape.
It is not hot-reloaded. So the cost of a wrong field is a broken CLI that you
then have to fix from outside the running session. Validate first.

## 1. Where files live

| Scope | Path |
| --- | --- |
| Project config | `./opencode.json`, `./opencode.jsonc`, `.opencode/opencode.json` |
| Global config | `~/.config/opencode/opencode.json(c)` — **not** `~/.opencode/` |
| Project agents | `.opencode/agent/<name>.md` or `.opencode/agents/<name>.md` |
| Global agents | `~/.config/opencode/agent(s)/<name>.md` |
| Project commands | `.opencode/command(s)/<name>.md` |
| Global commands | `~/.config/opencode/command(s)/<name>.md` |
| Project skills | `.opencode/skill(s)/<name>/SKILL.md` |
| Global skills | `~/.config/opencode/skill(s)/<name>/SKILL.md` |
| External skills (auto) | `~/.claude/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md` |
| Plugins (auto) | any `*.ts`/`*.js` in `.opencode/plugin/` or `.opencode/plugins/` |

Scopes are deep-merged; project overrides global. Both `skill/` and `skills/`
work — pick `skills/` and stay consistent within a tree.

## 2. Non-negotiable frontmatter rules

**Agents** (`.opencode/agent/foo.md`):

```markdown
---
description: Reviews PRs for style violations.
mode: subagent
model: anthropic/claude-sonnet-4-6
permission:
  edit: deny
  bash: ask
---

You are a strict PR reviewer. Focus on ...
```

- The **body** is the prompt. Never add a `prompt:` key to frontmatter.
- Allowed frontmatter keys only: `name, model, variant, description, mode,
  hidden, color, steps, options, permission, disable, temperature, top_p`.
  Unknown keys are silently routed into `options` — a typo becomes dead config.
- `mode`: `primary` | `subagent` | `all`.
- `default_agent` must point to a non-hidden `primary` agent.

**Commands** (`.opencode/command/deploy.md`):

```markdown
---
description: One sentence on what it does.
agent: build
model: anthropic/claude-sonnet-4-6
---

Deploy $1 to $2. Body is the prompt; `$ARGUMENTS` is everything after the
command name.
```

- Body is the template. No `template:` key in frontmatter.
- `$ARGUMENTS` = full argument string, `$1`/`$2` = positional.
- Optional frontmatter: `description, agent, model, variant, subtask`.

**Skills** (`.opencode/skills/foo/SKILL.md`): filename is exactly `SKILL.md`,
inside a folder named after the skill.

```markdown
---
name: foo
description: What it does AND when to trigger it. Front-load literal
  keywords/filenames the user would say.
---

Body in markdown.
```

- `name` required, lowercase-hyphenated, ≤64 chars, matches folder name.
- **A skill without a `description` is filtered out and never surfaces to the
  model.** This is the single most common skill bug.
- Write the description in third person ("Use when..."), lead with concrete
  trigger words, and add "Use ONLY when..." when the skill must stay quiet on
  adjacent topics. Optional extra frontmatter: `license`, `compatibility`,
  `metadata` (string→string map).

## 3. Shape traps in opencode.json

These fields are the ones people get wrong because the natural shape is wrong:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-6",
  "skills": { "paths": [".opencode/skills"], "urls": ["https://x/.well-known/skills/"] },
  "references": { "docs": { "path": "../docs", "description": "why" } },
  "agent": { "my-agent": { "mode": "subagent" } },
  "command": { "deploy": { "template": "..." } },
  "plugin": ["opencode-foo", "opencode-bar@1.2.3", "./local.ts", ["baz", { "k": "v" }]],
  "mcp": {
    "local-one": { "type": "local", "command": ["npx", "-y", "pkg"], "enabled": true, "environment": {} },
    "remote-one": { "type": "remote", "url": "https://...", "headers": { "Authorization": "Bearer {env:TOKEN}" } }
  },
  "permission": { "edit": "deny", "bash": { "git *": "allow", "*": "ask" } }
}
```

- `model` **always** carries a provider prefix.
- `skills` is an **object** with `paths`/`urls` — not an array.
- `agent`, `command`, `mcp`, `references` are **objects keyed by name**.
- `plugin` is an **array** of strings or `[name, options]` tuples.
- `mcp[name].command` is an **array of strings**, never a bare string. `type`
  is required. Disable an inherited server with `{"enabled": false}`.
- `permission` inside an object is a **last-match-wins** list: put broad rules
  first, narrow last. `{"git *": "allow", "*": "ask"}` allows git, asks for
  everything else.
- `todowrite`, `question`, `webfetch`, `websearch`, `doom_loop` accept only a
  flat action — **not** a `{pattern: action}` object.
- `{env:VAR}` and `{file:path}` are the interpolation forms. `${VAR}` is **not**
  substituted.
- Top-level `"permission": "allow"` allows everything; almost never wanted.

## 4. Plugin module shape

The export is a **function returning a hooks object**, not an object literal.

```ts
import type { Plugin } from "@opencode-ai/plugin"

export default (async ({ client, project, directory, $ }) => {
  return {
    config: (cfg) => { /* mutate merged config in place */ },
    "tool.execute.before": async (input, output) => { /* mutate output.args */ },
    event: async (input) => {},
  }
}) satisfies Plugin
```

Hook surface: `event`, `config`, `chat.message`, `chat.params`, `chat.headers`,
`tool.execute.before`, `tool.execute.after`, `tool.definition`,
`command.execute.before`, `shell.env`, `permission.ask`, and the
`experimental.*` family (`chat.messages.transform`, `chat.system.transform`,
`session.compacting`, `compaction.autocontinue`, `text.complete`).

Non-callback, object-shaped entries: `tool: { my_tool: {...} }`, `auth: {...}`,
`provider: {...}`.

## 5. Validation workflow — do this before writing

```powershell
node scripts/validate-config.mjs <path-to-opencode.jsonc>
```

The bundled script (`scripts/validate-config.mjs`, run with node, no deps):

1. strips JSONC comments and trailing commas,
2. parses JSON,
3. fetches `https://opencode.ai/config.json`,
4. checks every present key against the schema's allowed properties,
5. enforces the traps from section 3 (skills object, array `mcp.command`,
   provider prefix on `model`, flat-only permission keys),
6. flags references to skills/agents/commands whose files do not exist.

Exit code is nonzero on any violation. Read
<https://opencode.ai/config.json> directly when the script cannot tell you a
field's exact shape — it is the source of truth, not this skill.

## 6. Editing discipline

- Preserve `$schema` and every field the user did not ask you to touch.
- Prefer new files in the correct location over inlining definitions into
  `opencode.json`.
- Do not reformat unrelated parts of a user's config; minimal diffs.
- After every change: **tell the user to quit and restart opencode.** The
  running session keeps the already-loaded config.
- If their config is currently broken and opencode will not start, use the
  escape hatches below so they can repair it from inside a working session.

## 7. Escape hatches

| Env var | Effect |
| --- | --- |
| `OPENCODE_DISABLE_PROJECT_CONFIG=1` | ignore the project config, start from globals only |
| `OPENCODE_CONFIG=/path/file.json` | load an extra explicit config |
| `OPENCODE_CONFIG_CONTENT='{"..."}'` | inject inline JSON as the final local-scope merge |
| `OPENCODE_DISABLE_DEFAULT_PLUGINS=1` | skip bundled default plugins |
| `OPENCODE_PURE=1` | skip all external plugins |
| `OPENCODE_DISABLE_EXTERNAL_SKILLS=1` | skip `~/.claude` + `~/.agents` skill scans |
| `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` | skip only the `~/.claude` scan |

Typical repair: launch with
`OPENCODE_DISABLE_PROJECT_CONFIG=1 opencode`, edit the file, restart without
the flag.
