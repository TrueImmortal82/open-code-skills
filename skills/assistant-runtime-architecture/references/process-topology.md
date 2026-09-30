# Process topology — supervisor GUI + runtime child

## Shape

Two processes, one pipe, JSON-lines commands.

- **Supervisor** (PySide6): owns exactly one `QProcess` that launches the
  runtime. It must never enumerate or kill unrelated processes to find "its"
  child — matching on window title or command line will eventually kill the
  user's editor.
- **Child** (runtime): runs a daemon thread reading `for raw_line in sys.stdin:`
  and dispatching JSON commands (`{"command": "shutdown"|"restart", ...}`).
- **Events flow back on stdout**: one line per event, prefixed `@@EVENT@@`
  followed by JSON. Parse defensively — a native library writing to stdout
  corrupts the stream if the prefix is not checked first.
- **Secrets go through the environment**, never argv. argv is visible to every
  process listing on the box and lands in crash dumps.
- The supervisor sets a marker env var (e.g. `SUPERVISED=1`) so the child knows
  it must report to the supervisor and must treat an EOF as fatal.

## Death detection

When the supervisor's write end of the stdin pipe closes, the child's `sys.stdin`
hits EOF. Logic:

- `SUPERVISED=1` **and** no shutdown was requested → emit `supervisor_lost`,
  then shut down non-zero.
- shutdown was requested → exit cleanly, `0`.

This asymmetry is what distinguishes "the user closed the app" from "the app
died and I should die with it". Getting it backwards gives you either an
orphaned runtime holding the DB lock, or an assistant that quits every time
stdin is closed by a well-behaved parent.

## Lesson: nested subprocesses MUST redirect stdin

Incident, 2026-08-14: the runtime child exited 1 three to six seconds after
every voice delivery. Cause: `synthesize_to_ogg` ran
`subprocess.run([sys.executable, worker.py, ...], capture_output=True)` with
**inherited stdin**.

Under Qt `QProcess` on Windows, launching a subprocess with stdout/stderr
redirected to pipes while inheriting stdin **closes the write end of the
supervisor's stdin pipe**. The runtime then sees EOF, concludes the supervisor
is gone, and exits — leaving a half-written audio file and a lost turn.

Rule: **every** `subprocess.run`/`Popen` inside the runtime that captures
stdout/stderr must pass `stdin=subprocess.DEVNULL` (or an explicit pipe/file).
No exceptions.

Notes:

- Native exes (ffmpeg, cmd, powershell, adb) do not trigger this — only Python
  grandchildren reliably do. That is why the bug survived review.
- `stdin=None` is the same as inherited. `stdin=subprocess.PIPE` is safe but
  deadlocks if the child writes and nobody reads.
- When a runtime dies unexpectedly, grep the child's stdout log for
  `supervisor_lost` first. It is nearly always this.

## Restart and backoff

- Distinguish crash loops from restarts. Log a monotonically increasing restart
  counter; after N restarts in a window, stop and surface it instead of looping.
- The supervisor must reap zombies: check `QProcess` state transitions, not just
  `finished`.
- Never let the supervisor auto-restart while a transaction is mid-flight
  without the recovery path in `turn-pipeline.md` being able to replay it.
