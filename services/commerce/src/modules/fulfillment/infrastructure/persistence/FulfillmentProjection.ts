import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderFulfillmentPort } from '../../../order/public';

export async function projectFulfillment(
  transactions: PgTransactionAccess,
  orders: OrderFulfillmentPort,
  context: WriteTransactionContext,
  id: string,
  order: string
): Promise<void> {
  const database = transactions.database(context);
  const fulfillment = await database.query<{
    id: string;
    provider: string | null;
    partner: string | null;
    kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
    state: string;
    externalReference: string | null;
    version: number;
  }>(
    `select id,provider,partner_id partner,kind,state,external_reference "externalReference",version::float8 version
    from fulfillment.fulfillmentorder where id=$1 and order_id=$2`,
    [id, order]
  );
  const selected = fulfillment.rows[0];
  if (!selected) throw new Error('FULFILLMENT_PROJECTION_SOURCE_MISSING');
  await orders.recordFulfillments(context, order, [selected]);
  const milestones = await database.query<{ id: string; kind: string; state: string; tracking: string | null; occurredAt: string }>(
    `select event.id,'tracking'::text kind,event.state,package.tracking_number tracking,event.occurred_at "occurredAt"
    from fulfillment.trackingevent event join fulfillment.package package on package.id=event.package_id
    join fulfillment.shipment shipment on shipment.id=package.shipment_id
    where shipment.fulfillment_id=$1 order by event.occurred_at,event.id`,
    [id]
  );
  await orders.recordFulfillmentMilestones(context, order, id, milestones.rows);
}
