import { createHash } from 'node:crypto';
import type { DeadletterRecord, DeadletterStore } from '../../foundation/application/DeadletterStore';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';

export class PgDeadletterStore implements DeadletterStore {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async record(context: WriteTransactionContext, record: DeadletterRecord): Promise<void> {
    if (record.attempts < 1) throw new Error('DEADLETTER_ATTEMPTS_INVALID');
    await this.transactions.database(context).query(
      `insert into runtime.deadletters(id,tenant_id,scope_id,source_kind,source_id,owner,payload,error_code,attempts,state,
       version,failed_at,retention_until) values($1,$8,$8,$2,$3,$4,$5::jsonb,$6,$7,'open',1,clock_timestamp(),
       clock_timestamp()+interval '90 days') on conflict(source_kind,source_id) do update set
       payload=excluded.payload,error_code=excluded.error_code,attempts=excluded.attempts,state='open',
       version=runtime.deadletters.version+1,failed_at=excluded.failed_at,reviewed_by=null,reviewed_at=null`,
      [`deadletter:${createHash('sha256').update(`${record.kind}\u0000${record.source}`).digest('hex')}`, record.kind, record.source, record.owner, JSON.stringify(record.payload), record.error, record.attempts, context.scope]
    );
  }
}
