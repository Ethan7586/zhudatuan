import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { ClaimedJob, JobDeadletter } from '../../../runtime/public/JobProcess';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderPaymentPort } from '../../../order/public';

export class PaymentDeadletter implements JobDeadletter {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly orders: Pick<OrderPaymentPort, 'payment' | 'aftersale'>) {}

  async record(context: WriteTransactionContext, job: ClaimedJob, error: string): Promise<void> {
    const database = this.transactions.database(context);
    const payload = record(job.payload);
    const intent = string(payload.intent);
    const refund = string(payload.refund);
    const aftersale = string(payload.aftersale);
    const recovery = `recovery:deadletter:${job.id}`;
    const evidence = { deadletter: `job:${job.id}`, job: job.id, kind: job.kind, payload, error };
    const intentOrder = intent ? (await database.query<{ order_id: string }>('select order_id from payment.intent where id=$1', [intent])).rows[0]?.order_id : undefined;
    const refundOrder = refund
      ? (
          await database.query<{ order_id: string }>(
            `select intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
            join payment.intent intent on intent.id=payment.intent_id where refund.id=$1`,
            [refund]
          )
        ).rows[0]?.order_id
      : undefined;
    const sale = aftersale ? await this.orders.aftersale(context, aftersale) : null;
    const orderid = intentOrder ?? refundOrder ?? sale?.order ?? null;
    const order = orderid ? await this.orders.payment(context, orderid) : null;
    await database.query(
      `insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) values($1,$2,$3,'deadletter',$4,'critical','open',$5,$6::jsonb,1,clock_timestamp())
      on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,
        error_code=excluded.error_code,evidence=excluded.evidence,state='open',resolved_at=null,resolution_request_id=null,
        version=payment.recoverycase.version+1`,
      [recovery, order?.scope ?? sale?.scope ?? job.scope, orderid, `job:${job.id}`, error, JSON.stringify(evidence)]
    );
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'payment.recovery.opened',
      aggregateType: 'payment',
      aggregate: recovery,
      scope: job.scope ?? 'payment',
      payload: { recovery, reason: error, evidence },
      trace: `deadletter:${job.id}`,
    });
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
