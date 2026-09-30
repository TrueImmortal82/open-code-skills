# opencode-skillkit

An installable [OpenCode](https://opencode.ai) plugin that ships a set of
battle-tested agent skills. Install the plugin and all of its skills become
available to every session, with no per-machine copying.

## What it does

The plugin exposes a single `config` hook. On startup it appends its bundled
`skills/` directory to `skills.paths` in the live config, and OpenCode's skill
discovery picks the skills up from there. It installs nothing globally and
writes nothing outside the OpenCode config.

## Included skills

| Skill | Purpose |
| --- | --- |
| `powershell-windows` | Windows PowerShell 5.1 execution rules — chaining, `$?` vs `$LASTEXITCODE`, quoting, non-UTF-8 console encoding, native exe invocation |
| `opencode-config-authoring` | Authoring and repairing `opencode.json` / `opencode.jsonc`, plus a JSONC + JSON Schema validator script |
| `skill-authoring` | How to write an agent skill that actually triggers, with a scaffolder and a validator script |
| `self-improvement` | The loop that turns a correction into a durable artifact instead of a forgotten intention |
| `assistant-runtime-architecture` | Building and debugging a long-lived assistant runtime — supervisor/child topology, durable delivery, output contracts, Russian gender enforcement |

Each skill is a plain directory containing a `SKILL.md` with YAML frontmatter,
per the [Agent Skills specification](https://agentskills.io/specification).
They follow the same format as the skills OpenCode discovers on its own, so you
can copy any of them out of this repo and use them without the plugin.

## Installation

Add the plugin to your OpenCode config — `~/.config/opencode/opencode.jsonc`
(global) or `.opencode/opencode.json` (project-local):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:TrueImmortal82/opencode-skillkit"]
}
```

Restart OpenCode afterwards. Config is not hot-reloaded.

### Verifying the install

```bash
opencode debug skill
```

Each skill should appear with a `location` pointing inside your installed copy
of this repository.

### If the GitHub spec does not resolve

Direct GitHub install depends on your OpenCode version resolving the spec
through its package installer. If it does not work, clone the repo and point
the plugin at the local directory, which is supported by every version:

```bash
git clone https://github.com/TrueImmortal82/opencode-skillkit.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["C:/path/to/opencode-skillkit"]
}
```

Use forward slashes in the path. Windows paths need their backslashes escaped
(`C:\\path\\to`) if you write them literally.

## Using a subset of the skills

Skills are registered by directory, so removing a skill directory from your
checkout removes it from the install. If you want to keep a local edit to one
skill while still updating the rest, copy that skill to your own
`~/.config/opencode/skills/` directory; locally installed skills take part in
the same discovery pass.

## Development

```bash
git clone https://github.com/TrueImmortal82/opencode-skillkit.git
cd opencode-skillkit
npm run validate
```

`npm run validate` runs the bundled skill validator over every skill and fails
on frontmatter errors, broken internal links, and over-long bodies. Run it
before opening a pull request.

To scaffold a new skill:

```bash
node skills/skill-authoring/scripts/new-skill.mjs
node skills/skill-authoring/scripts/validate-skill.mjs skills/<your-skill>
```

## Requirements

- OpenCode `>= 1.18.0` (uses the `{ id, server }` plugin export shape)
- Node.js is not required at runtime — OpenCode loads the plugin with Bun

## Notes for contributors

- The plugin module must keep **exactly one** export, the default object.
  OpenCode's legacy plugin loader treats every named export as a separate
  plugin and throws on anything that is not a function.
- The `config` hook receives the live config object; its return value is
  discarded and thrown errors are swallowed. Mutate in place, and never throw.
- Do not nest a `SKILL.md` inside another skill directory. Skill paths are
  scanned with a recursive `**/SKILL.md` glob, so a nested file registers as a
  second, unintended skill.
- Do not hardcode machine-specific values (absolute paths, console codepages,
  home directories) into a skill. Put environment discovery in the skill
  instead, as `powershell-windows` does.

## License

MIT — see [LICENSE](LICENSE).
