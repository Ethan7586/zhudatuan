import { describe, expect, it } from 'vitest';
import { OrderAddress } from './model/OrderAddress';
import { OrderFulfillment } from './model/OrderFulfillment';
import { OrderLine } from './model/OrderLine';
import { OrderPayment } from './model/OrderPayment';
import { OrderTransition } from './policy/OrderTransition';
import { OrderVisibility } from './policy/OrderVisibility';

describe('Order domain', () => {
  it('freezes immutable transaction snapshots and rejects amount drift or plaintext addresses', () => {
    const line = {
      id: 'line:one',
      sku: 'sku:one',
      listing: 'listing:one',
      product: 'product:one',
      productType: 'physical',
      category: 'category:one',
      title: '福利商品',
      quantity: 2,
      unitMinor: 100,
      totalMinor: 200,
      discountMinor: 20,
      payableMinor: 180,
      provider: null,
      partner: null,
      versions: { listing: 1, product: 2, sku: 3, price: 'price:4', stock: 5 },
    } as const;
    expect(OrderLine.freeze(line).value).toEqual(line);
    expect(() => OrderLine.freeze({ ...line, payableMinor: 181 })).toThrow('ORDER_SNAPSHOT_INVALID');
    expect(() => OrderAddress.freeze({ recipientMasked: '张三', mobileMasked: '13812345678', addressMasked: '上海市', regionCode: '310000', version: '1', hash: 'a'.repeat(64) })).toThrow('ORDER_SNAPSHOT_INVALID');
    expect(OrderPayment.freeze({ state: 'partially_refunded', currency: 'CNY', payableMinor: 180, capturedMinor: 180, refundedMinor: 20, evidence: {} }).value.refundedMinor).toBe(20);
    expect(OrderFulfillment.freeze({ state: 'allocated', route: [{ line: 'line:one', quantity: 2, kind: 'shipment', provider: null, partner: null }], addressHash: 'b'.repeat(64) }).value.route).toHaveLength(1);
  });

  it('keeps terminal states irreversible and dimensions orthogonal', () => {
    const policy = new OrderTransition();
    expect(() => policy.lifecycle('awaitingpayment', 'paid')).not.toThrow();
    expect(() => policy.payment('paid', 'partially_refunded')).not.toThrow();
    expect(() => policy.lifecycle('completed', 'paid')).toThrow('ORDER_TRANSITION_INVALID');
    expect(() => policy.fulfillment('returned', 'shipped')).toThrow('ORDER_TRANSITION_INVALID');
  });

  it('applies section visibility by consumer, partner and operator role', () => {
    const policy = new OrderVisibility();
    expect([...policy.sections('owner')]).not.toContain('audit');
    expect([...policy.sections('owner')]).not.toContain('finance');
    expect([...policy.sections('supplier')]).not.toContain('payment');
    expect([...policy.sections('enterprise')]).toContain('audit');
    expect([...policy.sections('enterprise')]).toContain('finance');
  });
});
