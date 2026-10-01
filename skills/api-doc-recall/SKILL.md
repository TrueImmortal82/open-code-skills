---
name: api-doc-recall
description: Verify a library's API against the source you actually have installed, rather than against memory or documentation. Use when calling a package whose exact signature matters; when a version may have changed an API, a default export, or a hook name; when a doc page and the installed code disagree; when writing against the `opencode` plugin, skill, config, or agent API; or when a type error suggests the declared shape is not what the docs claim. Ships scripts/api-check.mjs, which locates a member's declaration in the installed source and reports file and line, exiting 1 when a name does not exist.
---

# API doc recall

Recalling an API from training is a guess wearing the costume of knowledge. It
is often right, which is exactly the problem: a confident wrong signature costs
more to debug than an admission of uncertainty, because nothing looks broken
until it does.

## When to use this

- Calling a package where the exact signature matters.
- A version bump may have changed an API, a default export, or a hook name.
- A documentation page and the installed code disagree.
- Writing against a fast-moving internal API, such as `opencode` itself.
- A type error suggests the declared shape is not what the docs claimed.

## Rules

1. **The installed source is the authority.** Not the docs, not the tutorial,
   not memory. Docs describe a version; the code in `node_modules` is the
   version that will actually run.
2. **Look for the declaration, not a usage example.** A tutorial shows how the
   API is *meant* to be used; a declaration shows what it accepts. They diverge
   exactly when something changed.
3. **Check the shape of the export, not just the name.** Whether a plugin default
   exports a function or an object, whether a hook receives one argument or two,
   whether a config key is `skills.paths` or `skills` — these are the details
   that decide whether the code works, and all of them are cheap to read.
4. **Search for the name, then read around it.** The declaration tells you the
   signature; the lines after it tell you the validation, and the throw
   messages tell you what the library will reject.
5. **A name that is not found is a finding.** It means the export was renamed,
   removed, or never existed. That is the answer, not a reason to keep guessing.
6. **Version-pin the answer when it matters.** A signature read from source is
   true for that version. When the value is load-bearing, say which version you
   read, so the next reader knows whether to re-check.

## Checking

```bash
node scripts/api-check.mjs <package-or-path> <member> [<member>...]
node scripts/api-check.mjs <package-or-path> --grep <pattern>
```

Reports the package version, the path resolved, how many source files were
searched, and each member's declaration with file and line.

Exit codes: `0` all members found, `1` a member was not found, `2` package
unreadable.

```bash
node scripts/api-check.mjs ./packages/opencode readV1Plugin PluginEntry
node scripts/api-check.mjs opencode-ai            # lists entry points
```

A bare package name resolves from the current working directory, so run it from
inside the project whose dependencies you care about. A path is taken as given,
which is the reliable form when the package is not installed here — for example
reading a checkout of a library you are contributing to.

`dist` is skipped deliberately: it contains compiled copies of the same
declarations, and a build artefact is not the thing you want to quote.

## When the source is not available

A minified bundle, a compiled binary, or a closed-source package has no readable
declaration. In that order of preference: read the `.d.ts` if one ships; call
the function and print what you got, in a scratch script, rather than in your
real code; or check the package's own tests, which are written against the real
API and go stale more slowly than its docs.

## Checklist

- [ ] Read the installed source, not recalled or documented API
- [ ] Found the declaration rather than a usage example
- [ ] Checked the export shape, not only the name
- [ ] Read the validation and throw messages around it
- [ ] Recorded which version the signature was read from
- [ ] A not-found name treated as an answer, not a puzzle
