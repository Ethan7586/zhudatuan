import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Money } from '@shop/kernel';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { OrderProjectionPort } from './OrderProjectionPort';
import { nextOrderNumber } from './OrderNumber';
import type { CreateOrderIntent } from '../../public/OrderIntentPort';
import { DomainError } from '../../../../platform/error/DomainError';
import { OrderReadPort } from './OrderReadPort';
import { orderProjection } from './OrderProjection';
export class OrderPort extends OrderReadPort {
  async create(
    context: WriteTransactionContext,
    input: CreateOrderIntent
  ): Promise<
    Readonly<{
      number: string;
      record: Record<string, unknown>;
    }>
  > {
    const database = this.transactions.database(context);
    const number = await nextOrderNumber(database);
    const accepted = input.lines.filter(({ accepted }) => accepted);
    const subtotalMinor = accepted.reduce((sum, line) => sum + line.totalMinor, 0);
    const discountMinor = accepted.reduce((sum, line) => sum + line.discountMinor, 0);
    if (subtotalMinor - discountMinor !== input.money.minor) throw new DomainError('ORDER_SNAPSHOT_INVALID');
    const amount = Object.freeze({ subtotalMinor, discountMinor, shippingMinor: 0, taxMinor: 0, payableMinor: input.money.minor, currency: input.money.currency.code });
    const saved = await database.query(
      `insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,
      payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,
      experience_version,verification_state,ordered_at,amount_snapshot,created_at,updated_at,version)
      values($1,$2,$3,$4,$3,$5,$6,$7,'unpaid','unallocated','none','awaitingpayment',$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,
        'verified',clock_timestamp(),$13::jsonb,clock_timestamp(),clock_timestamp(),0)
      returning id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
        fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,
        experience_version,created_at,updated_at,version`,
      [
        input.id,
        number,
        input.scope,
        input.member,
        input.checkout,
        input.money.currency.code,
        input.money.minor,
        JSON.stringify(input.evidence),
        JSON.stringify(input.address),
        JSON.stringify(input.invoice),
        JSON.stringify(input.delivery),
        input.experienceVersion,
        JSON.stringify(amount),
      ]
    );
    const record = saved.rows[0] as Record<string, unknown> | undefined;
    if (!record) throw new Error('ORDER_CREATE_FAILED');
    await database.query(
      `insert into ordering.line(id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,
      discount_minor,qualification_evidence_id,provider,partner_id,evidence)
      select 'line:'||gen_random_uuid()::text,$1,line.sku,line.listing,line.title,line.quantity,line."unitMinor",line."totalMinor",
        line."discountMinor",null,line.provider,line.partner,
        jsonb_build_object('versions',line.versions,'product',line.product,'productType',line."productType",'category',line.category,
          'imageReference',line."imageReference",'imageUrl',line."imageUrl")
      from jsonb_to_recordset($2::jsonb) as line(sku text,listing text,title text,quantity bigint,"unitMinor" bigint,
        "totalMinor" bigint,"discountMinor" bigint,"payableMinor" bigint,provider text,partner text,versions jsonb,accepted boolean,
        product text,"productType" text,category text,"imageReference" text,"imageUrl" text)
      where line.accepted`,
      [input.id, JSON.stringify(input.lines)]
    );
    await database.query(
      `insert into ordering.suborder(id,order_id,partner_id,provider,state,version)
      select 'suborder:'||md5($1||':'||coalesce(line.provider,'internal')||':'||coalesce(line.partner_id,'internal')),
        $1,line.partner_id,line.provider,'pending',0 from ordering.line line where line.order_id=$1
      group by line.provider,line.partner_id`,
      [input.id]
    );
    return Object.freeze({ number, record: orderProjection(record) });
  }
  async scheduleExpiry(context: WriteTransactionContext, order: string, scope: string): Promise<void> {
    const database = this.transactions.database(context);
    await new PgRuntimeWriter(database).schedule({ id: `job:expiry:${order}`, kind: 'orderexpiry', owner: 'order', scope, payload: { order }, priority: 10, availableAt: new Date(Date.now() + 30 * 60000).toISOString() });
  }
  async paymentState(context: WriteTransactionContext, order: string): Promise<string> {
    const database = this.transactions.database(context);
    const selected = await database.query<{
      payment_state: string;
    }>(`select payment_state from ordering.orderrecord where id=$1 for update`, [order]);
    const state = selected.rows[0]?.payment_state;
    if (!state) throw new Error('ORDER_NOT_FOUND');
    return state;
  }
  async markAuthorizing(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update ordering.orderrecord set payment_state='authorizing',version=version+1,updated_at=clock_timestamp()
      where id=$1 and payment_state='unpaid' returning id`,
      [order]
    );
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }
  async markPaid(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update ordering.orderrecord set payment_state='paid',lifecycle_state='paid',fulfillment_state='allocated',
      version=version+1,updated_at=clock_timestamp() where id=$1 and payment_state in('unpaid','authorizing') returning id`,
      [order]
    );
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }
  async markLatePaid(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update ordering.orderrecord set payment_state='paid',version=version+1,updated_at=clock_timestamp()
      where id=$1 and payment_state in('unpaid','authorizing','failed') returning id`,
      [order]
    );
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
  }
  async cancelUnpaid(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update ordering.orderrecord set lifecycle_state='cancelled',fulfillment_state='cancelled',
      version=version+1,updated_at=clock_timestamp() where id=$1 and payment_state in('unpaid','authorizing') returning id`,
      [order]
    );
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }
  async expirable(context: WriteTransactionContext, orders: readonly string[]) {
    const database = this.transactions.database(context);
    if (orders.length === 0) return Object.freeze([]);
    const result = await database.query<{
      id: string;
      scope: string;
    }>(
      `select id,scope_id scope from ordering.orderrecord where id=any($1::text[])
      and payment_state in('unpaid','authorizing') order by id for update`,
      [orders]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async resetPayment(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update ordering.orderrecord set payment_state='unpaid',version=version+1,updated_at=clock_timestamp()
      where id=$1 and payment_state='authorizing' returning id`,
      [order]
    );
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }
  async completeFulfillment(
    context: WriteTransactionContext,
    order: string,
    lines: readonly Readonly<{
      line: string;
      quantity: number;
    }>[]
  ): Promise<void> {
    const database = this.transactions.database(context);
    for (const line of [...lines].sort((left, right) => left.line.localeCompare(right.line))) {
      const changedLine = await database.query(
        `update ordering.line set fulfilled_quantity=least(quantity,fulfilled_quantity+$2),fulfilled_at=clock_timestamp()
        where id=$1 and order_id=$3 and fulfilled_quantity+$2<=quantity returning id`,
        [line.line, line.quantity, order]
      );
      if (!changedLine.rows[0]) throw new Error('ORDER_FULFILLMENT_QUANTITY_CONFLICT');
    }
    const changed = await database.query(
      `update ordering.orderrecord set
      fulfillment_state=case when exists(select 1 from ordering.line where order_id=$1 and fulfilled_quantity<quantity) then 'processing' else 'delivered' end,
      lifecycle_state=case when exists(select 1 from ordering.line where order_id=$1 and fulfilled_quantity<quantity) then 'fulfilling' else 'shipped' end,
      version=version+1,updated_at=clock_timestamp() where id=$1 returning id`,
      [order]
    );
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
  }
}
