import { createHash } from 'node:crypto';
import type { ClaimedJob, JobDeadletter } from '../../foundation/application/JobRunner';

type Database = Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>;

export class BenefitDeadletter implements JobDeadletter {
  async record(database: Database, job: ClaimedJob, error: string): Promise<void> {
    if (job.kind === 'benefitexpiry') return this.expiry(database, job, error);
    const payload = object(job.payload);
    const batch = text(payload.batch, 'BENEFIT_BATCH_REQUIRED');
    if (payload.kind === 'benefitrevoke') return this.revoke(database, batch, error);
    if (payload.kind !== 'benefitgrant') throw new Error('BENEFIT_JOB_SUBTYPE_INVALID');
    await this.grant(database, batch, error);
  }

  private async grant(database: Database, batch: string, error: string): Promise<void> {
    await database.query(`with failed as(update benefit.grantitem set state='failed',error_code=$2 where batch_id=$1 and state='queued'
        returning amount_minor), released as(select coalesce(sum(amount_minor),0) amount from failed), changed as(
        update benefit.grantbatch set state='failed',updated_at=clock_timestamp() where id=$1 and state in('approved','running') returning budget_id)
      update benefit.budget budget set reserved_minor=reserved_minor-released.amount,version=version+1 from released,changed
      where budget.id=changed.budget_id and budget.reserved_minor>=released.amount`, [batch, error]);
    await failureEvent(database, 'benefit.grant.failed', batch, error);
  }

  private async revoke(database: Database, batch: string, error: string): Promise<void> {
    await database.query(`update benefit.grantitem set state='failed',error_code=$2 where batch_id=$1 and state='revoking'`, [batch, error]);
    await database.query(`update benefit.grantbatch set state='failed',updated_at=clock_timestamp() where id=$1 and state='revoking'`, [batch]);
    await failureEvent(database, 'benefit.revoke.failed', batch, error);
  }

  private async expiry(database: Database, job: ClaimedJob, error: string): Promise<void> {
    await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,'benefit.expiry.failed',1,'job',$2,'organization-platform-root',jsonb_build_object('job',$2,'error',$3),$1,
      clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`, [`event:${digest(`benefit:expiry:${job.id}`)}`, job.id, error]);
  }
}

async function failureEvent(database: Database, type: string, batch: string, error: string) {
  await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
    occurred_at,available_at) select $1,$2,1,'grantbatch',batch.id,plan.scope_id,jsonb_build_object('batch',batch.id,'error',$3),$1,
    clock_timestamp(),clock_timestamp() from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id where batch.id=$4
    on conflict(id) do nothing`, [`event:${digest(`${type}:${batch}`)}`, type, error, batch]);
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function object(value: unknown): Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
