---
name: powershell-windows
description: Windows PowerShell 5.1 execution rules for the Bash/shell tool — chaining commands, $? vs $LASTEXITCODE, quoting and backtick escaping, Cyrillic/UTF-8 encoding corruption (non-UTF-8 console codepages such as cp866, us-ascii $OutputEncoding), file IO, exit codes, and running external exes. Use for ANY command run under Windows PowerShell 5.1, and especially when writing shell one-liners, piping output, handling non-ASCII text, or chaining dependent commands.
---

# Windows PowerShell 5.1 — execution rules

The shell is **Windows PowerShell 5.1**, not bash. Every command here is
PowerShell unless it is an explicitly invoked native exe. Bash habits produce
silent wrong answers more often than errors.

## 1. Chaining: no `&&`, no `|`, use `; if ($?)`

`&&`, `||`, and `&&=` do not exist in 5.1.

```powershell
npm run build; if ($?) { npm test }
```

- `$?` = did the **last** pipeline succeed. Works for both cmdlets and native
  exes, but reflects only the immediately preceding statement.
- `$LASTEXITCODE` = numeric exit code of the last **native** exe only. It is
  stale/unset after a cmdlet.
- Prefer `$?` for chaining. Use `$LASTEXITCODE` only when you need the number,
  e.g. `if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" }`.
- `;` when you do not care whether the earlier command succeeded.
- Full-length form, same semantics:
  ```powershell
  if (Test-Path -LiteralPath "x") { Remove-Item -LiteralPath "x" -Recurse -Force }
  ```

## 2. Quoting and escaping

Backtick `` ` `` is the escape character (not backslash).

| Intent | Write |
| --- | --- |
| String with `$var` inside | `"total: $count"` |
| Literal `$` | `` 'price: $5' `` or `` "price: ``$5" `` |
| Double quote inside `"` | `` `"quoted`" `` or `'say "hi"'` |
| Backtick itself | ``` `` ``` (double it) |
| Line continuation | trailing backtick — nothing may follow it, not even a space |

- **Prefer single quotes** for anything not interpolating. Single-quoted
  strings treat `$`, backtick, `"` literally.
- Regex needs single quotes: `'^\s*#'`, `'a{2,3}'`. Double quotes would make
  PowerShell expand `$` and backticks inside the pattern first.
- `-notmatch` / `-replace` with a `$` in the replacement needs the backtick
  escape (`'``$1'`) or a script block replacement.

## 3. Do not use PowerShell cmdlets for file/content work

The tool harness has dedicated tools and they are faster and safer:
Read, Write, Edit, Glob, Grep. Reach for the shell only for actual process
execution.

Banned by default:
`Get-Content` (read), `Set-Content` / `Out-File` (write), `Add-Content`,
`Select-String` (search), `Get-ChildItem` for **finding** files (use Glob).

Legit shell uses: `git`, `npm`, `npx`, `node`, `python`, `rg`, `dotnet`,
`cargo`, `docker`, `az`, launching a build. Also fine: `Test-Path`,
`Remove-Item`, `New-Item`, `Copy-Item`, `Move-Item` when the operation itself is
the point.

- Full-cmdlet aliases: `ls`, `cat`, `echo`, `where`, `?`, `%`, `curl`, `mv`,
  `rm`, `cp`. Avoid them in scripts — they hide what actually runs.
- `curl` is an **alias for `Invoke-WebRequest`**, not real curl. For real curl
  use `curl.exe`. Same for `wget` → `Invoke-WebRequest`.
- Do not pipe file content through `Select-Object -First/-Last` to "limit"
  output — the harness already truncates and spills to a file; truncating with
  cmdlets loses data.

## 4. Cyrillic / encoding — the big footgun

A stock Windows console is **not** UTF-8. On a RU-locale machine you will
typically see:

- `[Console]::OutputEncoding` → **cp866** (or cp1251)
- `$OutputEncoding` → **us-ascii**
- `chcp` → 866

Do not assume those exact values — detect them once per session instead:

```powershell
$PSVersionTable.PSVersion.ToString()
[Console]::OutputEncoding.WebName
$OutputEncoding.WebName
```

Consequences:

