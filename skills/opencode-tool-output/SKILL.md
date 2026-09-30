---
name: opencode-tool-output
description: Read opencode debug output reliably by parsing JSON instead of regexing pretty-printed stdout. Use when running `opencode debug skill`, `opencode debug config`, or `opencode debug agent`; when checking which source a skill, agent, or command was actually loaded from; when output is very large, or paths and quotes are backslash-escaped; or when confirming a plugin registered its skills. Ships `scripts/inspect-skill.mjs` for name and location lookup, and handles the Windows `opencode.cmd` and GUI-binary spawn traps.
---

# opencode tool output

`opencode debug *` emits machine-readable JSON that is easy to consume wrongly.
This skill is about parsing it as data and not as text.

## When to use this

- You are about to run `opencode debug skill`, `debug config`, `debug agent`, or `debug paths`.
- You need to know which file a skill, agent, or command was actually loaded from.
- You are writing a script that consumes opencode's output.
- Output is large, or contains backslash-escaped paths and quotes.

## Rules

1. **Parse the JSON. Never regex the pretty-printed output.** A single skill
   expands to tens of lines with escaped `\n` and `\\` inside `content`; any
   line-based approach silently truncates or mis-joins it.
2. **Do not dump raw output into the conversation.** A full `debug skill` run is
   several hundred KB. Filter to the fields you need first.
3. **Trust `location`, not the order of the output.** `debug skill` keeps one
   entry per name and drops any later file claiming a name already taken, so a
   shadowed skill is invisible. The surviving `location` is the only authority.
4. **On Windows, do not spawn `opencode` blindly.** See the trap below.
5. **Do not assume `description` is short.** Some run past 700 characters, so a
   narrow window truncates mid-sentence and looks like the real text.

## Windows: the two traps

Both produce **exit code 0 with two bytes of output** instead of JSON, which
looks like a hang or a silent success rather than a failure.

**Trap 1 — the PATH shim.** `opencode.cmd` is a shim; when node spawns it via
`cmd.exe` it returns nothing useful, and node cannot exec a `.cmd` directly at
all (`spawnSync ... EINVAL`). Spawn the packaged executable instead.

**Trap 2 — the GUI binary comes first.** `where.exe opencode` lists the desktop
build, e.g. `...\Programs\@opencode-aidesktop\OpenCode.exe`, *before* the CLI
entry. That is a windowed app that writes nothing to stdout, so taking the
first match silently yields 2 bytes. Pick the match that has
`node_modules/opencode-ai/bin/opencode.exe` beside it.

Both traps are handled by `scripts/inspect-skill.mjs`; override it with
`--cmd <path>` or the `OPENCODE_BIN` environment variable.

## Using the script

```bash
node scripts/inspect-skill.mjs                  # every skill: name + location
node scripts/inspect-skill.mjs code-discipline # one skill, and which file won
node scripts/inspect-skill.mjs --source .agents # only skills from one root
node scripts/inspect-skill.mjs code-discipline --content
node scripts/inspect-skill.mjs --json           # for further machine reading
```

Exit codes: `0` found, `1` no match, `2` could not read opencode.

## PowerShell notes

- `opencode debug skill 2>&1 | Out-String` merges both streams and is the
  reliable way to see the JSON. A bare `>` redirect truncates or mangles it.
- Never round-trip this output through `Out-File` / `Set-Content` on a cp866
  console; it corrupts non-ASCII paths. Keep it in memory or hand it to a
  script that reads UTF-8.

## Checklist

- [ ] The command was parsed as JSON, not matched with a regex.
- [ ] Only the fields needed were brought into the conversation.
- [ ] The `location` of each result was read to confirm the intended file won.
- [ ] On Windows, the resolved command was the CLI, not the GUI build or shim.
