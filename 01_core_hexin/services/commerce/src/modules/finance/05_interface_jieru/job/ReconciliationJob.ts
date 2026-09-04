import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PostJournal } from '../../03_application_yingyong/command/PostJournal';
import { ReconcileStatement } from '../../03_application_yingyong/command/ReconcileStatement';

export class ReconciliationJobProcessor implements JobProcessor {
  private readonly posting: PostJournal;
  private readonly reconciliation: ReconcileStatement;

  constructor(pool: DatabasePool, objects: ObjectStore) {
    this.posting = new PostJournal(pool);
    this.reconciliation = new ReconcileStatement(pool, objects);
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'reconciliation') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.eventId) return this.posting.execute(payload);
    return this.reconciliation.execute(text(payload.reconciliation, 'RECONCILIATION_REQUIRED'));
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
