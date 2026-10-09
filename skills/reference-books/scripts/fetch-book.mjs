#!/usr/bin/env node
// fetch-book.mjs — resolve the live file listing of a public Google Drive
// folder and download the requested book as a real PDF.
//
// Usage:
//   node fetch-book.mjs "SQL"            download the first fuzzy match
//   node fetch-book.mjs --list           print every book name without IDs
//   node fetch-book.mjs --list-ids       print name :: fileID pairs
//   node fetch-book.mjs "sql" --out DIR  download into DIR (default: cwd)
//
// The folder listing is fetched from the folder page and per-file ids are
// parsed out of data-id / data-tooltip. The public download URL
// https://drive.google.com/uc?export=download&id=<FILE_ID> is used directly;
// for this shelf it returns PDF bytes, not an HTML virus-scan page.
//
// Exit codes: 0 matched and downloaded, 1 nothing matched, 2 ambiguity
// (several files matched; nothing downloaded).

const FOLDER_ID = "1j7l7CVK46aIYnuaXL5iRS6FU53TCwSTR";
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}`;
const DOWNLOAD_BASE = "https://drive.google.com/uc?export=download&id=";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx !== -1 ? args[outIdx + 1] : ".";
const listOnly = args.includes("--list");
const listIds = args.includes("--list-ids");
const query = args.filter(
  (a) => a !== "--out" && a !== "--list" && a !== "--list-ids" && a !== outDir,
)[0];

function fail(msg, code) {
  console.error(`fetch-book.mjs: ${msg}`);
  process.exit(code);
}

async function listFiles() {
  const res = await fetch(FOLDER_URL, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) fail(`folder fetch HTTP ${res.status}`, 1);
  const html = await res.text();
  const re =
    /data-id="([A-Za-z0-9_-]{25,})" jsname="vtaz5c" data-tooltip-class="cAHxfe" data-tooltip-delay="500" data-tooltip="([^"]*\.pdf[^"]*)"/g;
  const files = [];
  for (const m of html.matchAll(re)) {
    // data-tooltip ends with " PDF" (the kind badge), strip it.
    const name = m[2].replace(/\s*PDF$/i, "");
    files.push({ id: m[1], name });
  }
  if (!files.length) fail("no files parsed from folder page", 1);
  return files;
}

async function download(id, name) {
  const url = `${DOWNLOAD_BASE}${id}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) fail(`download HTTP ${res.status} for ${name}`, 1);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    const snippet = buf.subarray(0, 300).toString("latin1").replace(/\s+/g, " ");
    fail(`not a PDF for ${name} (got: ${snippet.slice(0, 120)}...)`, 1);
  }
  return buf;
}

const files = await listFiles();

if (listOnly) {
  for (const f of files) console.log(f.name);
  process.exit(0);
}
if (listIds) {
  for (const f of files) console.log(`${f.name} :: ${f.id}`);
  process.exit(0);
}
if (!query) fail("no book name given; use --list to see the shelf", 2);

const q = query.trim().toLowerCase();
const matches = files.filter(
  (f) => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase()),
);
if (!matches.length) fail(`no book matches "${query}" (use --list)`, 1);
if (matches.length > 1) {
  console.error(`"${query}" matches ${matches.length} books; narrow it:`);
  for (const m of matches) console.error(`  ${m.name}`);
  process.exit(2);
}

const { id, name } = matches[0];
const data = await download(id, name);
const dest = `${outDir.replace(/[\\/]$/, "")}/${name}`;
const { writeFileSync } = await import("node:fs");
const { mkdirSync } = await import("node:fs");
mkdirSync(outDir, { recursive: true });
writeFileSync(dest, data);
console.log(`ok: ${dest} (${(data.length / 1048576).toFixed(1)} MiB)`);