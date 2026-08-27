import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('MallService demo safeguards', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it('isolates cart and order state between malls', async () => {
    const { mallService } = await import('./mallService');
    const originalCartCount = mallService.getCart().length;

    mallService.switchMall('mall_zh');
    expect(mallService.getCart()).toHaveLength(0);
    expect(mallService.getOrders()).toHaveLength(0);

    mallService.switchMall('mall_gw');
    expect(mallService.getCart()).toHaveLength(originalCartCount);
    expect(mallService.getOrders().length).toBeGreaterThan(0);
  });

  it('does not deduct more than the order total', async () => {
    const { mallService } = await import('./mallService');
    const item = mallService.getCart()[0];
    const before = mallService.getUserProfile();
    const total = item.product.priceWelfare * item.quantity;

    const result = mallService.submitCheckoutOrder({
      items: [item],
      address: mallService.getAddresses()[0],
      useWelfareAmount: total,
      useMealAmount: total,
      payMethod: 'welfare_only',
    });
    const after = mallService.getUserProfile();
    const deducted = before.welfareBalance - after.welfareBalance + before.mealBalance - after.mealBalance;

    expect(deducted).toBe(total);
    expect(result.subOrders[0].payment.welfareDeducted + result.subOrders[0].payment.mealDeducted).toBeLessThanOrEqual(total);
  });

  it('keeps split-order payment allocations equal to the parent payment', async () => {
    const { mallService } = await import('./mallService');
    const items = mallService.getCart();
    const total = items.reduce((sum, item) => sum + item.product.priceWelfare * item.quantity, 0);

    const result = mallService.submitCheckoutOrder({
      items,
      address: mallService.getAddresses()[0],
      useWelfareAmount: total * 0.55,
      useMealAmount: total * 0.25,
      payMethod: 'welfare_plus_wechat',
    });
    const allocated = result.subOrders.reduce((sum, order) => sum + order.payment.welfareDeducted + order.payment.mealDeducted + order.payment.wechatPaid, 0);

    expect(allocated).toBeCloseTo(total, 2);
  });
});
