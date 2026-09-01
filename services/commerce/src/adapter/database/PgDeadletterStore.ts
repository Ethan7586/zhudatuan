import type { DeadletterRecord, DeadletterStore } from '../../foundation/infrastructure/DeadletterStore';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';

export class PgDeadletterStore implements DeadletterStore {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async record(context: WriteTransactionContext, record: DeadletterRecord): Promise<void> {
    if (record.attempts < 1) throw new Error('DEADLETTER_ATTEMPTS_INVALID');
    await this.transactions.database(context).query(
      `insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,clock_timestamp()) on conflict(kind,source_id) do update
      set payload=excluded.payload,error_code=excluded.error_code,attempts=excluded.attempts,failed_at=excluded.failed_at,reviewed_at=null`,
      [record.id, record.kind, record.source, record.owner, JSON.stringify(record.payload), record.error, record.attempts]
    );
  }
}
