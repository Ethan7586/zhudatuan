import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface PaidFulfillment {
  readonly mall: string;
  readonly member: string;
  readonly order: string;
  readonly payment: string;
}

export class FulfillmentPort {
  async create(database: OperationDatabase, input: PaidFulfillment): Promise<readonly string[]> {
    const fulfillments = await database.query<{ id: string }>(`insert into fulfillment.fulfillmentorder(id,mall_id,member_id,provider_scope_id,
      order_id,suborder_id,provider,partner_id,kind,state,payment_id,source_effect_id,amount_minor,idempotency_key,created_at,updated_at,version)
      select 'fulfillment:'||suborder.id,$1,$2,orders.scope_id,$3,suborder.id,suborder.provider,suborder.partner_id,
        case when bool_or(product.product_type='virtual') then 'digital' else 'shipment' end,'pending',$4,'payment:'||$4,
        sum(line.payable_minor),$4||':'||suborder.id,clock_timestamp(),clock_timestamp(),0
      from ordering.suborder suborder join ordering.orderrecord orders on orders.id=suborder.order_id and orders.mall_id=$1 and orders.member_id=$2
      join ordering.line line on line.order_id=suborder.order_id
        and line.provider is not distinct from suborder.provider and line.partner_id is not distinct from suborder.partner_id
      join catalog.sku sku on sku.id=line.sku_id join catalog.product product on product.id=sku.product_id where suborder.order_id=$3
      group by suborder.id,suborder.provider,suborder.partner_id,orders.scope_id
      on conflict(mall_id,source_effect_id,suborder_id) do nothing returning id`,
    [input.mall, input.member, input.order, input.payment]);
    await database.query(`insert into fulfillment.line(mall_id,fulfillment_id,order_line_id,quantity)
      select fulfillment.mall_id,fulfillment.id,line.id,line.quantity from fulfillment.fulfillmentorder fulfillment join ordering.line line
      on line.order_id=fulfillment.order_id and line.provider is not distinct from fulfillment.provider
      and line.partner_id is not distinct from fulfillment.partner_id where fulfillment.mall_id=$1 and fulfillment.order_id=$2
      on conflict(mall_id,fulfillment_id,order_line_id) do nothing`, [input.mall, input.order]);
    return fulfillments.rows.map(({ id }) => id);
  }
}

export const fulfillmentPort = new FulfillmentPort();
