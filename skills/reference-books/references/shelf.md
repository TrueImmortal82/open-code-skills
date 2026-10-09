# The Aris bookshelf: live listing and contract

Folder: `https://drive.google.com/drive/folders/1j7l7CVK46aIYnuaXL5iRS6FU53TCwSTR`
(public, readable without auth). The list below is a snapshot; the script
re-resolves names and ids from the folder page every run, so this file is for
orientation, not for ids.

## Commands

```text
node scripts/fetch-book.mjs --list                      # every title
node scripts/fetch-book.mjs --list-ids                  # title :: fileID
node scripts/fetch-book.mjs "substring" --out DIR       # download
```

The downloader lives next to this file in `../scripts/fetch-book.mjs`.

## Exit codes

| Exit | Meaning | Action |
| --- | --- | --- |
| 0 | one match, saved as `DIR/<name>.pdf` | read it with the pdf skill |
| 1 | no book matched the query | re-run with `--list` to see real titles; do not invent a name |
| 2 | several matches | the script printed them; narrow the query |

## What the script checks

- The folder page must parse at least one `data-id`/`data-tooltip` pair.
- The download must start with `%PDF-` magic bytes. An HTML virus-scan page is
  rejected with exit 1 instead of being saved as a `.pdf`.

## Download mechanic

`fetch-book.mjs` fetches
`https://drive.google.com/uc?export=download&id=<FILE_ID>` with a browser
user-agent, streams the body to disk and verifies the magic bytes. For this
shelf it returns PDF bytes directly (no `confirm=` round-trip); if a future
file trips the scan page the script fails loudly rather than saving garbage.