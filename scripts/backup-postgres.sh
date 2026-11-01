#!/usr/bin/env bash
# Dump BuntuAsk Postgres from the Docker Compose stack.
# Usage: ./scripts/backup-postgres.sh [output_dir]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [[ -f .env.example ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.example
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-buntuask}"
POSTGRES_USER="${POSTGRES_USER:-buntu}"
OUT_DIR="${1:-./backups}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/buntuask-${POSTGRES_DB}-${STAMP}.sql.gz"

echo "Writing backup to ${OUT_FILE}"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl | gzip -9 > "$OUT_FILE"
echo "Done: ${OUT_FILE}"
