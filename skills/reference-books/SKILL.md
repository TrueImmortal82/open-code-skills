---
name: reference-books
description: Answering a question by pulling the relevant book from the 'Aris bookshelf' library on Google Drive and reading the solution out of its PDF. The shelf is a public folder (folder ID and per-file data-id are resolved live, not guessed) with Python, AI, ML, SQL, databases, security and testing references. Covers picking the right book for the topic, downloading it with fetch-book.mjs, then reading the answer with the pdf skill instead of skimming the whole volume. Use when the user points at a book or a topic that a reference answers (drawing, time series, pandas, SQL, quantum, OOP), when a previously downloaded copy is already on disk, or when the ask is a definition, formula or recipe a book settles. Not for codebase questions (see api-doc-recall) or for multi-source research (see research-synthesis).
---

# Reference books: fetch the book, read the answer

There is a library of technical books in the public Google Drive folder
`1j7l7CVK46aIYnuaXL5iRS6FU53TCwSTR` (the "Aris bookshelf"). When the user asks
something a reference settles — a definition, a formula, a recipe, a design
pattern, a best practice — pull the right book from the shelf and answer from
its text, not from memory. The shelf is live: names and file ids are parsed
from the folder page at call time, so a new file appears without a code change.

## When to use this

Use this when the question is slow-moving knowledge a book would contain:

- The user names a book or a topic on the shelf ("по книге по pandas", "SQL",
  "временные ряды", "квантовые вычисления", "графика на Python").
- The answer is a settled recipe: how SQL joins work, how to fit a pandas
  DataFrame, how to structure a Python project, how an algorithm is defined.
- The user asks about an OOP-by-example book (Lott), a beginner tutorial
  (Васильев), a handbook (Шпаргалка тестировщика), or a "unlock the secrets"
  performance/security/causal-inference title.

Do not use this for:

- Questions about a codebase the user is working in — see `api-doc-recall`.
- A synthesis across several sources — see `research-synthesis`.
- Anything where the up-to-date truth lives in docs, not a book.

## Rules

Ordered by how often they go wrong.

### 1. Match the ask from the catalog, not from guessing

The catalog in `references/catalog.md` is the semantic index of the shelf:
every book with its topic, language, what it covers, and a "use when". Read it
first — do not scan the drive or guess a title from memory. Find the row
whose topic and "use when" fit the ask, then download exactly that file.

The topic map at a glance:

| Topic | Look for |
| --- | --- |
| Python basics / learning | `Васильев`, `quick-python-3`, `Python_К_вершинам_мастерства` |
| Python data analysis | `Pandas.Cookbook`, `Python_dlya_analiza_dannyh` |
| OOP in Python | `Lott_Obektno-orientirovannyy` |
| Backend / web security | `programmirovanie-bekenda`, `Безопасность_веб_приложений` |
| ML / AI theory | `Машинное_обучение`, `Основы ИИ`, `Сотник`, `python_code_for_artificial_intelligence` |
| NLP | `Обработка_естественного_языка` |
| Time series | `Практический_анализ_временных_рядов` |
| Causal inference | `causal_inference_and_discovery` |
| Quantum computing | `Изучаем_квантовые_вычисления` |
| 3D / graphics | `Трехмерное_глубокое_обучение`, `Графика на Python` |
| SQL / databases | `SQL быстрое погружение`, `Перспективные_методы_проектирования_реляционных` |
| IoT security | `Практический_хакинг_интернета_вещей` |
| Testing | `Шпаргалка_начинающего_тестировщика` |
| DevOps | `devops_unleashed_with_git` |

If the topic is not in the catalog, say so plainly instead of inventing a
match; the catalog also lists what the shelf conspicuously lacks.

### 2. Download with the script, one file at a time

- `node scripts/fetch-book.mjs --list` — see every title (use before a
  fuzzy name).
- `node scripts/fetch-book.mjs --list-ids` — see `name :: fileID` pairs, for
  when a title matches several copies.
- `node scripts/fetch-book.mjs "<name>" --out <dir>` — download. Exit codes:
  `0` matched and saved, `1` no match, `2` several matches (list them and
  re-run with a name unique enough).

The script checks the `%PDF-` magic bytes after download, so a "virus scan"
HTML page is never silently kept as a PDF. Save into a downloads folder and
remember the path; do not re-download a file already on disk.

### 3. Read the relevant part, not the volume

Books here are 4–50 MB. Do not read the whole PDF for one question. Use the
`pdf` skill to extract text, then locate the section that answers the ask:
chapter titles, table of contents, an index. Quote the page or section when
you answer, so the user can check.

### 4. Answer from the book, not from memory

The point of the fetch is that the book is the source. When the book is
internalized (e.g., the user's own handbook), an answer can use it directly;
when it is a third-party reference, answer with the book's wording and give
the page. Do not let a download replace a question — if the ask stays unclear
after the book is read, say what the book covers and re-ask.

### 5. Keep the catalog current

The catalog is the lookup table the agent reads first, so it must reflect the
live shelf. Run `node scripts/fetch-book.mjs --verify-catalog`; it prints every
live file missing from `references/catalog.md` and exits 1 if any. For each,
add a row (topic, language, one-line covers, use when) and update the SKILL.md
topic map. Treat `(N)`-suffixed names as duplicates of their base book, not as
new books. Commit the update so the next session does not have to re-derive it.

If the topic is missing after that, do not guess a book exists. Name the gap:
"this shelf does not carry <topic>" and offer the closest neighbor.

## Reference

- `references/catalog.md` — the full semantic index of the shelf: every book
  with topic, language, what it covers, use-when, plus the list of topics the
  shelf lacks. **Read this first** to pick a book; it is also where a newly
  discovered file is registered.
- `references/shelf.md` — the live listing commands and the exit-code
  contract of `fetch-book.mjs`; read when a download returns something other
  than a `%PDF-` file.
- `scripts/fetch-book.mjs` — the downloader. It resolves the folder page's
  `data-id`/`data-tooltip` at runtime and fetches
  `https://drive.google.com/uc?export=download&id=<FILE_ID>` for the match.
  Run directly on any machine with Node 18+.

## Checklist

- [ ] Scanned the shelf and picked the single most relevant book by topic
- [ ] Downloaded with `fetch-book.mjs` (exit 0) into a known folder; not
      re-downloading an existing file
- [ ] Extracted the answer with the `pdf` skill from the right section, and
      the answer cites the book/chapter
- [ ] Topic not on the shelf reached the user as an explicit gap, not a guess