import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderFulfillmentMilestone, OrderFulfillmentProjection, OrderRefundProjection } from '../../public';
import { OrderAfterSalePort } from './OrderAfterSalePort';

export class OrderProjectionPort extends OrderAfterSalePort {
  async recordPayment(
    context: WriteTransactionContext,
    input: Readonly<{
      order: string; payment: string; currency: string; capturedMinor: number; refundedMinor: number; state: string;
      tenders: readonly Readonly<{ sequence: number; kind: 'wechat' | 'benefit' | 'voucher'; reference: string | null; amountMinor: number; state: string }>[];
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into ordering.paymentread(order_id,payment_id,currency,captured_minor,refunded_minor,state,updated_at)
      values($1,$2,$3,$4,$5,$6,clock_timestamp()) on conflict(order_id) do update set
      payment_id=excluded.payment_id,currency=excluded.currency,captured_minor=excluded.captured_minor,
      refunded_minor=excluded.refunded_minor,state=excluded.state,updated_at=excluded.updated_at`,
      [input.order, input.payment, input.currency, input.capturedMinor, input.refundedMinor, input.state]
    );
    await database.query(`delete from ordering.paymenttenderread where order_id=$1`, [input.order]);
    if (input.tenders.length > 0) await database.query(
      `insert into ordering.paymenttenderread(order_id,sequence,kind,reference_id,amount_minor,state)
      select $1,tender.sequence,tender.kind,tender.reference,tender."amountMinor",tender.state
      from jsonb_to_recordset($2::jsonb) as tender(sequence integer,kind text,reference text,"amountMinor" bigint,state text)
      order by tender.sequence`, [input.order, JSON.stringify(input.tenders)]
    );
  }

  async recordRefund(context: WriteTransactionContext, input: OrderRefundProjection): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into ordering.refundread(id,order_id,aftersale_id,provider,provider_reference,amount_minor,currency,state,reason,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp(),clock_timestamp()) on conflict(id) do update set
      aftersale_id=excluded.aftersale_id,provider=excluded.provider,provider_reference=excluded.provider_reference,
      amount_minor=excluded.amount_minor,currency=excluded.currency,state=excluded.state,reason=excluded.reason,updated_at=excluded.updated_at`,
      [input.id, input.order, input.aftersale, input.provider, input.providerReference, input.amountMinor, input.currency, input.state, input.reason]
    );
    await database.query(`delete from ordering.refundtenderread where refund_id=$1`, [input.id]);
    if (input.tenders.length > 0) await database.query(
      `insert into ordering.refundtenderread(refund_id,sequence,kind,reference_id,amount_minor,state)
      select $1,tender.sequence,tender.kind,tender.reference,tender."amountMinor",tender.state
      from jsonb_to_recordset($2::jsonb) as tender(sequence integer,kind text,reference text,"amountMinor" bigint,state text)
      order by tender.sequence`, [input.id, JSON.stringify(input.tenders)]
    );
  }

  async recordPaymentRefund(context: WriteTransactionContext, order: string, refundedMinor: number, capturedMinor: number): Promise<void> {
    const changed = await this.transactions.database(context).query(
      `update ordering.paymentread set refunded_minor=$2,state=case when $2=$3 then 'refunded' else 'partiallyrefunded' end,
      updated_at=clock_timestamp() where order_id=$1 and captured_minor=$3 returning order_id`, [order, refundedMinor, capturedMinor]
    );
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_PROJECTION_MISSING');
  }

  async recordFulfillments(context: WriteTransactionContext, order: string, items: readonly OrderFulfillmentProjection[]): Promise<void> {
    if (items.length === 0) return;
    await this.transactions.database(context).query(
      `insert into ordering.fulfillmentread(id,order_id,provider,partner_id,kind,state,external_reference,created_at,updated_at)
      select item.id,$1,item.provider,item.partner,item.kind,item.state,item."externalReference",clock_timestamp(),clock_timestamp()
      from jsonb_to_recordset($2::jsonb) as item(id text,provider text,partner text,kind text,state text,"externalReference" text)
      on conflict(id) do update set provider=excluded.provider,partner_id=excluded.partner_id,kind=excluded.kind,
      state=excluded.state,external_reference=excluded.external_reference,updated_at=excluded.updated_at`, [order, JSON.stringify(items)]
    );
  }

  async recordFulfillmentMilestones(context: WriteTransactionContext, order: string, fulfillment: string, items: readonly OrderFulfillmentMilestone[]): Promise<void> {
    if (items.length === 0) return;
    await this.transactions.database(context).query(
      `insert into ordering.fulfillmentmilestoneread(id,order_id,fulfillment_id,kind,state,tracking,occurred_at)
      select item.id,$1,$2,item.kind,item.state,item.tracking,item."occurredAt"::timestamptz
      from jsonb_to_recordset($3::jsonb) as item(id text,kind text,state text,tracking text,"occurredAt" text)
      on conflict(id) do update set state=excluded.state,tracking=excluded.tracking,occurred_at=excluded.occurred_at`,
      [order, fulfillment, JSON.stringify(items)]
    );
  }
}
