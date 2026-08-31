import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { ProviderResolver } from '../../application/service/ProviderResolver';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';

export class ProviderHealthJob implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly resolver: ProviderResolver,
    private readonly concurrency: number
  ) {}
  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'providerhealth') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload);
    const requested = typeof payload.provider === 'string' ? payload.provider : null;
    const result = await this.pool.query<{ id: string }>(`select id from identity.provider where status='enabled' and ($1::uuid is null or id=$1) order by id limit 64`, [requested]);
    await mapParallel(result.rows, this.concurrency, async ({ id }) => {
      const started = performance.now();
      let status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
      let error: string | null = null;
      try {
        const value = await this.resolver.require(this.pool, id);
        status = (await value.strategy.health(value.instance)).status;
      } catch (cause) {
        error = code(cause);
      }
      await this.pool.query(
        `insert into identity.providerhealth(provider_id,status,latency_ms,error_code,checked_at,version) values($1,$2,$3,$4,clock_timestamp(),1)
        on conflict(provider_id) do update set status=excluded.status,latency_ms=excluded.latency_ms,error_code=excluded.error_code,
        checked_at=excluded.checked_at,version=identity.providerhealth.version+1`,
        [id, status, Math.ceil(performance.now() - started), error]
      );
    });
  }
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function code(value: unknown): string {
  return safeErrorCode(value, 'IDENTITY_PROVIDER_UNAVAILABLE');
}
