import type { Telemetry } from '@shop/telemetry';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';

export const IDENTITY_NOTIFICATION_BACKLOG_SECONDS = 30;
const MONITOR_ID = 'identitynotification:backlog-monitor';
const ALERT_ID = 'alert:identitynotification:backlog';

export interface IdentityNotificationBacklogSnapshot {
  readonly queued: number;
  readonly running: number;
  readonly failed: number;
  readonly stale_running: number;
  readonly oldest_seconds: number;
  readonly delivery_alerts: number;
}

export class IdentityNotificationBacklogMonitor {
  private alarming = false;

  constructor(private readonly pool: DatabasePool, private readonly telemetry: Telemetry,
    private readonly thresholdSeconds = IDENTITY_NOTIFICATION_BACKLOG_SECONDS, private readonly pollMilliseconds = 15_000) {}

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      await this.inspect();
      await delay(this.pollMilliseconds, signal);
    }
  }

  async inspect(): Promise<IdentityNotificationBacklogSnapshot> {
    const result = await this.pool.query<IdentityNotificationBacklogSnapshot>(`select
      count(*) filter(where state='queued' and available_at<=clock_timestamp())::integer queued,
      count(*) filter(where state='running')::integer running,
      count(*) filter(where state='failed')::integer failed,
      count(*) filter(where state='running' and lease_deadline<clock_timestamp())::integer stale_running,
      coalesce(extract(epoch from clock_timestamp()-min(created_at)
        filter(where state='queued' and available_at<=clock_timestamp())),0)::integer oldest_seconds,
      (select count(*)::integer from runtime.deadletter where owner='identity' and kind='alert'
        and source_id like 'identitynotification:delivery:%' and reviewed_at is null) delivery_alerts
      from runtime.job where kind='identitynotification' and owner='identity'`);
    const snapshot = result.rows[0] ?? { queued: 0, running: 0, failed: 0, stale_running: 0, oldest_seconds: 0, delivery_alerts: 0 };
    const backlogged = snapshot.failed > 0 || snapshot.stale_running > 0 || snapshot.delivery_alerts > 0
      || (snapshot.queued > 0 && snapshot.oldest_seconds >= this.thresholdSeconds);
    const context = { requestId: MONITOR_ID, traceId: MONITOR_ID, module: 'identity', job: 'identitynotification',
      result: backlogged ? 'backlog' : 'healthy' };
    this.telemetry.metrics.count('commerce.identity.notification.queue.depth', snapshot.queued, context);
    this.telemetry.metrics.count('commerce.identity.notification.queue.failed', snapshot.failed + snapshot.stale_running, context);
    this.telemetry.metrics.count('commerce.identity.notification.delivery.unresolved', snapshot.delivery_alerts, context);
    this.telemetry.metrics.duration('commerce.identity.notification.queue.oldest', snapshot.oldest_seconds * 1_000, context);
    if (backlogged && !this.alarming) {
      await this.persistAlert(snapshot);
      this.alarming = true;
      await this.telemetry.logger.write({ level: 'error', event: 'identity.notification.queue.backlog', ...context,
        errorCode: 'IDENTITY_NOTIFICATION_BACKLOG', data: { ...snapshot, thresholdSeconds: this.thresholdSeconds } });
    } else if (!backlogged && this.alarming) {
      this.alarming = false;
      await this.telemetry.logger.write({ level: 'info', event: 'identity.notification.queue.recovered', ...context,
        data: { ...snapshot, thresholdSeconds: this.thresholdSeconds } });
    }
    return snapshot;
  }

  private async persistAlert(snapshot: IdentityNotificationBacklogSnapshot): Promise<void> {
    await this.pool.query(`insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at)
      values($1,'alert','identitynotification','identity',$2::jsonb,'IDENTITY_NOTIFICATION_BACKLOG',1,clock_timestamp())
      on conflict(kind,source_id) do update set payload=excluded.payload,error_code=excluded.error_code,
      attempts=runtime.deadletter.attempts+1,failed_at=excluded.failed_at,reviewed_at=null`,
    [ALERT_ID, JSON.stringify({ ...snapshot, thresholdSeconds: this.thresholdSeconds })]);
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
