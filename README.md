# BuntuAsk

Gamified micro-tasking platform for Kirundi translation, audio, and labeling workflows.

## Shipped MVP (this repo)

- **Workers:** JWT auth, onboarding tour, translate/record/image task sessions, wallet balances, work summary, streak/trust UX (EN/FR/RN i18n).
- **Reviewers:** Review queue with approve/reject flows and consensus rules.
- **Admins:** Project config, HF import, fraud desk, payouts, audit trail, multi-channel notifications, **WhatsApp pairing wizard** (Baileys sidecar).
- **Public shell:** Landing page, Open Graph previews (`frontend/public/og-image.png`), mobile nav, demo **HTTP Basic Auth** gate on app routes.
- **Ops:** Docker Compose (Postgres, Redis, MinIO, API, WhatsApp sidecar), Alembic migrations, `scripts/backup-postgres.sh`, runbook in `docs/ops.md`.
- **CI:** GitHub Actions builds `frontend/` and runs `pytest` in `api/` on pushes/PRs to `main`.

Run locally:

```bash
docker compose up --build
```

API: `http://localhost:8000` · MinIO: `9000` / console `9001`

Commit `frontend/dist` when changing the UI so Compose volume mounts serve the latest bundle without a separate build on the host.

## Demo Basic Auth (dogfood lock)

Separate from JWT login — wraps the SPA before it loads.

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASIC_AUTH_ENABLED` | `true` | Toggle demo lock |
| `BASIC_AUTH_USER` | `guido` | Basic auth username |
| `BASIC_AUTH_PASSWORD` | `guido` | Basic auth password |

Exempt routes: `GET/HEAD /`, `/og-image.png`, `/robots.txt`, `/api/v1/health`.

Implementation: `api/app/middleware/basic_auth.py`.

## Link previews (Open Graph)

Set `PUBLIC_SITE_URL` to your public HTTPS origin. The API injects `og:url` and `og:image` when serving `index.html`.

WhatsApp/Facebook crawlers do not send Basic Auth — keep `/` and `/og-image.png` exempt so previews work while the app stays locked.

## Remaining production cutover

- Stable **domain + TLS** on the VPS (see `docs/ops.md` — placeholder `YOUR_DOMAIN`).
- **Pair WhatsApp** in the admin dashboard (requires a human QR scan on the sidecar phone).
- **Backups & monitoring:** schedule `scripts/backup-postgres.sh`, uptime on `GET /api/v1/health`.
- **CI** is in place; deploy remains manual (`git pull`, `docker compose up --build -d`, migrate with Alembic when needed).

Privacy/consent copy is shown on signup and the landing footer; registration stores `privacy_consent_at` on the user record (migration `0003_privacy_consent`).
