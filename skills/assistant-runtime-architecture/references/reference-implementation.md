# Reference implementation map (LifeCompanion)

A concrete codebase that implements the patterns in this skill, useful as a
worked example when you need to see a real supervisor/child topology, a durable
turn transaction, or a gender contract end to end.

**Only relevant when that repository is available to you.** It is not bundled
with this skill and is not required to follow the guidance. Paths below are from
the 2026-08 revision; line numbers drift.

| Path | What it demonstrates |
| --- | --- |
| `app/windows_supervisor.py` | Qt supervisor, `QProcess`, stdin pipe between supervisor and runtime child |
| `app/runtime.py` | services bootstrap, supervisor command loop, `request_shutdown`, durable inbound handling |
| `app/agent_loop.py` | `start_run`, soft-repair dispatch |
| `app/output_contracts.py` | `OutputContractPipeline.apply` layer ordering |
| `app/turn_transaction.py` | `prepare_delivery`, `complete_delivery`, `_project_assistant_history` |
| `app/gender_contract.py` | morphological gender enforcement |
| `app/voice.py` | TTS worker subprocess lifecycle |
| `tests/test_gender_contract.py` | strict-mode and repair-guard regression tests |

## How to use this map

Read the entry that matches the failure you are debugging, not the whole
repository. The supervisor/stdin-inheritance material is the one that pays off
most often: it is the failure that looks like a random crash and is actually a
handle-inheritance bug.

When you adapt a pattern from here, keep the *invariant* rather than the code.
The invariants are the same across implementations; the file layout is not.
