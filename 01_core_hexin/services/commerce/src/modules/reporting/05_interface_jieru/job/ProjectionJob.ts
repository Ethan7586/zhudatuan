import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import { ProjectEvent } from '../../03_application_yingyong/command/ProjectEvent';
import { PgReportingRepository } from '../../04_adapters_shixian/persistence/PgReportingRepository';

export class ProjectionJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly cache: Cache) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'projection') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const eventid = text(object(job.payload).eventId, 'EVENT_ID_REQUIRED');
    const client = await this.pool.connect();
    let projected: readonly Readonly<{ scope: string; version: number }>[] = [];
    try {
      await client.query('begin');
      const repository = new PgReportingRepository(client);
      const event = await repository.claimEvent(eventid);
      if (event) projected = await new ProjectEvent(repository).execute(event);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
    const keys = projected.filter(({ version }) => version > 1).flatMap(({ scope, version }) => cacheKeys(scope, version-1));
    if (keys.length > 0) await this.cache.remove(...keys);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function cacheKeys(scope: string, projectionversion: number): readonly string[] {
  const metrics = ['dashboard','sales','product','mall','category','channel','powderclass','voucher'] as const;
  const periods = ['realtime','yesterday','7days','30days'] as const;
  return metrics.flatMap((metric) => periods.map((period) => VersionedKey.create('reporting', { scope, metric, period, projectionversion })));
}
