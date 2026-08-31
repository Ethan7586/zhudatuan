import type { ClaimedJob, JobDeadletter } from '../../../../foundation/application/JobRunner';

interface Database {
  query(text: string, values?: readonly unknown[]): Promise<unknown>;
}

export class FinanceDeadletter implements JobDeadletter {
  async record(database: Database, job: ClaimedJob, error: string): Promise<void> {
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
      await database.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        select $1,'finance.withdrawal.uncertain',1,'withdrawal',withdrawal.id,withdrawal.scope_id,
          jsonb_build_object('withdrawal',withdrawal.id,'settlement',withdrawal.settlement_id,'error',$2,'deadletter',$3),$1,
          clock_timestamp(),clock_timestamp() from finance.withdrawal withdrawal where withdrawal.id=$4 on conflict(id) do nothing`,
        [`event:finance:withdrawal:uncertain:${withdrawal}`, error, `job:${job.id}`, withdrawal]
      );
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
