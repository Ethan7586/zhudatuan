import type { Transaction } from '../persistence/UnitOfWork';

export interface DeadletterRecord {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly owner: string;
  readonly payload: unknown;
  readonly error: string;
  readonly attempts: number;
}

export class DeadletterStore {
  async record(transaction: Transaction, record: DeadletterRecord): Promise<void> {
    if (record.attempts < 1) throw new Error('DEADLETTER_ATTEMPTS_INVALID');
    await transaction.query(
      `insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,clock_timestamp()) on conflict(kind,source_id) do update
      set payload=excluded.payload,error_code=excluded.error_code,attempts=excluded.attempts,failed_at=excluded.failed_at,reviewed_at=null`,
      [record.id, record.kind, record.source, record.owner, JSON.stringify(record.payload), record.error, record.attempts]
    );
  }
}
