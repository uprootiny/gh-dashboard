# Hynous Foundry

Ἑυνοῦς is now a small personal AI harness foundry:

- static frontend for GitHub Pages
- VPS-ready Node API
- foundry intake across practical, behavioral, and symbolic strata
- resilient LLM routing with fallback order
- live GitHub quota dashboard retained as a tooling panel

## What runs where

- GitHub Pages serves the static app from this repo.
- A VPS runs `api/server.mjs` and holds provider secrets.
- The frontend talks to the VPS through the configurable `API base URL` field.

Do not put provider API keys in GitHub Pages. The frontend is public.

## Local development

1. Copy `.env.example` to `.env`.
2. Export the variables you want to use, for example:

```bash
set -a
source .env
set +a
```

3. Start the app:

```bash
npm start
```

4. Open `http://localhost:8787`.

## Provider fallback order

The backend tries providers in `LLM_PROVIDER_ORDER` order:

- `openai`
- `anthropic`
- `openrouter`
- `ollama`

It retries transient failures up to `LLM_MAX_RETRIES` and falls back to a deterministic local brief if everything fails.

## API endpoints

- `GET /api/health`
- `GET /api/providers`
- `GET /api/capabilities`
- `GET /api/admin/summary`
- `GET /api/admin/events`
- `POST /api/chat`
- `POST /api/foundry/brief`
- `POST /api/tarot-image`

## Validation

Run the local validation passes before deploying:

```bash
npm run check
npm test
```

The smoke pass verifies:

- the root foundry app
- the tarot app
- the ops app
- the orbital app
- relay health and provider discovery
- relay capability and admin surfaces
- chat fallback
- foundry brief compilation
- tarot image generation or explicit local fallback
- relay variation scenarios with and without configured providers

Detailed live-surface and deployment behavior is documented in [`docs/LIVE_APPS.md`](./docs/LIVE_APPS.md).

## GitHub Pages

This repo includes [`.github/workflows/pages.yml`](./.github/workflows/pages.yml).

After pushing to `main`:

1. In GitHub, open `Settings` -> `Pages`.
2. Set source to `GitHub Actions`.
3. Let the workflow publish the repository root.

Expected Pages URL:

`https://uprootiny.github.io/gh-dashboard/`

On GitHub Pages, set the `API base URL` field to your VPS origin, for example:

`https://foundry.example.com`

## VPS deployment

Assume Ubuntu, nginx, systemd, and Node 18+.

1. Clone the repo to `/opt/hynous-foundry`.
2. Copy `.env.example` to `/opt/hynous-foundry/.env` and fill in secrets.
3. Install Node 18+.
4. Start locally once:

```bash
cd /opt/hynous-foundry
set -a
source .env
set +a
node api/server.mjs
```

5. Install the systemd unit from [`deploy/systemd/hynous-foundry.service`](./deploy/systemd/hynous-foundry.service).
6. Install the nginx site from [`deploy/nginx/hynous-foundry.conf`](./deploy/nginx/hynous-foundry.conf).
7. Add TLS, ideally with `certbot`.

## Notes

- The backend serves static files too, so the VPS can host the whole app directly.
- GitHub Pages is static-only; that is why the API base is configurable in the UI.
- The foundry compiler currently emits a `PersonalBrief` JSON structure and can be expanded with persistent traces, editable hypotheses, and multi-agent build launch.
- `/tarot/` now uses a concrete chain: relay -> Pollinations -> SVG fallback.
- `/orbital/` now probes public GitHub state plus optional relay/foundry state.
- `/ops/` now also shows relay/foundry summary when an API base is configured.
