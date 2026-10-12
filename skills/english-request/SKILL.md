---
name: english-request
description: Do the model's own work in English while keeping the reply in the user's own language, so a long transcript costs fewer tokens. Use when the user's message is not in English — Russian/Cyrillic, Uzbek, or any other language — especially for long or multi-step requests; when the user asks to work in English to save tokens; or when a conversation is growing long in a non-English language. Restate the request in English for yourself, run all reasoning, planning, notes and tool arguments in English, and write only the final reply in the user's language (e.g. `ru`, `uz`). If the message is already `en`, do nothing. Never translate or alter code, paths, identifiers, commands, or quoted text; do not echo the translation into the reply.
---

# English request

Do your own work in English; keep the reply in the user's language. The point
is token cost: the model's **generated** tokens — reasoning, plans, notes, tool
arguments, drafts — dominate a long transcript, and the same ideas are roughly
2–4× cheaper in English than in Cyrillic or another non-Latin script.

## Why the saving is not in the request

Translating the request does not shrink it: the user's original message stays
in context and costs its tokens either way. The lever is your generated tokens.
So restate the request in English **for yourself** and generate everything
internal in English. Printing the translation back would add tokens for no
gain, which is the opposite of the goal.

## Rules

1. **Restate, do not echo.** Understand the request by restating it in English
   in your working notes. Never print the translation or announce this skill.
2. **Internal English.** Run planning, reasoning, todo items, code comments,
   commit messages, and tool-call arguments in English.
3. **Reply in the user's language.** The reply stays in whatever language the
   user wrote in. This skill changes your working language, not theirs.
4. **Change nothing verbatim.** Leave code, identifiers, file paths, commands,
   URLs, error strings, and quoted user text exactly as given. Rewrite only
   your own prose.

## Do not

- Do not translate the user's documents or files — that is a different task and
  would change their content.
- Do not switch the reply to English "for consistency".
- Do not fire when the message is already English.

## Checklist

- [ ] Worked from an English restatement I did not print.
- [ ] Plan, notes, tool arguments, and comments are in English.
- [ ] Reply is in the user's language and reads naturally, not as a translation.
- [ ] Code, paths, identifiers, commands, and quotes are unchanged.
