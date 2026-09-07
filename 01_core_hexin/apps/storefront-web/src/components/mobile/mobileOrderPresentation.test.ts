import { describe, expect, it } from 'vitest';
import type { FrontendOrder, FrontendProduct } from '../../adapters/frontendData';
import { groupOrderPackages, inventoryStatus } from './mobileOrderPresentation';

function product(stockCount: number, purchasable = true, supplierName = '平台自营仓'): FrontendProduct {
  return { stockCount, purchasable, supplierName } as FrontendProduct;
}

describe('mobile order presentation', () => {
  it.each([
    [product(80), 'available'],
    [product(5), 'tight'],
    [product(0), 'unavailable'],
    [product(0, false), 'pending'],
  ] as const)('maps inventory to a visible state', (candidate, expected) => {
    expect(inventoryStatus(candidate)).toBe(expected);
  });

  it('reserves one package for each merchant', () => {
    const order = {
      id: 'order-1',
      status: 'pending_shipment',
      supplierName: '平台自营仓',
      mallName: '商城',
      items: [
        { product: product(20, true, '平台自营仓') },
        { product: product(20, true, '京东供应链') },
      ],
    } as FrontendOrder;

    expect(groupOrderPackages(order).map((item) => item.merchantName)).toEqual(['平台自营仓', '京东供应链']);
  });
});
