# BuntuAsk

Gamified micro-tasking platform for translation and data-labeling workflows.

## Phase 1 scaffold

This branch contains the infrastructure and database foundation:

- Docker Compose topology for PostgreSQL 15, Redis 7, MinIO, FastAPI, and a WhatsApp sidecar scaffold.
- FastAPI package structure with SPA catch-all routing and `/api/v1/health`.
- SQLModel domain models for users, projects, policies, tasks, submissions, reviews, transactions, and fraud alerts.
- Alembic configuration plus the initial PostgreSQL schema migration.

Run the stack with:

```bash
docker compose up --build
```

The API is exposed on `http://localhost:8000`, MinIO API on `http://localhost:9000`, and MinIO Console on `http://localhost:9001`.

## Dogfood demo lock (HTTP Basic Auth)

The production dogfood stack is wrapped in HTTP Basic Auth before the SPA loads (separate from JWT login).

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASIC_AUTH_ENABLED` | `true` | Toggle demo lock |
| `BASIC_AUTH_USER` | `guido` | Basic auth username |
| `BASIC_AUTH_PASSWORD` | `guido` | Basic auth password |

Exempt routes (no Basic Auth): `GET/HEAD /`, `/og-image.png`, `/robots.txt`, and `/api/v1/health` (Compose health checks).

Implementation: `api/app/middleware/basic_auth.py` (Starlette middleware on the FastAPI app). For nginx-only deployments, mirror the same path exemptions.

## Link previews (Open Graph)

Share the public demo origin (set `PUBLIC_SITE_URL` to that HTTPS URL, e.g. your Contabo host). The API injects absolute `og:url` and `og:image` into `index.html` at serve time.

Static assets:

- `frontend/public/og-image.png` — 1200×630 branded preview image
- Meta tags in `frontend/index.html` (`twitter:card=summary_large_image`)

WhatsApp/Facebook crawlers do not send Basic Auth credentials. Exempt `GET/HEAD /` and `/og-image.png` so previews still work while the rest of the app stays locked.

Verify:

```bash
curl -I https://YOUR_PUBLIC_SITE_URL/
curl -I -A 'facebookexternalhit/1.1' https://YOUR_PUBLIC_SITE_URL/
curl -I https://YOUR_PUBLIC_SITE_URL/og-image.png
curl -I https://YOUR_PUBLIC_SITE_URL/api/v1/health
curl -I -u guido:guido https://YOUR_PUBLIC_SITE_URL/assets/
```
