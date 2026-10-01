---
name: git-safety
description: Run a reversible preflight before git commands that discard work, and recover work that was already lost. Use when about to run `git reset --hard`, `git checkout .`, `git restore`, `git clean -fd`, `git branch -D`, `git rebase`, `git push --force`, or `git stash`; when a command would delete untracked or uncommitted work; when checking whether the working tree is safe to modify; or when someone says git lost their changes. Ships scripts/git-preflight.mjs, which reports dirty, untracked, unpushed, and remote-only state, and marks each destructive command ok, LOST, or ?.
---

# Git safety

Most git data loss is not a git bug. It is a destructive command run without
knowing what was in the tree. The fix is boring: look first, and prefer the
reversible spelling.

## When to use this

- Before `reset --hard`, `checkout .`, `clean -fd`, `branch -D`, `rebase`,
  `push --force`, or `stash`.
- When a command would delete untracked or uncommitted work.
- When work was already lost and you are looking for where it went.

## Rules

1. **Look before destroying.** `git status --porcelain` first, every time. The
   cost is one command; the alternative is an afternoon.
2. **The reversible spelling is the default spelling.** Prefer, in order:
   `git stash` over `checkout .`; `git restore <file>` over `reset --hard`;
   `git branch -d` over `-D`; `git push --force-with-lease` over `--force`;
   `git rebase --abort` availability over starting one.
3. **Untracked files are the ones that vanish.** `clean -fd` deletes work that
   was never committed, so there is nothing to restore from. Committed work is
   recoverable from the object store; untracked work is simply gone.
4. **An empty directory is invisible to `git status` but not to `git clean`.**
   Git does not track directories, so an empty folder never shows as untracked
   and `clean -fd` still removes it. This is the one case where `clean -nd`
   reports something `status` does not. Believe the dry run.
5. **Force-push is only safe when the remote has not moved.** `--force-with-lease`
   refuses when the remote has commits you have not fetched. Plain `--force`
   overwrites them, including someone else's work.
6. **A commit is not lost until nothing references it.** After a bad reset, look
   at `git reflog` before concluding anything: the commit is usually still there
   for weeks. `git reset --hard <sha>` brings it back.

## Preflight

```bash
node scripts/git-preflight.mjs [dir] [--json] [--quiet]
```

Reports staged, unstaged, untracked, conflicted, clean-dry-run, ignored,
unpushed, and remote-only state, then marks each common destructive command
`ok`, `LOST`, or `?` for the tree as it is right now.

`?` means the tree state cannot decide it — `git branch -D` depends on the
named branch and on other remotes. Check that branch specifically rather than
reading `?` as permission.

Exit codes: `0` nothing at risk, `1` work would be lost, `2` not a git tree.

```bash
node scripts/git-preflight.mjs            # human report
node scripts/git-preflight.mjs --json     # for a script or a hook
```

The script only reads. `git clean -nd` and `-ndX` are dry runs, so running the
preflight never removes anything.

## Recovering lost work

In order, cheapest first:

```bash
git reflog                      # find the sha the commit was on
git reset --hard <sha>          # or: git checkout -b rescue <sha>
git stash list                  # for work parked by a stash
git fsck --lost-found           # last resort, for unreachable objects
```

Reach for `reflog` before redoing the work. It is nearly always still there,
and retyping a lost change is strictly worse than a command that seems scary.

## When a command must be irreversible anyway

State what is lost before running it, not after. If the answer is "the two
untracked files `draft.md` and `notes.txt`", say that in one line, then run it.
An unannounced destructive command is the actual defect, not the command.

## Checklist

- [ ] Ran `git status --porcelain` or the preflight first
- [ ] Chose the reversible spelling where one existed
- [ ] Checked untracked files, which have no recovery path
- [ ] Used `--force-with-lease` rather than `--force`
- [ ] Said out loud what the irreversible command would lose
- [ ] Did not conclude data was lost before checking `git reflog`
