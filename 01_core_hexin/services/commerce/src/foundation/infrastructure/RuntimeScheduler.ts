import type { DatabasePool } from '../persistence/Pool';
import { LeaseStore } from './LeaseStore';

interface Schedule {
  readonly kind: 'orderexpiry' | 'voucherexpiry' | 'benefitexpiry' | 'cleanup';
  readonly owner: string;
  readonly seconds: number;
  readonly priority: number;
}

const schedules: readonly Schedule[] = Object.freeze([
  { kind: 'orderexpiry', owner: 'order', seconds: 60, priority: 80 },
  { kind: 'voucherexpiry', owner: 'voucher', seconds: 300, priority: 90 },
  { kind: 'benefitexpiry', owner: 'benefit', seconds: 300, priority: 90 },
  { kind: 'cleanup', owner: 'runtime', seconds: 3600, priority: 100 },
]);

export class RuntimeScheduler {
  private readonly leases: LeaseStore;
  constructor(private readonly pool: DatabasePool, private readonly owner: string) {
    this.leases = new LeaseStore(pool);
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const lease = await this.leases.acquire('runtime:scheduler', this.owner, 45);
      if (lease) {
        try { await this.ensure(new Date()); } finally { await this.leases.release(lease); }
      }
      await wait(30_000, signal);
    }
  }

  async ensure(now: Date): Promise<void> {
    const seconds = Math.floor(now.getTime() / 1000);
    for (const schedule of schedules) {
      const bucket = Math.floor(seconds / schedule.seconds) * schedule.seconds;
      await this.pool.query(`insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
        values($1,$2,$3,'{}'::jsonb,'queued',$4,to_timestamp($5),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`schedule:${schedule.kind}:${bucket}`, schedule.kind, schedule.owner, schedule.priority, bucket]);
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
