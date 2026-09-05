import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { publishOrderReceived } from '../services_fuwu/OrderReceivedEvent';

interface OrderReceiptRow {
  readonly id: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly lifecycle_state: string;
  readonly fulfillment_state: string;
  readonly version: number;
}

interface FulfillmentReadinessRow {
  readonly total: string | number;
  readonly shipped: string | number;
}

export function confirmOrderReceiptOperations(): OperationActions {
  return { 'order.orders.receive': receive };
}

const receive: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const orderId = request.input.path.orderid;
  if (!orderId) throw new Error('ORDER_ID_REQUIRED');

  const selected = await database.query<OrderReceiptRow>(
    `select id,mall_id,member_id,lifecycle_state,fulfillment_state,version from ordering.orderrecord
    where id=$1 and member_id=$2 for update`,
    [orderId, access.scope.id]
  );
  const order = selected.rows[0];
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.lifecycle_state === 'completed' && order.fulfillment_state === 'delivered') return response(order, false);

  await requireEveryFulfillmentShipped(database, order.id, order.mall_id);
  const changed = await database.query<OrderReceiptRow>(
    `update ordering.orderrecord set fulfillment_state='delivered',lifecycle_state='completed',
    version=version+1,updated_at=clock_timestamp() where id=$1 and member_id=$2 and version=$3
    and fulfillment_state<>'delivered' returning id,mall_id,member_id,lifecycle_state,fulfillment_state,version`,
    [order.id, order.member_id, request.input.expectedVersion]
  );
  const received = changed.rows[0];
  if (!received) throw new Error('VERSION_CONFLICT');
  await publishOrderReceived(database, {
    order: received.id,
    mall: received.mall_id,
    member: received.member_id,
    source: 'member',
    actor: access.actor.id,
    correlation: access.trace,
  });
  return response(received, true);
};

async function requireEveryFulfillmentShipped(database: OperationDatabase, order: string, mall: string): Promise<void> {
  const result = await database.query<FulfillmentReadinessRow>(
    `select count(*) total,count(*) filter(where fulfillment.state='completed' or exists(
      select 1 from fulfillment.milestone milestone where milestone.mall_id=fulfillment.mall_id
      and milestone.fulfillment_id=fulfillment.id and lower(milestone.state) in
      ('shipped','intransit','outfordelivery','delivered','completed','pickedup'))) shipped
    from fulfillment.fulfillmentorder fulfillment where fulfillment.order_id=$1 and fulfillment.mall_id=$2`,
    [order, mall]
  );
  const total = Number(result.rows[0]?.total ?? 0);
  const shipped = Number(result.rows[0]?.shipped ?? 0);
  if (total === 0 || shipped !== total) throw new Error('ORDER_RECEIPT_STATE_INVALID');
}

function response(order: OrderReceiptRow, changed: boolean) {
  return {
    status: 200,
    body: Object.freeze({
      id: order.id,
      lifecycleState: order.lifecycle_state,
      fulfillmentState: order.fulfillment_state,
      version: order.version,
      changed,
    }),
  };
}
