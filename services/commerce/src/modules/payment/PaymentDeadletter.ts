import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobDeadletter } from '../../foundation/application/JobRunner';

interface Database { query(text: string, values?: readonly unknown[]): Promise<unknown> }

export class PaymentDeadletter implements JobDeadletter {
  async record(database: Database, job: ClaimedJob, error: string): Promise<void> {
    const payload = record(job.payload);
    const intent = string(payload.intent);
    const refund = string(payload.refund);
    const aftersale = string(payload.aftersale);
    const recovery = `recovery:deadletter:${job.id}`;
    const evidence = { deadletter: `job:${job.id}`, job: job.id, kind: job.kind, payload, error };
    await database.query(`insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) select $1,coalesce(
        (select orders.scope_id from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id where intent.id=$6),
        (select orders.scope_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
          join payment.intent intent on intent.id=payment.intent_id join ordering.orderrecord orders on orders.id=intent.order_id where refund.id=$7),
        (select orders.scope_id from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id where aftersale.id=$8),$2),
        coalesce((select order_id from payment.intent where id=$6),
          (select intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
            join payment.intent intent on intent.id=payment.intent_id where refund.id=$7),
          (select order_id from ordering.aftersale where id=$8)),
        'deadletter',$3,'critical','open',$4,$5::jsonb,1,clock_timestamp()
      on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,
        error_code=excluded.error_code,evidence=excluded.evidence,state='open',resolved_at=null,resolution_request_id=null`,
    [recovery, job.scope_id, `job:${job.id}`, error, JSON.stringify(evidence), intent, refund, aftersale]);
    await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'payment.recovery.opened',1,'payment',$2,coalesce($3,'payment'),$4::jsonb,$1,clock_timestamp(),clock_timestamp())`,
    [`event:${randomUUID()}`, recovery, job.scope_id, JSON.stringify(evidence)]);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

function string(value: unknown): string | null { return typeof value === 'string' && value ? value : null; }
