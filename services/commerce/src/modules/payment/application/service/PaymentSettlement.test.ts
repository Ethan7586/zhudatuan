import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { InventoryPort } from '../../../inventory/infrastructure/persistence/InventoryPort';
import type { MarketingReservePort } from '../../../marketing/public';
import type { OrderPort } from '../../../order/infrastructure/persistence/OrderPort';
import { PaymentSettlement } from '../../infrastructure/persistence/PaymentSettlement';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

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
    } as unknown as MarketingReservePort;
    const orders = {
      paymentState: vi.fn(async () => 'unpaid'),
      markPaid: vi.fn(async () => {
        events.push('order-paid');
      }),
      recordPayment: vi.fn(async () => {
        events.push('order-payment-read');
      }),
    } as unknown as OrderPort;
    const query = databaseWithTender('benefit');
    const settlement = new PaymentSettlement(benefit, voucher, inventory, marketing, orders);
    let transaction: WriteTransactionContext | undefined;
    await expect(
      withWriteTransaction(query, (context) => {
        transaction = context;
        return settlement.capture(context, target(), 'internal');
      })
    ).resolves.toBe('payment:intent:one');
    expect(benefit.consume).toHaveBeenCalledWith(transaction, 'order:one', 'account:one', 100);
    expect(voucher.consume).not.toHaveBeenCalled();
    expect(events).toEqual(['benefit', 'inventory', 'marketing', 'order-paid', 'order-payment-read']);
  });

  it('requires explicit dependencies and rejects external tender capture before side effects', async () => {
    const benefit = { consume: vi.fn() };
    const voucher = { consume: vi.fn() };
    const inventory = { commit: vi.fn() } as unknown as InventoryPort;
    const marketing = { commit: vi.fn() } as unknown as MarketingReservePort;
    const orders = { paymentState: vi.fn(async () => 'unpaid'), markPaid: vi.fn(), recordPayment: vi.fn() } as unknown as OrderPort;
    const settlement = new PaymentSettlement(benefit, voucher, inventory, marketing, orders);
    await expect(withWriteTransaction(databaseWithTender('wechat'), (context) => settlement.capture(context, target(), 'internal'))).rejects.toThrow('PAYMENT_EXTERNAL_TENDER_NOT_CAPTURED');
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
  });
});

function databaseWithTender(kind: 'benefit' | 'wechat') {
  return vi.fn(async (text: string) => {
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
  });
}

function target() {
  return { intent: 'intent:one', order: 'order:one', scope: 'mall:one', mall: 'mall:one', member: 'member:one', amountMinor: 100, currency: 'CNY' };
}
