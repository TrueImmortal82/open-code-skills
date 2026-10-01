---
name: release-checklist
description: Run the checks that get skipped when publishing or pushing under time pressure, and fail on all of them at once. Use before a release, a publish, or a push to a shared branch; when a change is about to leave the machine; when asked whether something is ready to ship, is good to go, or can I push; or when checking for a leaked key in tracked files. Ships scripts/pre-publish.mjs, which reports the clean tree, unpushed commits, secrets in tracked files, `package.json` version, skill validation, `TODO:` markers, and the test or build script, exiting 1 and naming every failure at once. Use `--quick` to skip the slow gates and `--skip` to name an exception.
---

# Release checklist

A checklist that lives only in your head is not a checklist. Under time pressure
the steps that get skipped are always the slow, boring ones, and those are
exactly the ones that catch a mistake.

## When to use this

- Before a release, a publish, or a push to a shared branch.
- When a change is about to leave this machine.
- When asked whether something is ready to ship.
- When a human would otherwise run the same sequence by memory.

## Rules

1. **Run the checks, do not remember them.** A remembered checklist is a
   checklist that gets shortened under pressure, and it is shortened at exactly
   the steps that would have caught the problem.
2. **Every gate reports pass, fail, or skipped — never silence.** A gate that
   quietly does nothing when it cannot run reads like a pass. "Skipped: no git
   index" and "no upstream configured" are honest answers; a missing line is not.
3. **Report all failures, not the first.** Fixing one gate at a time means
   rediscovering the others one at a time, which is slower and encourages the
   "one more small thing" edit that breaks another gate.
4. **A skipped gate is not a passed gate.** `--quick` skips the slow checks on
   purpose; the output says which ones, so nobody mistakes a partial run for a
   full one.
5. **A secret gate is cheap insurance.** A key in a tracked file is public the
   moment it is pushed, and removing it from history afterwards does not un-push
   it. Pattern matching will miss things; it will not miss a token.
6. **Version, description, and topics are part of the release.** A repository
   that exists but describes nothing is not published, it is leaked.

## Gates

```bash
node scripts/pre-publish.mjs [dir] [--quick] [--skip <name>] [--json]
```

| Gate | Checks | Cost |
| --- | --- | --- |
| clean tree | no uncommitted changes | fast |
| branch pushed | no unpushed commits | fast |
| no secrets | key patterns in tracked files | fast |
| package version | `version` present | instant |
| skill validation | every `SKILL.md` validates | medium |
| no leftover markers | `TODO:` / `FIXME:` in tracked source | medium |
| build or test | `npm test` or `npm run build` | slow |

Exit codes: `0` all passed, `1` at least one failed, `2` could not run.

```bash
node scripts/pre-publish.mjs --quick                 # skip the slow gates
node scripts/pre-publish.mjs --skip "build or test"  # run everything else
node scripts/pre-publish.mjs --json                  # for a hook
```

`--skip` is for a known reason, and the reason belongs in the commit message or
the review, not only in the command line. A gate nobody can turn off is a gate
that gets deleted the first time it is inconvenient.

## When a gate fails on something irrelevant

A gate that fires on an unrelated project is noise, and noise trains people to
ignore the output. That is why the secret and marker gates only read files git
is tracking, and why the skill gate looks for a validator in the repository
before running it. If a gate is wrong for your project, fix the gate; do not
learn to skim past it.

## After it passes

Passing the gates means the obvious things are right, not that the change is
correct. Read the diff once more with the question "what did I not test?" — see
`test-first-fix` — and check that the changelog says what actually changed
rather than what was intended.

## Checklist

- [ ] Gates run as commands, not from memory
- [ ] Skipped gates visible in the output
- [ ] All failures fixed, not just the first
- [ ] No secret in any tracked file
- [ ] Version bumped and description accurate
- [ ] Diff reread for what is untested
