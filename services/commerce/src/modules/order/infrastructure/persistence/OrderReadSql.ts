import type { OrderReadFilter } from '../../application/model/OrderReadFilter';

export const ORDER_READ_FILTER_SQL = `
  and ($6='' or orders.id=$6)
  and (
    $7='all'
    or ($7='unpaid' and orders.payment_state in ('unpaid','authorizing'))
    or ($7='unshipped' and orders.payment_state in ('paid','partially_refunded')
      and orders.fulfillment_state in ('unallocated','allocated'))
    or ($7='active' and orders.lifecycle_state<>'cancelled'
      and orders.fulfillment_state in ('processing','shipped','delivered'))
    or ($7='completed' and orders.lifecycle_state='completed')
    or ($7='exception' and (
      orders.payment_state='failed' or orders.lifecycle_state='cancelled'
      or orders.fulfillment_state in ('cancelled','returned')
    ))
  )
  and ($8='' or orders.created_at>=case $8
    when 'today' then date_trunc('day',clock_timestamp() at time zone $9) at time zone $9
    when '7days' then clock_timestamp()-interval '7 days'
    when '30days' then clock_timestamp()-interval '30 days'
    else '-infinity'::timestamptz end)
  and ($10='' or orders.lifecycle_state=$10)
  and ($11='' or orders.payment_state=$11)
  and ($12='' or orders.fulfillment_state=$12)
  and ($13='' or orders.mall_id=$13)`;

export function orderReadFilterValues(filter: OrderReadFilter, timezone: string): readonly string[] {
  return Object.freeze([filter.order, filter.view, filter.placed, timezone, filter.lifecycle, filter.payment, filter.fulfillment, filter.mall]);
}
