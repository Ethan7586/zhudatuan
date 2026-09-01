import type { ClaimedJob, JobDeadletter } from '../../../../foundation/application/JobRunner';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export class FinanceDeadletter implements JobDeadletter {
  private readonly transactions = new PgTransactionAccess();
  async record(context: WriteTransactionContext, job: ClaimedJob, error: string): Promise<void> {
    const database = this.transactions.database(context);
    const payload = object(job.payload);
    const withdrawal = string(payload.withdrawal);
    const reconciliation = string(payload.reconciliation);
    const invoice = string(payload.request);
    if (withdrawal !== null) {
      await database.query(
        `update finance.withdrawal set state='uncertain',evidence=evidence||$2::jsonb,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state='processing'`,
        [withdrawal, JSON.stringify({ deadletter: `job:${job.id}`, error })]
      );
      const sql = database as unknown as RuntimeSql;
      const target = await sql.query<{ scope_id: string; settlement_id: string }>('select scope_id,settlement_id from finance.withdrawal where id=$1', [withdrawal]);
      if (target.rows[0]) {
        const event = `event:finance:withdrawal:uncertain:${withdrawal}`;
        await new PgRuntimeWriter(sql).append({
          id: event,
          type: 'finance.withdrawal.uncertain',
          aggregateType: 'withdrawal',
          aggregate: withdrawal,
          scope: target.rows[0].scope_id,
          payload: { withdrawal, settlement: target.rows[0].settlement_id, error, deadletter: `job:${job.id}` },
          trace: event,
        });
      }
    }
    if (reconciliation !== null)
      await database.query(
        `update finance.reconciliation set state='difference',evidence=evidence||$2::jsonb,
      updated_at=clock_timestamp(),version=version+1 where id=$1 and state in('matching','approved')`,
        [reconciliation, JSON.stringify({ deadletter: `job:${job.id}`, error })]
      );
    if (invoice !== null)
      await database.query(
        `update invoice.request set state='failed',evidence=evidence||$2::jsonb,version=version+1
      where id=$1 and state='issuing'`,
        [invoice, JSON.stringify({ deadletter: `job:${job.id}`, error })]
      );
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}
function string(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
