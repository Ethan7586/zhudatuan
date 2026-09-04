import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { WEB_ORDER_OPERATION_IDS } from './WebBusinessOperationIds';

export function webOrderOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('order', pool, context.container.get(AUDIT_SINK), {
    'order.orders.read': async (request, database) => {
      const access = requireAccess(request);
      const owner = access.scope.kind === 'owner';
      const supplier = access.scope.kind === 'supplier';
      const store = access.scope.kind === 'store';
      const order = queryValue(request.input.query.order);
      const page = queryPage(request);
      const result = await database.query(`select orders.*,coalesce(jsonb_agg(jsonb_build_object('id',line.id,'sku',line.sku_id,'listing',line.listing_id,'title',line.title_snapshot,
        'quantity',line.quantity,'unitMinor',line.unit_minor,'totalMinor',line.total_minor,'discountMinor',line.discount_minor,
        'payableMinor',line.payable_minor,'provider',line.provider,'partner',line.partner_id)) filter(where line.id is not null),'[]') lines
        from ordering.orderrecord orders left join ordering.line line on line.order_id=orders.id where (
        ($1::boolean and orders.member_id=$2) or ($3 and exists(select 1 from fulfillment.fulfillmentorder where order_id=orders.id and partner_id=$2))
        or ($4 and exists(select 1 from fulfillment.fulfillmentorder where order_id=orders.id and store_id=$2))
        or (not $1::boolean and not $3 and not $4 and exists(select 1 from organization.unitclosure closure where closure.ancestor_id=$2 and closure.descendant_id=orders.mall_id))
        ) and ($5='' or orders.id=$5) and ($6::timestamptz is null or (orders.created_at,orders.id)<($6::timestamptz,$7))
        group by orders.id order by orders.created_at desc,orders.id desc limit $8`,
      [owner, access.scope.id, supplier, store, order, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
  }, WEB_ORDER_OPERATION_IDS);
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}
