---
name: github-repo-ops
description: Inspect and operate a GitHub repository safely with the gh CLI, and recover from auth, scope, and permission failures. Use when running `gh` commands, creating a PR or issue, checking CI or workflow status, managing branches, tags or releases, setting repository metadata or branch protection, or publishing a repo; when a gh call returns 401, 403, 404 or "Resource not accessible"; or before an operation that depends on token scopes. Ships scripts/gh-preflight.mjs, which reports auth, scopes, visibility, default branch, branch protection, and which operations the current token can perform.
---

# GitHub repo operations

The `gh` CLI fails in a small number of ways, and they all look like each other
in the terminal. Most are answered by asking the API what is true before acting
rather than by retrying.

## When to use this

- Running `gh pr`, `gh issue`, `gh release`, `gh run`, `gh api`, or `gh repo`.
- Before an operation that depends on token scopes or repository settings.
- A gh call returned 401, 403, 404, or "Resource not accessible by integration".
- Publishing a repository, or setting its metadata, description, or topics.

## Rules

1. **Read the status codes as distinct meanings.** 401 is an expired or absent
   token. 403 with "Resource not accessible by integration" is a *scope*
   problem on the token. 404 on a repository you believe exists is usually
   missing scope as well, because GitHub hides private repos from tokens that
   lack access. 404 that persists after a correct token is a wrong name.
2. **A 404 is not proof of absence.** GitHub returns 404 rather than 403 to
   avoid confirming that a private repository exists. Before concluding a repo
   is gone, confirm the token has `repo` and not only `public_repo`.
3. **`repo` is broad, `public_repo` is not.** The `repo` scope already covers
   issues, pull requests, releases, and workflow dispatch on repositories you
   can see. A separate `issues` scope is never additionally required. Choosing
   the narrow read-only scope when the operation needs to write produces a 403
   that looks like a repository permissions problem.
4. **Check branch protection before force-pushing or relying on a review.**
   An unprotected default branch accepts direct pushes and force-pushes, so the
   guarantee you think you have is not there. `GET .../branches/<name>/protection`
   answering 404 with "Branch not protected" is the answer, not an error to
   ignore.
5. **Prefer `--json` and `--jq` over parsing human output.** `gh` prints a
   TTY-shaped table without them and an error with them. Both are contract; the
   prose is not. `gh repo view` without `--json` also needs a git repository in
   the working directory and fails outside one.
6. **Script against `gh api` when you need an exact field.** It is the same
   authentication, one request, and a stable JSON body, rather than the
   repository of CLI output formats.
7. **Never paste a token.** `gh auth status` prints a masked token; the flag
   that reveals it, `--show-token`, has no place in a command that gets logged
   or echoed into a conversation.

## Preflight

```bash
node scripts/gh-preflight.mjs [owner/name] [--remote <name>] [--json]
```

Reads the repository from `origin` when no name is given, then reports the
account and its scopes, visibility, default branch, whether that branch is
protected, and a per-operation capability table.

Exit codes: `0` ready, `1` something is missing, `2` gh is unusable here.

```bash
node scripts/gh-preflight.mjs                        # from inside a clone
node scripts/gh-preflight.mjs owner/name --json      # anywhere
node scripts/gh-preflight.mjs --remote upstream      # fork layout
```

In a fork, `origin` is your fork and `upstream` is the original. Checking the
wrong one reports a repository you are not about to write to, so name the remote
you will actually push to.

Widen scopes only when a specific operation needs it:
`gh auth refresh -s workflow`. Adding a scope in advance is not free — it
broadens what a leaked token can do.

## Common failures

| Symptom | Meaning | Action |
| --- | --- | --- |
| `HTTP 404` on a repo you own | token lacks `repo` | `gh auth refresh -s repo` |
| `Resource not accessible by integration` | missing scope for that API | `gh auth refresh -s <scope>` |
| `gh: Not Found (HTTP 404)` on a call | wrong owner/name casing | `gh repo view owner/name` |
| `failed to run git` from `gh repo view` | run outside a clone | pass the repo name, or use `--json` |
| Push rejected, non-fast-forward | remote moved | fetch, then `--force-with-lease` |
| CI "pending" forever | workflow never started | check `gh run list` and Actions enabled |

## Before publishing

A repository created with `gh repo create --public` is world-readable the
moment it exists, including its git history. Confirm before creating that
there is no secret in the history — a `--public` flag is not reversible by
adding a README later.

## Checklist

- [ ] Ran the preflight, or read auth and scopes, before relying on them
- [ ] Treated 404 as possibly-missing scope, not as proof of absence
- [ ] Used `--json` / `--jq` instead of parsing human output
- [ ] Checked branch protection before assuming a review gate exists
- [ ] Confirmed no secret in history before making a repo public
- [ ] No token in the command line, the log, or the output
