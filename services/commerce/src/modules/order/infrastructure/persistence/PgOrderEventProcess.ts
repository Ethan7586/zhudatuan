import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { OrderEventProcess, OrderProcessEvent } from '../../application/port/OrderEventProcess';

interface OrderRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly currency: string;
  readonly total_minor: number;
  readonly payment_state: string;
  readonly fulfillment_state: string;
  readonly lifecycle_state: string;
  readonly verification_state: string;
}

export class PgOrderEventProcess implements OrderEventProcess {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly manager: TransactionManager) {}

  process(input: OrderProcessEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.manager.write({ tenant: input.scopeId, membership: '', scope: input.scopeId, actor: 'system:order', trace: input.eventId,
      operation: 'orderevent', workload: 'jobs', signal, deadline }, async (context) => {
      const database = this.transactions.database(context);
      const runtime = new PgRuntimeWriter(database);
      const inbox = await runtime.claim('job:orderevent', input.eventId);
      if (!inbox) throw new Error('ORDER_EVENT_CONTEXT_MISSING');
      if (inbox.type !== input.eventType || inbox.version !== 1 || inbox.scope !== input.scopeId || inbox.aggregate !== input.sourceId) throw new Error('ORDER_EVENT_CONTEXT_MISMATCH');
      const order = (await database.query<OrderRow>(`select id,scope_id,member_id,currency,total_minor::float8 total_minor,payment_state,
        fulfillment_state,lifecycle_state,verification_state from ordering.orderrecord where id=$1 and scope_id=$2 for update`, [input.orderId, input.scopeId])).rows[0];
      if (!order) throw new Error('ORDER_EVENT_TARGET_MISSING');
      if (input.eventType === 'payment.captured') await captured(database, order, input);
      if (input.eventType === 'refund.completed') await refunded(database, order, input);
      if (input.eventType === 'fulfillment.shipped') await shipped(database, order, input);
      if (!(await runtime.completeInbox('job:orderevent', input.eventId))) throw new Error('ORDER_EVENT_INBOX_CONFLICT');
    });
  }
}

async function captured(database: SqlExecutor, order: OrderRow, event: OrderProcessEvent): Promise<void> {
  const amount = integer(event.payload.amountMinor, 'ORDER_PAYMENT_EVENT_AMOUNT_INVALID');
  const currency = text(event.payload.currency, 'ORDER_PAYMENT_EVENT_CURRENCY_INVALID');
  const member = text(event.payload.member, 'ORDER_PAYMENT_EVENT_MEMBER_INVALID');
  if (amount !== Number(order.total_minor) || currency !== order.currency || member !== order.member_id || order.verification_state === 'rejected') throw new Error('ORDER_PAYMENT_EVENT_EVIDENCE_INVALID');
  await effect(database, event, 'capture', amount, currency);
  await database.query(
    `update ordering.orderrecord set payment_state='paid',fulfillment_state=case when fulfillment_state='unallocated' then 'allocated' else fulfillment_state end,
    lifecycle_state=case when lifecycle_state='awaitingpayment' then 'paid' else lifecycle_state end,
    verification_state=case when verification_state='pending' then 'verified' else verification_state end,
    version=version+1,updated_at=clock_timestamp() where id=$1 and
    (payment_state in('unpaid','authorizing','failed') or fulfillment_state='unallocated' or lifecycle_state='awaitingpayment' or verification_state='pending')`,
    [order.id]
  );
}

async function refunded(database: SqlExecutor, order: OrderRow, event: OrderProcessEvent): Promise<void> {
  const amount = integer(event.payload.amountMinor, 'ORDER_REFUND_EVENT_AMOUNT_INVALID');
  const currency = text(event.payload.currency, 'ORDER_REFUND_EVENT_CURRENCY_INVALID');
  if (currency !== order.currency || amount > Number(order.total_minor)) throw new Error('ORDER_REFUND_EVENT_EVIDENCE_INVALID');
  await effect(database, event, 'refund', amount, currency);
  const total = (await database.query<{ amount: number }>(
    `select coalesce(sum(amount_minor),0)::float8 amount from ordering.paymenteffect where order_id=$1 and kind='refund'`, [order.id]
  )).rows[0]?.amount ?? 0;
  if (total > Number(order.total_minor)) throw new Error('ORDER_REFUND_EVENT_EVIDENCE_INVALID');
  await database.query(
    `update ordering.orderrecord set payment_state=case when $2=total_minor then 'refunded' else 'partially_refunded' end,
    version=version+1,updated_at=clock_timestamp() where id=$1 and payment_state in('paid','partially_refunded')`, [order.id, total]
  );
}

async function shipped(database: SqlExecutor, order: OrderRow, event: OrderProcessEvent): Promise<void> {
  const state = event.payload.state;
  if (state !== 'shipped' && state !== 'delivered') throw new Error('ORDER_FULFILLMENT_EVENT_STATE_INVALID');
  await database.query(
    `update ordering.orderrecord set
    fulfillment_state=case when $2='delivered' and not exists(select 1 from ordering.line where order_id=$1 and fulfilled_quantity<quantity) then 'delivered' else 'processing' end,
    lifecycle_state=case when $2='delivered' and not exists(select 1 from ordering.line where order_id=$1 and fulfilled_quantity<quantity) then 'shipped' else 'fulfilling' end,
    version=version+1,updated_at=clock_timestamp()
    where id=$1 and fulfillment_state in('allocated','processing','shipped','delivered') and lifecycle_state in('paid','fulfilling','shipped')
      and verification_state='verified'`, [order.id, state]
  );
}

async function effect(database: SqlExecutor, event: OrderProcessEvent, kind: 'capture' | 'refund', amount: number, currency: string): Promise<void> {
  await database.query(
    `insert into ordering.paymenteffect(event_id,order_id,scope_id,source_id,kind,amount_minor,currency,evidence,occurred_at)
    values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,clock_timestamp()) on conflict do nothing`,
    [event.eventId, event.orderId, event.scopeId, event.sourceId, kind, amount, currency, JSON.stringify({ sourceId: event.sourceId, ...event.payload })]
  );
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function integer(value: unknown, code: string): number { const result = Number(value); if (!Number.isSafeInteger(result) || result <= 0) throw new Error(code); return result; }
