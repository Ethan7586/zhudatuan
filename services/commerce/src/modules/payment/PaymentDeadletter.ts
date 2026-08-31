import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobDeadletter } from '../../foundation/application/JobRunner';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { PaymentOrderPort } from '../order/public';

interface Database {
  query(text: string, values?: readonly unknown[]): Promise<unknown>;
}

export class PaymentDeadletter implements JobDeadletter {
  constructor(private readonly orders: Pick<PaymentOrderPort, 'payment' | 'aftersale'>) {}

  async record(database: Database, job: ClaimedJob, error: string): Promise<void> {
    const payload = record(job.payload);
    const intent = string(payload.intent);
    const refund = string(payload.refund);
    const aftersale = string(payload.aftersale);
    const recovery = `recovery:deadletter:${job.id}`;
    const evidence = { deadletter: `job:${job.id}`, job: job.id, kind: job.kind, payload, error };
    const operation = database as OperationDatabase;
    const intentOrder = intent ? (await operation.query<{ order_id: string }>('select order_id from payment.intent where id=$1', [intent])).rows[0]?.order_id : undefined;
    const refundOrder = refund
      ? (
          await operation.query<{ order_id: string }>(
            `select intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
            join payment.intent intent on intent.id=payment.intent_id where refund.id=$1`,
            [refund]
          )
        ).rows[0]?.order_id
      : undefined;
    const sale = aftersale ? await this.orders.aftersale(operation, aftersale) : null;
    const orderid = intentOrder ?? refundOrder ?? sale?.order ?? null;
    const order = orderid ? await this.orders.payment(operation, orderid) : null;
    await database.query(
      `insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) values($1,$2,$3,'deadletter',$4,'critical','open',$5,$6::jsonb,1,clock_timestamp())
      on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,
        error_code=excluded.error_code,evidence=excluded.evidence,state='open',resolved_at=null,resolution_request_id=null`,
      [recovery, order?.scope ?? sale?.scope ?? job.scope_id, orderid, `job:${job.id}`, error, JSON.stringify(evidence)]
    );
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'payment.recovery.opened',1,'payment',$2,coalesce($3,'payment'),$4::jsonb,$1,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, recovery, job.scope_id, JSON.stringify({ recovery, reason: error, evidence })]
    );
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
