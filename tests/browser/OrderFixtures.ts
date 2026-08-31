import type { OperationCall } from './OperationMock';

export function orderRecord(serial = 1, title = '权威商品标题') {
  const suffix = String(serial).padStart(4, '0');
  return Object.freeze({
    id: `order:internal-${serial}`,
    order_number: `SW20260826${suffix}`,
    scope_id: 'enterprise:e2e',
    member_id: `member:verified-${serial}`,
    mall_id: 'mall:verified-1',
    checkout_id: `checkout:verified-${serial}`,
    total_minor: 12_800,
    currency: 'CNY',
    payment_state: 'paid',
    fulfillment_state: 'allocated',
    aftersale_state: 'none',
    lifecycle_state: 'paid',
    evidence: {},
    created_at: '2026-08-26T08:30:00.000Z',
    updated_at: '2026-08-26T09:00:00.000Z',
    version: 11,
    lines: [
      {
        id: `line:${serial}`,
        sku: `SKU-VERIFIED-${serial}`,
        listing: `listing:${serial}`,
        title,
        quantity: 2,
        unitMinor: 6_400,
        totalMinor: 12_800,
        discountMinor: 0,
        payableMinor: 12_800,
        productType: 'physical',
        category: 'category:office',
        provider: null,
        partner: null,
      },
    ],
  });
}

export function orderRead(call: OperationCall, rows: readonly ReturnType<typeof orderRecord>[] = [orderRecord()]) {
  const query = new URLSearchParams(call.query);
  const order = query.get('order');
  const visible = order === null ? rows : rows.filter((row) => row.id === order);
  return Object.freeze({ items: visible.slice(0, 50), count: Math.min(visible.length, 50) });
}
