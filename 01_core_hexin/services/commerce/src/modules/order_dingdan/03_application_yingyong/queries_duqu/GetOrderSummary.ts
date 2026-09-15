import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface OrderSummary {
  readonly id: string; readonly scope: string; readonly member: string; readonly number: string; readonly state: string;
  readonly paymentState: string; readonly fulfillmentState: string; readonly totalMinor: number;
}

/** Public synchronous query used by modules that validate an order reference. */
export class GetOrderSummary {
  async execute(database: OperationDatabase, order: string, scope: string, member: string, memberOnly: boolean): Promise<OrderSummary | null> {
    const result = await database.query<{ id: string; scope_id: string; member_id: string; order_number: string;
      lifecycle_state: string; payment_state: string; fulfillment_state: string; total_minor: number }>(`select target.id,target.scope_id,
      target.member_id,target.order_number,target.lifecycle_state,target.payment_state,target.fulfillment_state,
      target.total_minor::float8 total_minor from ordering.orderrecord target where target.id=$1 and
      (($4=false and exists(select 1 from organization.unitclosure where ancestor_id=$2 and descendant_id=target.scope_id))
      or target.member_id=$3)`, [order, scope, member, memberOnly]);
    const found = result.rows[0]; return found ? { id: found.id, scope: found.scope_id, member: found.member_id,
      number: found.order_number, state: found.lifecycle_state, paymentState: found.payment_state,
      fulfillmentState: found.fulfillment_state, totalMinor: found.total_minor } : null;
  }
}
