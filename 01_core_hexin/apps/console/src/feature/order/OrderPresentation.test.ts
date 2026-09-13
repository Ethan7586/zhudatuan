import { describe, expect, it } from 'vitest';
import { inventoryLabel, productSummary } from './OrderPresentation';
import type { OrderRecord } from './OrderSchema';

describe('order directory summaries', () => {
  it('renders lightweight server summaries without full line and reservation payloads', () => {
    const order = {
      product_summary: { title: '轻量商品', sku: 'SKU-1', quantity: 3, lineCount: 2 },
      inventory_summary: 'committed',
      lines: [],
      inventory_reservations: [],
    } as unknown as OrderRecord;

    expect(productSummary(order)).toEqual({ title: '轻量商品', detail: 'SKU-1 · 共 3 件 / 2 类' });
    expect(inventoryLabel(order)).toBe('库存已扣减');
  });
});
