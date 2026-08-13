# Database Backup & Restore

Status: **DOCUMENTED MANUAL PROCEDURE**. Nothing in this repository runs
these backups automatically — no cron, no Kubernetes CronJob, no CI step.
The scripts in `scripts/` exist so a human (or an external scheduler you
wire up) can run a consistent, correct backup/restore instead of improvising
one under pressure. If you want automation, see "Making this automatic"
below — that part is **not implemented**, only outlined.

## PostgreSQL

Data: `Roadmap`, `Day`, `Topic`, `User`, `Progress`, `Badge`, etc. (Prisma
schema in `backend/prisma/schema.prisma`). Runs as the `postgres` service in
`docker-compose.yml`, storing data in the `postgres_data` named volume.

### Backup

```bash
./scripts/backup-postgres.sh                # writes to ./backups/postgres/
./scripts/backup-postgres.sh /path/to/dir    # custom output dir
```

Against a real (non-docker-compose) database, set `DATABASE_URL` first:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/edlearn" ./scripts/backup-postgres.sh
```

### Restore

```bash
./scripts/restore-postgres.sh ./backups/postgres/edlearn-postgres-<timestamp>.dump --yes
```

This is destructive (`pg_restore --clean --if-exists`) — it drops and
recreates objects present in the dump. The `--yes` flag is required on
purpose so this can never be run by accident via a copy-pasted command
missing a flag.

### Verify

- Immediately after backup: `pg_restore --list <dump-file>` — confirms the
  dump file is well-formed and lists what it contains, without touching any
  database.
- After a restore: run `psql "$DATABASE_URL" -c '\dt'` to confirm tables
  exist, then hit `GET /api/health` on the backend and spot-check a couple
  of known records via the app itself.

## MongoDB

Data: `MarketDemand` (market-trend documents; see
`backend/src/lib/models/MarketDemand.ts`). Runs as the `mongodb` service in
`docker-compose.yml`, storing data in the `mongodb_data` named volume.

### Backup

```bash
./scripts/backup-mongo.sh                # writes to ./backups/mongo/
```

Against a real database: `MONGODB_URI="mongodb+srv://..." ./scripts/backup-mongo.sh`

### Restore

```bash
./scripts/restore-mongo.sh ./backups/mongo/edlearn-mongo-<timestamp>.archive.gz --yes
```

Destructive (`mongorestore --drop`) — replaces existing collections. `--yes`
required for the same reason as the Postgres script.

### Verify

- After backup: `mongorestore --archive=<file> --gzip --dryRun` validates
  the archive without touching any database.
- After restore: `mongosh "$MONGODB_URI" --eval 'db.getCollectionNames()'`,
  then check `GET /api/market-demand` returns data via the app.

## What is NOT done here

- No automated schedule. Nothing runs these on a timer.
- No off-site/cloud upload of backup files — `scripts/*.sh` write to local
  disk (`./backups/...`) only. For real production use, pipe or copy the
  output file to S3/R2 (the same object storage already introduced for TTS
  media in `backend/src/lib/storage/` is a reasonable place to send these).
- No restore has been executed against a real database as part of this M2
  work — both restore scripts are reviewed for correct syntax/flags only.
  Test them against a disposable local database before you trust them.

## Making this automatic (outlined, not implemented)

Two common options if/when this becomes a priority:

1. **Kubernetes CronJob** — a small `k8s/backup-cronjob.yaml` running these
   scripts (or an equivalent `pg_dump`/`mongodump` container) on a schedule,
   uploading the output to S3/R2. Needs the object-storage credentials from
   `k8s/secret.example.yaml` mounted into the job.
2. **Managed database backups** — if PostgreSQL/MongoDB move to a managed
   service (RDS, Atlas, etc.) in production, prefer the provider's built-in
   automated backups/point-in-time-recovery over a custom CronJob; keep
   these scripts as the local-dev / disaster-recovery-drill path.

Either approach is a deployment-infrastructure decision that depends on
where this ends up hosted — intentionally left for that point rather than
guessed at here.
