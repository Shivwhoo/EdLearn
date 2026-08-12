#!/usr/bin/env bash
set -euo pipefail

# M2: MongoDB backup — DOCUMENTED MANUAL PROCEDURE.
# Not scheduled automatically — see docs/BACKUP_RESTORE.md.
#
# Usage:
#   ./scripts/backup-mongo.sh [output-dir]
#
# Env vars (all optional):
#   MONGODB_URI     - if set, connects directly (use for a real remote/prod Mongo).
#   MONGO_CONTAINER - docker container to exec into when MONGODB_URI is unset
#                     (default: edlearn-mongodb, matching docker-compose.yml)
#   MONGO_DB        - default: edlearn

OUT_DIR="${1:-./backups/mongo}"
mkdir -p "$OUT_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$OUT_DIR/edlearn-mongo-${TIMESTAMP}.archive.gz"

MONGO_CONTAINER="${MONGO_CONTAINER:-edlearn-mongodb}"
MONGO_DB="${MONGO_DB:-edlearn}"

echo "==> Backing up MongoDB to ${ARCHIVE}"

if [ -n "${MONGODB_URI:-}" ]; then
  mongodump --uri="$MONGODB_URI" --archive="$ARCHIVE" --gzip
else
  docker exec "$MONGO_CONTAINER" mongodump --db="$MONGO_DB" --archive --gzip > "$ARCHIVE"
fi

echo "==> Backup written: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
echo "==> Verify with: mongorestore --archive=\"$ARCHIVE\" --gzip --dryRun"
