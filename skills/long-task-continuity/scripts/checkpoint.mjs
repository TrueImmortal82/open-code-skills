#!/usr/bin/env node
// Keep a task's state in a file that outlives the conversation. A checkpoint
// that only exists in context is lost at compaction; one on disk is not.
//
// Usage: node checkpoint.mjs <command> [args]
//   set <task>        record goal, next step, and open items
//   show [task]        print the current checkpoint
//   done <task> <n>    mark item n of the task complete
//   add <task> <text>  append an open item
//   clear <task>       remove a checkpoint
// Exit 0 = ok, 1 = no such checkpoint, 2 = bad usage or unwritable store.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const STORE = join(homedir(), ".config", "opencode", "checkpoints.json")
const argv = process.argv.slice(2)
const [command, ...rest] = argv

function die(message, code) {
  console.error(`checkpoint: ${message}`)
  process.exit(code)
}

function load() {
  if (!existsSync(STORE)) return {}
  try {
    const parsed = JSON.parse(readFileSync(STORE, "utf8"))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    // A corrupt store must not block the task; the caller can overwrite it.
    return {}
  }
}

function save(data) {
  try {
    mkdirSync(join(STORE, ".."), { recursive: true })
    writeFileSync(STORE, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  } catch (error) {
    die(`cannot write ${STORE}: ${error.message}`, 2)
  }
}

const USAGE = [
  "usage:",
  "  checkpoint.mjs set <task> --goal <text> --next <text> [--item <text>]...",
  "  checkpoint.mjs show [task]",
  "  checkpoint.mjs done <task> <n>",
  "  checkpoint.mjs add <task> <text>",
  "  checkpoint.mjs clear <task>",
].join("\n")

// `set` takes its text as --flag pairs so a multi-word goal needs no quoting
// rules that differ between shells.
function parseFlags(args) {
  const out = { item: [] }
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i].replace(/^--/, "")
    const val = args[i + 1]
    if (val === undefined) die(`--${key} needs a value`, 2)
    if (key === "item") out.item.push(val)
    else out[key] = val
    i += 1
  }
  return out
}

function render(task, entry) {
  const open = entry.items.filter((i) => !i.done)
  console.log(`task:  ${task}`)
  console.log(`goal:  ${entry.goal ?? "(not set)"}`)
  console.log(`next:  ${entry.next ?? "(not set)"}`)
  console.log(`saved: ${entry.saved}`)
  console.log(`items: ${open.length} open, ${entry.items.length - open.length} done`)
  for (const [i, item] of entry.items.entries()) {
    console.log(`  ${i + 1}. [${item.done ? "x" : " "}] ${item.text}`)
  }
}

function main() {
  if (!command) die(USAGE, 2)
  const store = load()

  if (command === "set") {
    const [task, ...args] = rest
    if (!task) die(USAGE, 2)
    const flags = parseFlags(args)
    if (!flags.goal || !flags.next) die("set needs --goal and --next", 2)
    store[task] = {
      goal: flags.goal,
      next: flags.next,
      // Replace the item list on a fresh set: the previous plan is stale by
      // definition, and keeping it invites acting on a superseded next step.
      items: flags.item.map((text) => ({ text, done: false })),
      saved: new Date().toISOString(),
    }
    save(store)
    render(task, store[task])
    return
  }

  if (command === "show") {
    const task = rest[0]
    const keys = task ? [task] : Object.keys(store)
    if (!keys.length) die("no checkpoints stored", 1)
    for (const [i, key] of keys.entries()) {
      if (i) console.log("")
      if (!store[key]) die(`no checkpoint named "${key}"`, 1)
      render(key, store[key])
    }
    return
  }

  const [task, ...args] = rest
  if (!task) die(USAGE, 2)
  const entry = store[task]
  if (!entry) die(`no checkpoint named "${task}"`, 1)

  if (command === "done") {
    const n = Number(args[0])
    const index = n - 1
    if (!Number.isInteger(index) || index < 0 || index >= entry.items.length) {
      die(`item ${args[0]} is out of range (1..${entry.items.length})`, 2)
    }
    entry.items[index].done = true
    const open = entry.items.filter((i) => !i.done)
    if (open.length === 0) entry.next = "(all items done — set a new goal)"
    save(store)
    render(task, entry)
    return
  }

  if (command === "add") {
    const text = args.join(" ")
    if (!text) die("add needs text", 2)
    entry.items.push({ text, done: false })
    save(store)
    render(task, entry)
    return
  }

  if (command === "clear") {
    delete store[task]
    save(store)
    console.log(`cleared ${task}`)
    return
  }

  die(`unknown command "${command}"\n${USAGE}`, 2)
}

main()
