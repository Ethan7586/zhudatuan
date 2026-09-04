import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { jobDefinition } from '../../../../foundation/application/JobCatalog';
import { JobLease } from './JobLease';
import { QueueAdmission } from './QueueAdmission';

interface Schedule {
  readonly kind: 'orderexpiry' | 'voucheraction' | 'benefitexpiry' | 'cleanup' | 'federationcleanup' | 'providerhealth' | 'directoryreconcile' | 'invitationcleanup';
  readonly owner: string;
  readonly seconds: number;
  readonly priority: number;
}

const schedules: readonly Schedule[] = Object.freeze([
  { kind: 'orderexpiry', owner: 'order', seconds: 60, priority: 80 },
  { kind: 'voucheraction', owner: 'voucher', seconds: 300, priority: 90 },
  { kind: 'benefitexpiry', owner: 'benefit', seconds: 300, priority: 90 },
  { kind: 'cleanup', owner: 'runtime', seconds: 3600, priority: 100 },
  { kind: 'federationcleanup', owner: 'identity', seconds: 3600, priority: 90 },
  { kind: 'providerhealth', owner: 'identity', seconds: 300, priority: 80 },
  { kind: 'directoryreconcile', owner: 'organization', seconds: 86_400, priority: 100 },
  { kind: 'invitationcleanup', owner: 'identity', seconds: 300, priority: 90 },
]);

export class RuntimeScheduler {
  private readonly leases: JobLease;
  constructor(
    private readonly pool: DatabasePool,
    private readonly owner: string,
    private readonly config: Readonly<{ leaseSeconds: number; pollMilliseconds: number }>
  ) {
    if (!Number.isSafeInteger(config.leaseSeconds) || config.leaseSeconds < 5 || config.leaseSeconds > 900 ||
      !Number.isSafeInteger(config.pollMilliseconds) || config.pollMilliseconds < 1_000 || config.pollMilliseconds > 300_000) {
      throw new Error('RUNTIME_SCHEDULER_CONFIG_INVALID');
    }
    this.leases = new JobLease(pool);
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const lease = await this.leases.acquire({ resource: 'runtime:scheduler', scope: 'organization-platform-root', owner: this.owner, seconds: this.config.leaseSeconds });
      if (lease) {
        try { await this.ensure(new Date()); await this.leases.assert(lease); }
        finally { await this.leases.release(lease); }
      }
      await wait(this.config.pollMilliseconds, signal);
    }
  }

  async ensure(now: Date): Promise<void> {
    const seconds = Math.floor(now.getTime() / 1000);
    for (const schedule of schedules) {
      const bucket = Math.floor(seconds / schedule.seconds) * schedule.seconds;
      const definition = jobDefinition(schedule.kind);
      if (!(await new QueueAdmission(this.pool).available({ id: `job:schedule:${schedule.kind}:${bucket}`, queue: definition.queue, priority: schedule.priority }))) continue;
      await this.pool.query(
        `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
         idempotency_key,authorization_snapshot,retention_until,version,created_by,updated_by,created_at,updated_at)
        values($1,'organization-platform-root','organization-platform-root',$2,$3,$6,'{}','queued',$4,to_timestamp($5),'{}',0,$1,
         jsonb_build_object('kind','system','actor','runtime:scheduler','scope','organization-platform-root','operation','runtime.scheduler',
           'source','scheduler','capturedAt',clock_timestamp()),clock_timestamp()+interval '90 days',1,'runtime:scheduler','runtime:scheduler',
         clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
        [`job:schedule:${schedule.kind}:${bucket}`, schedule.kind, schedule.owner, schedule.priority, bucket, definition.queue]
      );
    }
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
