import { describe, expect, it } from 'vitest';
import type { FrontendOrder, FrontendProduct } from '../../adapters/frontendData';
import { groupOrderPackages, inventoryStatus, mobileOrderPayableAmount } from './mobileOrderPresentation';

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

  it('uses the external payment allocation as the outstanding amount', () => {
    const order = {
      totalAmount: 3299,
      payment: {
        totalGoodsAmount: 3299,
        shippingFee: 0,
        welfareDeducted: 3000,
        mealDeducted: 0,
        wechatPaid: 299,
      },
    } as FrontendOrder;

    expect(mobileOrderPayableAmount(order)).toBe(299);
  });

  it('derives the outstanding amount when the external allocation is absent', () => {
    const order = {
      totalAmount: 304,
      payment: {
        totalGoodsAmount: 304,
        shippingFee: 0,
        welfareDeducted: 200,
        mealDeducted: 80,
        wechatPaid: 0,
      },
    } as FrontendOrder;

    expect(mobileOrderPayableAmount(order)).toBe(24);
  });
});
