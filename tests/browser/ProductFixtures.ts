export function productListing(serial = 1, title = `服务端商品 ${String(serial).padStart(4, '0')}`) {
  return Object.freeze({
    id: `listing:${serial}`,
    pool_id: 'pool:authorized',
    sku_id: `sku:${serial}`,
    title,
    status: 'published',
    effective_at: '2026-08-26T00:00:00.000Z',
    expires_at: null,
    version: 3,
    cursor_sort: '2026-08-26T06:00:00.000Z',
    code: `SKU-PRODUCTION-${serial}`,
    product_id: `product:${serial}`,
    product_type: 'physical',
    cover_url: null,
    subtitle: '服务端商品主档快照',
  });
}

export function productPage(items: readonly ReturnType<typeof productListing>[], nextCursor?: string) {
  return Object.freeze({ items, count: items.length, ...(nextCursor === undefined ? {} : { nextCursor }) });
}
