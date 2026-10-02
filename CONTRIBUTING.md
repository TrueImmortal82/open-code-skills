# Contributing

Skills here are small on purpose. A skill earns its place by firing reliably and
by changing what the agent does; it does not earn it by being long.

## Adding a skill

1. Check for overlap first. If an existing skill's description already claims
   your trigger, extend that skill instead. Two skills on the same ground split
   the trigger and both fire less reliably.

   ```bash
   gh api repos/TrueImmortal82/open-code-skills/contents/skills \
     --jq '.[].name'
   ```

2. Scaffold it, and keep the description under 1024 characters:

   ```bash
   node skills/skill-authoring/scripts/new-skill.mjs <name> --desc "<when to use, when not to>" --out .
   ```

3. Give it a `scripts/` helper only if the rule can be checked by a machine. A
   script that cannot fail is worse than prose. If you ship one, prove it by
   constructing the input that makes it exit nonzero.

4. Validate and measure before committing:

   ```bash
   npm run validate
   node skills/code-discipline/scripts/check-size.mjs skills/<name>
   ```

5. Add a row to the skills table in **all three** READMEs. `README.md` is
   canonical; the other two are translations and may lag, but new skills should
   appear in all of them.

## House rules

- File budget 300 lines, hard limit 500. Function budget 30 lines, hard limit 50.
- No new dependency without asking first.
- No comments explaining what the code does. Explain why only when it is not
  obvious.
- Every helper's exit codes must match what its `SKILL.md` says. Unimplemented
  flags are deleted, not documented as future work.

## Committing

Run the gates before pushing:

```bash
node skills/release-checklist/scripts/pre-publish.mjs .
```

It reports the clean tree, unpushed commits, secrets in tracked files, the
version, skill validation, `TODO:` markers, and the test script — and names every
failure at once. Use `--quick` to skip the slow gates.

## Reporting a problem

Open an issue with the skill name, what you expected, and what happened instead.
If a helper gave the wrong answer, the exact command and its output matter more
than a description of the symptom.
