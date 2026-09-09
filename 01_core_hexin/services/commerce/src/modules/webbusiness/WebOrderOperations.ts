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
      const payment = queryEnum(request.input.query.payment, PAYMENT_STATES);
      const fulfillment = queryEnum(request.input.query.fulfillment, FULFILLMENT_STATES);
      const lifecycle = queryEnum(request.input.query.lifecycle, LIFECYCLE_STATES);
      const placed = queryEnum(request.input.query.placed, PLACED_WINDOWS);
      const view = queryEnum(request.input.query.view, ORDER_VIEWS);
      const mall = queryValue(request.input.query.mall);
      const page = queryPage(request);
      const result = await database.query(`select orders.*,coalesce(lines.items,'[]'::jsonb) lines,
        coalesce(inventory.items,'[]'::jsonb) inventory_reservations,coalesce(aftersales.items,'[]'::jsonb) aftersales
        from ordering.orderrecord orders
        left join lateral(select jsonb_agg(jsonb_build_object('id',line.id,'sku',line.sku_id,'listing',line.listing_id,'title',line.title_snapshot,
          'quantity',line.quantity,'unitMinor',line.unit_minor,'totalMinor',line.total_minor,'discountMinor',line.discount_minor,
          'payableMinor',line.payable_minor,'provider',line.provider,'partner',line.partner_id) order by line.id) items
          from ordering.line line where line.order_id=orders.id) lines on true
        left join lateral(select jsonb_agg(jsonb_build_object('id',reservation.id,'stockItem',reservation.stockitem_id,
          'quantity',reservation.quantity,'state',reservation.state,'expiresAt',reservation.expires_at) order by reservation.id) items
          from inventory.reservation reservation where reservation.owner_type='order' and reservation.owner_id=orders.id) inventory on true
        left join lateral(select jsonb_agg(jsonb_build_object('id',aftersale.id,'lineId',aftersale.line_id,'kind',aftersale.kind,
          'state',aftersale.state,'quantity',aftersale.quantity,'amountMinor',aftersale.amount_minor,'reason',aftersale.reason,
          'requestedAt',aftersale.created_at,'updatedAt',aftersale.updated_at) order by aftersale.created_at desc,aftersale.id desc) items
          from ordering.aftersale aftersale where aftersale.order_id=orders.id) aftersales on true where (
        ($1::boolean and orders.member_id=$2) or ($3 and exists(select 1 from fulfillment.fulfillmentorder where order_id=orders.id and partner_id=$2))
        or ($4 and exists(select 1 from fulfillment.fulfillmentorder where order_id=orders.id and store_id=$2))
        or (not $1::boolean and not $3 and not $4 and exists(select 1 from organization.unitclosure closure where closure.ancestor_id=$2 and closure.descendant_id=orders.mall_id))
        ) and ($5='' or orders.id=$5 or orders.order_number=$5)
        and ($6::timestamptz is null or (orders.created_at,orders.id)<($6::timestamptz,$7))
        and ($8='' or orders.payment_state=$8) and ($9='' or orders.fulfillment_state=$9)
        and ($10='' or orders.lifecycle_state=$10) and ($11='' or orders.mall_id=$11)
        and ($12='' or ($12='today' and orders.created_at>=date_trunc('day',clock_timestamp()))
          or ($12='7days' and orders.created_at>=clock_timestamp()-interval '7 days')
          or ($12='30days' and orders.created_at>=clock_timestamp()-interval '30 days'))
        and ($13='' or ($13='unpaid' and orders.payment_state='unpaid')
          or ($13='unshipped' and orders.fulfillment_state in('unallocated','allocated','processing'))
          or ($13='active' and orders.lifecycle_state in('created','active'))
          or ($13='completed' and orders.lifecycle_state='completed')
          or ($13='aftersale' and orders.aftersale_state<>'none')
          or ($13='exception' and (orders.payment_state='failed' or orders.lifecycle_state='cancelled' or orders.aftersale_state='rejected')))
        order by orders.created_at desc,orders.id desc limit $14`,
      [owner, access.scope.id, supplier, store, order, page.sort, page.id, payment, fulfillment, lifecycle, mall, placed, view, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
  }, WEB_ORDER_OPERATION_IDS);
}

const PAYMENT_STATES = ['unpaid', 'authorizing', 'paid', 'partially_refunded', 'refunded', 'failed'] as const;
const FULFILLMENT_STATES = ['unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
const LIFECYCLE_STATES = ['created', 'active', 'completed', 'cancelled', 'closed'] as const;
const PLACED_WINDOWS = ['today', '7days', '30days'] as const;
const ORDER_VIEWS = ['unpaid', 'unshipped', 'active', 'completed', 'aftersale', 'exception'] as const;

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}

function queryEnum<const T extends string>(value: string | readonly string[] | undefined, allowed: readonly T[]): T | '' {
  const normalized = queryValue(value);
  return allowed.includes(normalized as T) ? normalized as T : '';
}
