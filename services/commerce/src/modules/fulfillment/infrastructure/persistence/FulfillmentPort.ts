import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PaidFulfillment } from '../../public/PaidFulfillment';
import type { FulfillmentOrderPort } from '../../../order/public';
export class FulfillmentPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly orders: Pick<FulfillmentOrderPort, 'recordFulfillments'>) {}
  async reconciliation(context: ReadTransactionContext, references: readonly string[]) {
    const database = this.transactions.database(context);
    if (references.length === 0) return Object.freeze([]);
    const result = await database.query<{
      reference: string;
      kind: 'fulfillment';
      id: string;
      amountMinor: number;
    }>(
      `select external_reference reference,'fulfillment'::text kind,id,coalesce(amount_minor,0)::float8 "amountMinor"
      from fulfillment.fulfillmentorder where external_reference=any($1::text[]) order by external_reference,id`,
      [references]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async create(context: WriteTransactionContext, input: PaidFulfillment): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const fulfillments = await database.query<{
      id: string;
    }>(
      `insert into fulfillment.fulfillmentorder(id,order_id,suborder_id,provider,partner_id,kind,state,
      payment_id,source_effect_id,amount_minor,idempotency_key,created_at,updated_at,version)
      select 'fulfillment:'||plan.suborder,$1,plan.suborder,plan.provider,plan.partner,plan.kind,'pending',$2,
        'payment:'||$2,plan."amountMinor",$2||':'||plan.suborder,clock_timestamp(),clock_timestamp(),0
      from jsonb_to_recordset($3::jsonb) as plan(suborder text,provider text,partner text,kind text,"amountMinor" bigint,lines jsonb)
      on conflict(source_effect_id,suborder_id) do nothing returning id`,
      [input.order, input.payment, JSON.stringify(input.plans)]
    );
    await database.query(
      `insert into fulfillment.line(fulfillment_id,order_line_id,quantity)
      select 'fulfillment:'||plan.suborder,line.line,line.quantity
      from jsonb_to_recordset($1::jsonb) as plan(suborder text,lines jsonb)
      cross join lateral jsonb_to_recordset(plan.lines) as line(line text,quantity bigint)
      on conflict do nothing`,
      [JSON.stringify(input.plans)]
    );
    const current = await database.query<{
      id: string;
      provider: string | null;
      partner: string | null;
      kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
      state: string;
      externalReference: string | null;
    }>(
      `select id,provider,partner_id partner,kind,state,external_reference "externalReference"
      from fulfillment.fulfillmentorder where order_id=$1 order by id`,
      [input.order]
    );
    await this.orders.recordFulfillments(context, input.order, current.rows);
    return fulfillments.rows.map(({ id }) => id);
  }
}
