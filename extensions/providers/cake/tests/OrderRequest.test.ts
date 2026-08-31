import { describe, expect, it } from 'vitest';
import { buildCakeOrderRequest } from '../OrderRequest';

describe('cake order request builder', () => {
  it('serializes the documented CSV order fields without authentication or retry behavior', () => {
    expect(buildCakeOrderRequest('fulfillment-1', {
      userId: 'vendor-user',
      recipient: { name: '收货人', phone: '13800138000' },
      buyerPhone: '13900139000',
      delivery: { cityName: '上海市', area: '浦东新区', address: '示例路 1 号', areaCode: '310115' },
      orders: [{ specIds: ['1001'], clearingPricesMinor: [8000], quantities: [2], tastes: ['奶油'],
        shipType: 'delivery', shipDate: '2026-08-30', shipTimeText: '09:00-12:00' }],
    })).toEqual({
      out_order_no: 'fulfillment-1', name: '收货人', city_name: '上海市', area: '浦东新区', addr: '示例路 1 号',
      area_code: '310115', user_id: 'vendor-user', buyer_phone: '13900139000', phone: '13800138000', orders: [{ spec_ids: '1001',
        clearing_prices: '80.00', quantitys: '2', tastes: '奶油', ship_type: 'delivery', ship_date: '2026-08-30',
        ship_time_text: '09:00-12:00' }],
    });
  });

  it('rejects unsafe schedule and parallel-array combinations', () => {
    const base = {
      userId: 'vendor-user',
      recipient: { name: '收货人', phone: '13800138000' }, buyerPhone: '13900139000',
      delivery: { cityName: '上海市', area: '浦东新区', address: '示例路 1 号', areaCode: '310115' },
    } as const;
    expect(() => buildCakeOrderRequest('fulfillment-1', { ...base, orders: [{ specIds: ['1001'],
      clearingPricesMinor: [8000], quantities: [1], shipType: 'same', shipDate: '2026-08-30' }] }))
      .toThrow('CAKE_ORDER_SAME_SCHEDULE_FORBIDDEN');
    expect(() => buildCakeOrderRequest('fulfillment-1', { ...base, orders: [{ specIds: ['1001', '1002'],
      clearingPricesMinor: [8000], quantities: [1, 1], shipType: 'same' }] }))
      .toThrow('CAKE_ORDER_GROUP_LENGTH_INVALID');
  });
});
