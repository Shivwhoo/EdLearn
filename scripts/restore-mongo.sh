#!/usr/bin/env bash
set -euo pipefail

# M2: MongoDB restore — DOCUMENTED MANUAL PROCEDURE.
#
# DESTRUCTIVE: uses --drop, which replaces existing collections in the
# target database. Reviewed for syntax only — NOT executed against any real
# database as part of M2. Test against a disposable local database first.
#
# Usage:
#   ./scripts/restore-mongo.sh <archive-file> --yes

ARCHIVE="${1:?Usage: restore-mongo.sh <archive-file> --yes}"
CONFIRM="${2:-}"

MONGO_CONTAINER="${MONGO_CONTAINER:-edlearn-mongodb}"
MONGO_DB="${MONGO_DB:-edlearn}"

if [ "$CONFIRM" != "--yes" ]; then
  echo "This will DROP AND REPLACE collections in database '$MONGO_DB'."
  echo "Re-run with --yes to proceed:"
  echo "  $0 \"$ARCHIVE\" --yes"
  exit 1
fi

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive file not found: $ARCHIVE" >&2
  exit 1
fi

echo "==> Restoring $ARCHIVE into $MONGO_DB"

if [ -n "${MONGODB_URI:-}" ]; then
  mongorestore --uri="$MONGODB_URI" --archive="$ARCHIVE" --gzip --drop
else
  docker exec -i "$MONGO_CONTAINER" mongorestore --db="$MONGO_DB" --archive --gzip --drop < "$ARCHIVE"
fi

echo "==> Restore complete."
echo "==> Verify with: mongosh \"\$MONGODB_URI\" --eval 'db.getCollectionNames()'"
