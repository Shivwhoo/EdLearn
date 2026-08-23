/**
 * Wall-clock cron jobs — schedules anchored to real calendar time (e.g.
 * "every Sunday at 08:00 UTC"), as opposed to the BullMQ/setInterval jobs in
 * services/contentCrons.ts, which only express "every N ms since the
 * process booted" and drift/re-fire across restarts.
 *
 * Uses node-cron, which runs entirely in-process — no Redis dependency, no
 * separate worker process. Fine for a single backend instance; if this ever
 * runs behind multiple replicas, guard against every replica firing the
 * same job (e.g. a DB/Redis lock) before scaling out.
 */
import cron from 'node-cron';
import { runEmailDigest } from '../services/emailDigestCron';

let initialized = false;

/**
 * Registers all node-cron jobs. Safe to call more than once — only the
 * first call actually schedules anything.
 */
export function initCronJobs(): void {
  if (initialized) {
    console.warn('[CronJobs] initCronJobs() called again — ignoring, jobs are already scheduled.');
    return;
  }
  initialized = true;

  // Cron expression fields: minute hour day-of-month month day-of-week
  // '0 8 * * 0' => 08:00 on Sunday (day-of-week 0), every week.
  cron.schedule(
    '0 8 * * 0',
    () => {
      console.log('[CronJobs] Running weekly email digest (Sunday 08:00 UTC)...');
      runEmailDigest().catch((err) => {
        console.error('[CronJobs] Weekly email digest failed:', err?.message || err);
      });
    },
    { timezone: 'UTC' }
  );

  console.log('[CronJobs] Scheduled: weekly email digest — every Sunday at 08:00 UTC.');
}
