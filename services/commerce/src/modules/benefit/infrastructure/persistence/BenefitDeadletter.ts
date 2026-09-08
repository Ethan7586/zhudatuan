import { createHash } from 'node:crypto';
import type { ClaimedJob, JobDeadletter } from '../../../runtime/public/JobProcess';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

type Database = SqlExecutor;

export class BenefitDeadletter implements JobDeadletter {
  private readonly transactions = new PgTransactionAccess();
  async record(context: WriteTransactionContext, job: ClaimedJob, error: string): Promise<void> {
    const database = this.transactions.database(context);
    if (job.kind === 'benefitexpiry') return this.expiry(database, job, error);
    const payload = object(job.payload);
    const batch = text(payload.batch, 'BENEFIT_BATCH_REQUIRED');
    if (payload.kind === 'benefitrevoke') return this.revoke(database, batch, error);
    if (payload.kind !== 'benefitgrant') throw new Error('BENEFIT_JOB_SUBTYPE_INVALID');
    await this.grant(database, batch, error);
  }

  private async grant(database: Database, batch: string, error: string): Promise<void> {
    await database.query(
      `with failed as(update benefit.grantitem set state='failed',error_code=$2 where batch_id=$1 and state='queued'
        returning amount_minor), released as(select coalesce(sum(amount_minor),0) amount from failed), changed as(
        update benefit.grantbatch set state='failed',updated_at=clock_timestamp() where id=$1 and state in('approved','running') returning budget_id)
      update benefit.budget budget set reserved_minor=reserved_minor-released.amount,version=version+1 from released,changed
      where budget.id=changed.budget_id and budget.reserved_minor>=released.amount`,
      [batch, error]
    );
    await failureEvent(database, 'benefit.grant.failed', batch, error);
  }

  private async revoke(database: Database, batch: string, error: string): Promise<void> {
    await database.query(`update benefit.grantitem set state='failed',error_code=$2 where batch_id=$1 and state='revoking'`, [batch, error]);
    await database.query(`update benefit.grantbatch set state='failed',updated_at=clock_timestamp() where id=$1 and state='revoking'`, [batch]);
    await failureEvent(database, 'benefit.revoke.failed', batch, error);
  }

  private async expiry(database: Database, job: ClaimedJob, error: string): Promise<void> {
    const event = `event:${digest(`benefit:expiry:${job.id}`)}`;
    await new PgRuntimeWriter(database as unknown as RuntimeSql).append({
      id: event,
      type: 'benefit.expiry.failed',
      aggregateType: 'job',
      aggregate: job.id,
      scope: 'organization-platform-root',
      payload: { job: job.id, error },
      trace: event,
    });
  }
}

async function failureEvent(database: Database, type: string, batch: string, error: string) {
  const sql = database as unknown as RuntimeSql;
  const target = await sql.query<{ scope_id: string }>('select plan.scope_id from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id where batch.id=$1', [batch]);
  if (!target.rows[0]) return;
  const event = `event:${digest(`${type}:${batch}`)}`;
  await new PgRuntimeWriter(sql).append({ id: event, type, aggregateType: 'grantbatch', aggregate: batch, scope: target.rows[0].scope_id, payload: { batch, error }, trace: event });
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
