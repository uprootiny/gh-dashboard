# Terminal Foundry

Shell-first foundry supervisor for one user on one VPS.

This control plane is intentionally durable and resumable:

- `inputs/` holds intake payloads and trace excerpts
- `state/` holds session state, inference output, job ledger, and quota posture
- `briefs/` holds compiled `PersonalBrief` artifacts
- `tasks/` holds routed work packets for Claude Code, Codex, and Gemini
- `cards/` holds tarot card definitions and render metadata
- `runs/` holds run logs

## Commands

From the repo root:

```bash
./foundry/bin/foundry intake
./foundry/bin/foundry infer
./foundry/bin/foundry compile
./foundry/bin/foundry build
./foundry/bin/foundry design-validate
./foundry/bin/foundry benchmark
./foundry/bin/foundry tarot-render --card the-lantern
./foundry/bin/foundry resume
```

## Model routing policy

- `claude-code`: architecture, synthesis, difficult review
- `codex`: scaffold and bounded implementation
- `gemini`: cheap auxiliary passes and prompt/schema support

## Resource posture

The ledger encodes a quota-aware, resume-friendly posture:

- max parallel jobs: 2
- checkpoint every step
- degrade gracefully
- avoid fragile long-lived state

## Current scope

This seed implements:

- intake capture
- preference inference
- brief compilation
- routed task generation
- machine-readable wizard flow
- machine-readable 22-card arcana deck
- compilation matrix for card/question effects
- design asset validation
- local benchmark suite
- tarot prompt/render metadata generation
- resumable state inspection

It does not yet implement direct Claude/Codex/Gemini process launching. It prepares the durable artifacts those agents should consume next.
