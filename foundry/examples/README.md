# Parent/Child Trace Example

This directory holds a curated, hand-traced example of the supervisor harness loop.

Sequence:

1. The parent captures intake in `intake.json`.
2. The parent compiles the current `PersonalBrief`.
3. The parent emits a bounded task packet in `task-packet.json`.
4. The child agent returns a result bundle in `child-run.json` and `child-output.md`.
5. The parent records an acceptance decision in `review.json`.

This is meant to show the durable handoff chain:

- desiderata become a brief
- the brief becomes a job packet
- the job packet becomes a metered child run
- the child run becomes a reviewed artifact

These files are examples, not the live mutable working ledger.
