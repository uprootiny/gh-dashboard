# Live Apps and Variation Matrix

This repo now has four public surfaces:

- `/` - foundry intake, brief compiler, tooling pulse
- `/tarot/` - tarot image generation with provider diagnostics
- `/orbital/` - orbital workbench with live probes and trace bus
- `/ops/` - GitHub-facing ops dashboard

## What is actually live

GitHub Pages hosts the static shells.

That means:

- UI, navigation, copy, and client-side logic are public and live
- browser-side diagnostics and local metering are live
- relay-backed LLM or image generation is only live if a reachable VPS API base is configured

The Pages deployment is realistic because the app is static.
The relay is realistic because it is a small Node server that keeps secrets off the client.

## Tarot behavior

`/tarot/` uses a concrete provider chain:

1. relay at `API base` if configured
2. `Pollinations.ai` as a free browser-usable image fallback
3. local SVG fallback if remote paths fail

The page records local browser metering:

- total attempts
- fallback events
- last provider used
- last latency
- per-provider success counts
- recent event log

It also probes relay health:

- `/api/health`
- `/api/capabilities`

This means the app is no longer only decorative.
It can either generate a real remote image or explain exactly how it degraded.

## Orbital behavior

`/orbital/` now mixes symbolic mechanics with real probes.

Without a relay it still reflects live public state by reading:

- GitHub repo freshness from `https://api.github.com/repos/uprootiny/gh-dashboard`
- GitHub core rate-limit state from `https://api.github.com/rate_limit`

With a relay configured it also reads:

- `/api/capabilities`
- `/api/foundry/trace`
- `/api/foundry/recovery`

Those diagnostics affect both:

- the explicit UI panels
- the orbital ring behavior itself

So the workbench is still expressive, but it is no longer a pure toy.

## Deployment modes

### Mode A - Pages only

Use this when:

- you want a public demo
- you do not want to run a VPS yet

What works:

- foundry intake and local emulated brief rendering
- tarot with Pollinations or SVG fallback
- orbital with public GitHub probes
- ops dashboard with browser-supplied GitHub token

What does not fully work:

- relay-backed LLM compilation
- shared server-side metering
- protected provider secrets

### Mode B - Pages + VPS relay

Use this when:

- you want real LLM calls
- you want relay-backed tarot generation
- you want foundry trace/recovery APIs

What works:

- all of Mode A
- `/api/foundry/brief`
- `/api/chat`
- `/api/tarot-image`
- `/api/foundry/*` trace and recovery surfaces

### Mode C - VPS only

Use this when:

- you want one origin serving both static and API content
- you want simpler local debugging

What works:

- same features as Mode B
- the backend serves static files directly

## Tested scenario matrix

Automated coverage now includes:

### Static shell checks

- root route publishes foundry/compiler surfaces
- tarot route publishes metering and diagnostics surfaces
- orbital route publishes reality probes and trace bus
- ops route still publishes the GitHub dashboard shell

### Relay/API scenarios

- no configured remote keys
- OpenAI key present
- Anthropic + OpenRouter keys present
- custom provider order

For each scenario the tests verify:

- `/api/health`
- `/api/providers`
- `/api/capabilities`
- `/api/admin/summary`
- `/api/admin/events`
- `/api/foundry/trace`
- `/api/foundry/recovery`
- `/api/tarot-image`
- `/api/foundry/brief`

## What is still local-only

The tarot metering ledger is stored in browser local storage.

That is deliberate for now:

- it works on Pages
- it is private to that browser
- it avoids pretending there is shared telemetry when there is not

If you want shared usage history, add server-side event logging on the relay.

## How to verify manually

### Tarot

1. Open `/tarot/`
2. Leave `API base` empty
3. Generate once and confirm:
   - a remote image loads or SVG fallback appears
   - `Last provider` updates
   - `Total attempts` increments
   - `Fallback events` increments when relay fails first
4. Set a real relay URL and refresh diagnostics
5. Confirm relay status reports configured providers

### Orbital

1. Open `/orbital/`
2. Confirm `Reality probes` shows GitHub repo freshness and rate info
3. Drag rings and verify the motion still responds
4. Set a real relay URL
5. Click `Refresh probes`
6. Confirm trace count and recovery status populate when the relay is reachable

## Current honest boundary

The apps are now:

- live
- usable
- connected to real public or relay-backed signals
- explicit about fallback and degradation

They are not yet a full production analytics system.
That would require server-side event persistence, authentication, and stronger relay hardening.