1. Native exes inherit cp866. Russian text passed **into** an exe's argv
   (or a pipe) gets mangled. `rg` with a Cyrillic pattern may silently find
   nothing.
2. `Out-File`, `>` redirection, and `Set-Content` use us-ascii/`Default`
   encoding unless told otherwise. `>` on a file containing Cyrillic corrupts
   it.
3. `chcp` output itself is unreadable in the captured log.

Rules:

- Never redirect cmdlet text output with `>` into a file. Use the Write tool.
- If a native tool must emit non-ASCII, set the console to UTF-8 **in the same
  command**: `chcp 65001 > $null; <command>` — and prefer tools that accept
  `--encoding utf-8` / `-Encoding UTF8` / `-AsByteStream`.
- For non-ASCII search use the Grep tool, not `Select-String`/`rg` through a
  pipe.
- Reading a file that might be UTF-8: `Get-Content -Encoding UTF8`. Default
  assumes the ANSI codepage and will produce mojibake for UTF-8 files.
- PowerShell 7 (`pwsh`) is not the default shell here. If a script needs PS7
  features (`??`, ternary, `&&`), invoke `pwsh -NoProfile -Command "..."`
  explicitly.

## 5. Paths

- **Always** quote: `& "C:\Program Files\nodejs\node.exe" --version`.
  Unquoted paths with spaces are the single most common shell failure.
- Native exe with a path → call operator `&`.
- `-LiteralPath` for anything user-supplied or containing `[` `]`. `-Path`
  treats those as wildcard character classes and silently matches nothing.
- `~` works in PowerShell paths; `$env:USERPROFILE` is the explicit form.
- Non-ASCII in paths: pass through the call operator, don't pipe.

## 6. Native exes and output capture

- Exe stdout is captured fine, but stderr interleaving is not ordered — don't
  assume error lines come last.
- Exes that spawn children (npm, npx, cargo) can leave the pipe open; long
  builds may hit the tool timeout. Pass the `timeout` parameter rather than
  wrapping in `Start-Job`.
- Exit-code check after a build/install is worth it:
  ```powershell
  npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { "typecheck failed" }
  ```
- `Write-Host` / `Write-Output` for messaging: just emit plain text as your
  response instead of echoing from the shell.

## 7. Useful one-liners

```powershell
git status --short; if ($?) { git diff --stat }
python -c "import sys; print(sys.version)"
rg -n --stats "pattern" -g '*.ts'
Get-Command node | Select-Object -ExpandProperty Source
node -v; npm -v; python --version
```

## 8. Environment — detect, do not assume

- Working dir is passed with the tool's `workdir` parameter — **never** `cd` or
  `Set-Location` inside a command.
- Never hardcode machine-specific values (tool paths, home directories,
  console codepage, git status of a directory). Detect them, or read them from
  a local file that is not part of any shared config.
- Do not assume git commands work anywhere. Check first:
  ```powershell
  git rev-parse --show-toplevel
  ```
- Prefer `Get-Command <tool>` over a remembered path when you need the binary:
  ```powershell
  (Get-Command node).Source
  ```
- PowerShell 7 features (`&&`, `??`, ternary) are unavailable in 5.1. Either
  invoke `pwsh -NoProfile -Command "..."` or write 5.1-compatible syntax.
- **Log timestamps are usually UTC; `Get-Date` is local.** Anything RFC3339 with
  a trailing `Z` is UTC, and this machine is UTC+5. Comparing them directly is a
  5-hour skew, so a filter for "recent" events silently accepts or rejects the
  wrong rows — it reports clean while ignoring what just happened, or reports
  fresh failures that are hours old. Convert both sides:
  ```powershell
  (Get-Date).ToUniversalTime()
  ```
  or filter on a file timestamp (`(Get-Item $log).LastWriteTime`) instead.
- **Grepping a log for a term you just typed matches your own search.** The
  agent's commands are recorded in the same log it is reading, so a substring
  search for `"Out of memory"` also matches the `Select-String` that searched
  for it, and every repetition adds another. Count only lines carrying the
  record shape you care about (e.g. `diffStderr=`), and treat a hit count that
  grows while you are searching as self-contamination, not as new events.

If a workflow needs machine-specific facts, keep them in a machine-local file
that is excluded from version control, not baked into a shared skill.
