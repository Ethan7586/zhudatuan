import { describe, expect, it } from 'vitest';
import { ORDER_CAPABILITIES, orderManifest } from '..';

describe('order module manifest', () => {
  it('keeps the stable module identity behind the pinyin-readable directory', () => {
    expect(orderManifest.id).toBe('order');
    expect(orderManifest.provides).toEqual([ORDER_CAPABILITIES.read, ORDER_CAPABILITIES.manage]);
    expect(orderManifest.publicEntry).toBe('./index.ts');
  });

  it('owns the complete canonical order operation set', () => {
    expect(orderManifest.operations).toEqual([
      'order.orders.create',
      'order.orders.read',
      'order.orders.receive',
      'order.reminders.create',
      'order.orders.export',
      'order.aftersales.read',
      'order.aftersales.apply',
      'order.aftersales.approve',
      'order.aftersales.reject',
    ]);
  });
});
