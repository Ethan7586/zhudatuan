import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import { LeaseStore } from '../../../../foundation/infrastructure/LeaseStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { DirectorySyncService } from '../../application/service/DirectorySyncService';

export class DirectorySyncJob implements JobProcessor {
  private readonly leases: LeaseStore;
  constructor(
    pool: DatabasePool,
    private readonly service: DirectorySyncService,
    private readonly leaseSeconds: number,
    private readonly attempts: number
  ) {
    this.leases = new LeaseStore(pool);
  }
  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'directorysync') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    const connection = text(payload.connection);
    const run = text(payload.run);
    const lease = await this.leases.acquire(`directory:${connection}`, job.id, this.leaseSeconds);
    if (!lease) throw new Error('DIRECTORY_SYNC_LEASE_BUSY');
    try {
      await this.service.execute(connection, run, job.id, signal, () => this.leases.assert(lease));
    } catch (cause) {
      if (job.attempts >= this.attempts) await this.service.fail(run, cause);
      throw cause;
    } finally {
      await this.leases.release(lease).catch((cause: unknown) => {
        if (!(cause instanceof Error) || cause.message !== 'LEASE_LOST') throw cause;
      });
    }
  }
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('JOB_PAYLOAD_INVALID');
  return value;
}
