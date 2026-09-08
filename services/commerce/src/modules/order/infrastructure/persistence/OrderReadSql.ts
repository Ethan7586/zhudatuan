import type { OrderReadFilter } from '../../application/model/OrderReadFilter';

export function orderExceptionSql(source: 'orders' | 'visible'): string {
  return `(
    ${source}.payment_state='failed' or ${source}.lifecycle_state='cancelled'
    or ${source}.fulfillment_state in ('cancelled','returned')
    or ${source}.aftersale_state in ('reviewing','refunding')
    or ${source}.verification_state<>'verified'
  )`;
}

export const ORDER_READ_FILTER_SQL = `
  and ($6='' or orders.order_number=$6 or orders.external_reference=$6)
  and (
    $7='all'
    or ($7='unpaid' and orders.payment_state in ('unpaid','authorizing'))
    or ($7='unshipped' and orders.payment_state in ('paid','partially_refunded')
      and orders.fulfillment_state in ('unallocated','allocated'))
    or ($7='active' and orders.lifecycle_state<>'cancelled'
      and orders.fulfillment_state in ('processing','shipped','delivered'))
    or ($7='completed' and orders.lifecycle_state='completed')
    or ($7='exception' and ${orderExceptionSql('orders')})
  )
  and ($8='' or orders.created_at>=case $8
    when 'today' then date_trunc('day',clock_timestamp() at time zone $9) at time zone $9
    when '7days' then clock_timestamp()-interval '7 days'
    when '30days' then clock_timestamp()-interval '30 days'
    else '-infinity'::timestamptz end)
  and ($10::timestamptz is null or orders.created_at>=$10::timestamptz)
  and ($11::timestamptz is null or orders.created_at<$11::timestamptz)
  and ($12='' or orders.lifecycle_state=$12)
  and ($13='' or orders.payment_state=$13)
  and ($14='' or orders.fulfillment_state=$14)
  and ($15='' or orders.mall_id=$15)
  and ($16='' or orders.source_channel=$16 or exists(select 1 from ordering.line selected where selected.order_id=orders.id and selected.provider=$16))
  and ($17='' or exists(select 1 from ordering.line selected where selected.order_id=orders.id and
    (selected.title_snapshot ilike '%'||$17||'%' or selected.listing_id=$17 or selected.sku_id=$17 or selected.evidence->>'product'=$17)))
  and (coalesce(array_length($18::text[],1),0)=0 or orders.member_id=any($18::text[]))
  and ($19::bigint is null or orders.total_minor>=$19::bigint)
  and ($20::bigint is null or orders.total_minor<=$20::bigint)
  and ($21='' or orders.id=$21)`;

export function orderReadFilterValues(filter: OrderReadFilter, timezone: string, members: readonly string[], view = filter.view): readonly unknown[] {
  return Object.freeze([
    filter.search,
    view,
    filter.placed,
    timezone,
    filter.from || null,
    filter.to || null,
    filter.lifecycle,
    filter.payment,
    filter.fulfillment,
    filter.mall,
    filter.channel,
    filter.product,
    members,
    filter.minimumMinor,
    filter.maximumMinor,
    filter.order,
  ]);
}
