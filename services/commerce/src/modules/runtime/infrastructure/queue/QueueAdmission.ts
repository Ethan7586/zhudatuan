import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { DomainError } from '../../../../platform/error/DomainError';

interface QueueSql {
  query(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly Record<string, unknown>[] }>>;
}

export interface QueueCandidate {
  readonly id: string;
  readonly queue: string;
  readonly priority: number;
}

const policy = RUNTIME_LIMITS.queue;
const deferred = new Set<string>(policy.deferred);

export class QueueAdmission {
  constructor(private readonly database: QueueSql) {}

  async available(candidate: QueueCandidate): Promise<boolean> {
    if (!candidate.id.startsWith('job:') || !/^[a-z]+$/.test(candidate.queue) || !Number.isSafeInteger(candidate.priority) || candidate.priority < 0 || candidate.priority > 1000) throw new Error('JOB_ADMISSION_INPUT_INVALID');
    const low = deferred.has(candidate.queue) && candidate.priority >= policy.lowPriority;
    const threshold = low ? policy.maximumDepth - policy.reservedDepth : policy.maximumDepth;
    const result = await this.database.query(
      `select exists(select 1 from runtime.jobs where id=$1 and state in('queued','running')) existing,
       (select count(*)::integer from(select id from runtime.jobs where state in('queued','running') limit $2) active) depth`,
      [candidate.id, threshold]
    );
    const state = result.rows[0] as Readonly<{ existing?: unknown; depth?: unknown }> | undefined;
    const depth = state?.depth;
    if (!Number.isSafeInteger(depth) || Number(depth) < 0) throw new Error('JOB_ADMISSION_STATE_INVALID');
    return state?.existing === true || Number(depth) < threshold;
  }

  async assert(candidate: QueueCandidate): Promise<void> {
    if (!(await this.available(candidate))) throw new DomainError('RATE_LIMITED');
  }
}
