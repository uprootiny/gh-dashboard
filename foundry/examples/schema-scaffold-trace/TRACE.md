# Schema Scaffold Trace

This is a manual trace of one full parent/child loop.

## 1. Parent intake

The parent captures practical, behavioral, symbolic, and trace inputs in `intake.json`.

## 2. Parent synthesis

The parent compiles those inputs into `personal-brief.json`. The brief becomes the governing artifact for later work.

## 3. Parent delegation

The parent issues `task-packet.json` for `schema-scaffold` with:

- role: `implementer`
- preferred agent: `codex`
- fallback: `gemini`
- token budget: `9000`
- time budget: `15 minutes`
- explicit constraints and success conditions

## 4. Child execution

The child returns:

- `child-run.json` with meter and routing data
- `child-output.md` with the bounded result

The run records how raw inference was shaped:

- it was assigned to a specific role
- it was budgeted
- it was attached to one task packet
- it produced one durable artifact

## 5. Parent review

The parent records `review.json`, which closes the loop externally instead of trusting the child to judge itself.

That is the intended invariant:

spec -> packet -> metered run -> reviewed artifact
