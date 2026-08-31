import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { FulfillmentPort } from '../../fulfillment/FulfillmentPort';
import type { InventoryPort } from '../../inventory/InventoryPort';
import type { MarketingPort } from '../../marketing/MarketingPort';
import type { OrderPort } from '../../order/OrderPort';
import { PaymentSettlement } from './PaymentSettlement';

describe('canonical payment settlement injection', () => {
  it('keeps the captured sequence while allowing the purchase benefit boundary', async () => {
    const events: string[] = [];
    const benefit = {
      consume: vi.fn(async () => {
        events.push('benefit');
      }),
    };
    const voucher = {
      consume: vi.fn(async () => {
        events.push('voucher');
      }),
    };
    const inventory = {
      commit: vi.fn(async () => {
        events.push('inventory');
      }),
    } as unknown as InventoryPort;
    const marketing = {
      commit: vi.fn(async () => {
        events.push('marketing');
      }),
    } as unknown as MarketingPort;
    const fulfillment = {
      create: vi.fn(async () => {
        events.push('fulfillment');
        return ['fulfillment:one'];
      }),
    } as unknown as FulfillmentPort;
    const orders = {
      paymentState: vi.fn(async () => 'unpaid'),
      fulfillment: vi.fn(async () => [{ suborder: 'suborder:one', provider: null, partner: null, kind: 'digital' as const, amountMinor: 100, lines: [{ line: 'line:one', quantity: 1 }] }]),
      markPaid: vi.fn(async () => {
        events.push('order-paid');
      }),
    } as unknown as OrderPort;
    const database = databaseWithTender('benefit');
    const settlement = new PaymentSettlement(benefit, voucher, inventory, marketing, fulfillment, orders);

    await expect(settlement.capture(database, target(), 'internal')).resolves.toBe('payment:intent:one');
    expect(benefit.consume).toHaveBeenCalledWith(database, 'order:one', 'account:one', 100);
    expect(voucher.consume).not.toHaveBeenCalled();
    expect(fulfillment.create).toHaveBeenCalledWith(database, {
      order: 'order:one',
      payment: 'payment:intent:one',
      plans: [{ suborder: 'suborder:one', provider: null, partner: null, kind: 'digital', amountMinor: 100, lines: [{ line: 'line:one', quantity: 1 }] }],
    });
    expect(events).toEqual(['benefit', 'inventory', 'marketing', 'order-paid', 'fulfillment']);
  });

  it('requires explicit dependencies and rejects external tender capture before side effects', async () => {
    const benefit = { consume: vi.fn() };
    const voucher = { consume: vi.fn() };
    const inventory = { commit: vi.fn() } as unknown as InventoryPort;
    const marketing = { commit: vi.fn() } as unknown as MarketingPort;
    const fulfillment = { create: vi.fn() } as unknown as FulfillmentPort;
    const orders = { paymentState: vi.fn(async () => 'unpaid'), markPaid: vi.fn(), fulfillment: vi.fn(async () => []) } as unknown as OrderPort;
    const settlement = new PaymentSettlement(benefit, voucher, inventory, marketing, fulfillment, orders);
    await expect(settlement.capture(databaseWithTender('wechat'), target(), 'internal')).rejects.toThrow('PAYMENT_EXTERNAL_TENDER_NOT_CAPTURED');
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
  });
});

function databaseWithTender(kind: 'benefit' | 'wechat'): OperationDatabase {
  return {
    query: vi.fn(async (text: string) => {
      if (text.startsWith('select state from payment.intent')) return result([{ state: 'created' }]);
      if (text.startsWith('select id from payment.payment')) return result([]);
      if (text.includes('from payment.intenttender'))
        return result([
          {
            sequence: 1,
            kind,
            reference_id: kind === 'benefit' ? 'account:one' : null,
            amount_minor: 100,
            state: 'held',
          },
        ]);
      if (text.includes("event_type='order.placed'")) return result([{ payload: { order: 'order:one' } }]);
      return result([]);
    }),
  } as unknown as OperationDatabase;
}

function target() {
  return { intent: 'intent:one', order: 'order:one', scope: 'mall:one', mall: 'mall:one', member: 'member:one', amountMinor: 100, currency: 'CNY' };
}

function result(rows: object[]): QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult;
}
