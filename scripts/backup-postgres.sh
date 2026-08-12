#!/usr/bin/env bash
set -euo pipefail

# M2: PostgreSQL backup — DOCUMENTED MANUAL PROCEDURE.
# This script is not scheduled or triggered automatically by anything in
# this repository. Run it by hand, or wire it into an external scheduler
# (cron, CI, a Kubernetes CronJob) — see docs/BACKUP_RESTORE.md.
#
# Usage:
#   ./scripts/backup-postgres.sh [output-dir]
#
# Env vars (all optional):
#   DATABASE_URL  - if set, connects directly (use this for a real
#                   remote/production database with a reachable Postgres).
#   PG_CONTAINER  - docker container to exec into when DATABASE_URL is unset
#                   (default: edlearn-postgres, matching docker-compose.yml)
#   PGUSER        - default: postgres
#   PGDATABASE    - default: edlearn

OUT_DIR="${1:-./backups/postgres}"
mkdir -p "$OUT_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/edlearn-postgres-${TIMESTAMP}.dump"

PG_CONTAINER="${PG_CONTAINER:-edlearn-postgres}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-edlearn}"

echo "==> Backing up PostgreSQL to ${OUT_FILE}"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --format=custom --file="$OUT_FILE" "$DATABASE_URL"
else
  docker exec -i "$PG_CONTAINER" pg_dump --format=custom --username="$PGUSER" "$PGDATABASE" > "$OUT_FILE"
fi

echo "==> Backup written: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
echo "==> Verify integrity with: pg_restore --list \"$OUT_FILE\""
