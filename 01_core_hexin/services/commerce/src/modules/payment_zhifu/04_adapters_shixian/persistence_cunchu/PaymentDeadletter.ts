import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobDeadletter } from '../../../../foundation/application/JobRunner';

interface Database { query(text: string, values?: readonly unknown[]): Promise<unknown> }

export class PaymentDeadletter implements JobDeadletter {
  async record(database: Database, job: ClaimedJob, error: string): Promise<void> {
    const payload = record(job.payload);
    const intent = string(payload.intent);
    const refund = string(payload.refund);
    const recovery = `recovery:deadletter:${job.id}`;
    const evidence = { deadletter: `job:${job.id}`, job: job.id, kind: job.kind, payload, error };
    const inserted = await database.query(`with target as(select coalesce(
        (select mall_id from payment.intent where id=$6 and ($2::text is null or mall_id=$2)),
        (select mall_id from payment.refund where id=$7 and ($2::text is null or mall_id=$2)),$2) mall_id,
        coalesce((select order_id from payment.intent where id=$6 and ($2::text is null or mall_id=$2)),
          (select intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
            and payment.mall_id=refund.mall_id join payment.intent intent on intent.id=payment.intent_id
            and intent.mall_id=payment.mall_id where refund.id=$7 and ($2::text is null or refund.mall_id=$2))) order_id)
      insert into payment.recoverycase(id,scope_id,mall_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) select $1,target.mall_id,target.mall_id,target.order_id,
        'deadletter',$3,'critical','open',$4,$5::jsonb,1,clock_timestamp() from target where target.mall_id is not null
      on conflict(mall_id,resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,
        error_code=excluded.error_code,evidence=excluded.evidence,state='open',resolved_at=null,resolution_request_id=null returning mall_id`,
    [recovery, job.scope_id, `job:${job.id}`, error, JSON.stringify(evidence), intent, refund]) as Readonly<{
      rows: readonly Readonly<{ mall_id: string }>[];
    }>;
    const mall = inserted.rows[0]?.mall_id;
    if (!mall) throw new Error('PAYMENT_RECOVERY_MALL_REQUIRED');
    await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'payment.recovery.opened',1,'payment',$2,coalesce($3,'payment'),$4::jsonb,$1,clock_timestamp(),clock_timestamp())`,
    [`event:${randomUUID()}`, recovery, mall, JSON.stringify(evidence)]);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

function string(value: unknown): string | null { return typeof value === 'string' && value ? value : null; }
