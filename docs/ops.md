# BuntuAsk operations (self-hosted)

Repo-only runbook for the Docker Compose stack on a VPS (e.g. Contabo). Replace placeholders before production cutover.

## Health checks

The API exposes an unauthenticated liveness endpoint (also exempt from demo Basic Auth):

```bash
curl -fsS "https://YOUR_DOMAIN/api/v1/health"
# {"status":"ok",...}
```

Use this URL for uptime monitors (HTTP 200, JSON `status` == `ok`). The frontend is served by the same API container when `frontend/dist` is mounted.

## Nightly Postgres backups

1. Copy `.env.example` to `.env` on the host and set strong `POSTGRES_PASSWORD`.
2. Make the backup script executable: `chmod +x scripts/backup-postgres.sh`.
3. Schedule with cron (UTC example, 02:15 daily):

```cron
15 2 * * * cd /path/to/BuntuAsk && ./scripts/backup-postgres.sh /var/backups/buntuask >> /var/log/buntuask-backup.log 2>&1
```

Backups are plain `pg_dump` output gzip-compressed. Retain at least 7 daily copies off-box when possible.

Optional: uncomment the `backup` profile service in `docker-compose.yml` if you prefer a one-shot compose run instead of cron on the host.

## Restore drill

1. Stop writers: `docker compose stop api whatsapp_service` (or full `docker compose down`).
2. Restore into a fresh volume or existing DB:

```bash
gunzip -c /var/backups/buntuask/buntuask-buntuask-YYYYMMDDTHHMMSSZ.sql.gz | \
  docker compose exec -T db psql -U buntu -d buntuask
```

3. Run migrations if the dump is older than the deployed code: `docker compose run --rm api alembic upgrade head`.
4. Bring the stack up: `docker compose up -d`.
5. Verify: `curl -fsS http://127.0.0.1:8000/api/v1/health`.

Practice this on a staging clone before relying on backups in production.

## Public hostname / TLS (future Contabo cutover)

Today the dogfood demo may use a Cloudflare tunnel or raw IP. For a stable vhost:

1. Point DNS `YOUR_DOMAIN` at the VPS.
2. Terminate TLS with **Nginx Proxy Manager**, **Caddy**, or nginx on the host.
3. Reverse-proxy to the API container port (Compose publishes `8000:8000` by default):

```nginx
# illustrative — adapt to your proxy
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

4. Set `PUBLIC_SITE_URL=https://YOUR_DOMAIN` in `.env` so Open Graph tags resolve correctly.
5. Keep Basic Auth exemptions aligned with `api/app/middleware/basic_auth.py` (`/`, `/og-image.png`, `/api/v1/health`).

WhatsApp pairing still requires an admin to scan the QR in the admin dashboard wizard; sidecar session data lives in the `whatsapp_service` volume.

## CI

GitHub Actions (`.github/workflows/ci.yml`) builds the frontend and runs `pytest` in `api/` on pushes and PRs to `main`. No deploy job is included—deploy remains manual on the host via `git pull`, `docker compose up --build -d`, and optional `npm run build` in `frontend/` if not committing `dist`.
