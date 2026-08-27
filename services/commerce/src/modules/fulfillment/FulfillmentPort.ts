import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface PaidFulfillment {
  readonly order: string;
  readonly payment: string;
}

export class FulfillmentPort {
  async create(database: OperationDatabase, input: PaidFulfillment): Promise<readonly string[]> {
    const fulfillments = await database.query<{ id: string }>(`insert into fulfillment.fulfillmentorder(id,order_id,suborder_id,provider,partner_id,kind,state,
      payment_id,source_effect_id,amount_minor,idempotency_key,created_at,updated_at,version)
      select 'fulfillment:'||suborder.id,$1,suborder.id,suborder.provider,suborder.partner_id,
        case when bool_or(product.product_type='virtual') then 'digital' else 'shipment' end,'pending',$2,'payment:'||$2,
        sum(line.payable_minor),$2||':'||suborder.id,clock_timestamp(),clock_timestamp(),0
      from ordering.suborder suborder join ordering.line line on line.order_id=suborder.order_id
        and line.provider is not distinct from suborder.provider and line.partner_id is not distinct from suborder.partner_id
      join catalog.sku sku on sku.id=line.sku_id join catalog.product product on product.id=sku.product_id where suborder.order_id=$1
      group by suborder.id,suborder.provider,suborder.partner_id on conflict(source_effect_id,suborder_id) do nothing returning id`,
    [input.order, input.payment]);
    await database.query(`insert into fulfillment.line(fulfillment_id,order_line_id,quantity)
      select fulfillment.id,line.id,line.quantity from fulfillment.fulfillmentorder fulfillment join ordering.line line
      on line.order_id=fulfillment.order_id and line.provider is not distinct from fulfillment.provider
      and line.partner_id is not distinct from fulfillment.partner_id where fulfillment.order_id=$1 on conflict do nothing`, [input.order]);
    return fulfillments.rows.map(({ id }) => id);
  }
}

export const fulfillmentPort = new FulfillmentPort();
