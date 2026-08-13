#!/usr/bin/env bash
set -euo pipefail

# M2: PostgreSQL restore — DOCUMENTED MANUAL PROCEDURE.
#
# DESTRUCTIVE: overwrites objects in the target database. This script has
# been reviewed for syntax only — it has NOT been executed against any real
# database (local or production) as part of M2. Test it against a disposable
# local database before relying on it.
#
# Usage:
#   ./scripts/restore-postgres.sh <dump-file> --yes
#
# Env vars: same as backup-postgres.sh (DATABASE_URL, PG_CONTAINER, PGUSER, PGDATABASE)

DUMP_FILE="${1:?Usage: restore-postgres.sh <dump-file> --yes}"
CONFIRM="${2:-}"

PG_CONTAINER="${PG_CONTAINER:-edlearn-postgres}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-edlearn}"

if [ "$CONFIRM" != "--yes" ]; then
  echo "This will OVERWRITE objects in database '$PGDATABASE'."
  echo "Re-run with --yes to proceed:"
  echo "  $0 \"$DUMP_FILE\" --yes"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

echo "==> Restoring $DUMP_FILE into $PGDATABASE"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DUMP_FILE"
else
  docker exec -i "$PG_CONTAINER" pg_restore --clean --if-exists --no-owner --username="$PGUSER" --dbname="$PGDATABASE" < "$DUMP_FILE"
fi

echo "==> Restore complete."
echo "==> Verify with, e.g.: psql \"\$DATABASE_URL\" -c '\\dt' and an app health check."
