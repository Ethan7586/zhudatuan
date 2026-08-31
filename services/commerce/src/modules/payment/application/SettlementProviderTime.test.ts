import type { QueryResult } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

const dependencies = vi.hoisted(() => ({
  benefitConsume: vi.fn(),
  benefitRefund: vi.fn(),
  voucherConsume: vi.fn(),
  voucherRefund: vi.fn(),
  inventoryCommit: vi.fn(),
  marketingCommit: vi.fn(),
  fulfillmentCreate: vi.fn(async () => [] as readonly string[]),
  paymentState: vi.fn(async () => 'unpaid'),
  markPaid: vi.fn(),
  markRefunded: vi.fn(),
}));

vi.mock('../../benefit/BenefitModule', () => ({
  BenefitPort: class {
    consume = dependencies.benefitConsume;
    refund = dependencies.benefitRefund;
  },
}));
vi.mock('../../voucher/VoucherModule', () => ({
  VoucherPort: class {
    consume = dependencies.voucherConsume;
    refund = dependencies.voucherRefund;
  },
}));
vi.mock('../../inventory/InventoryModule', () => ({ inventoryPort: { commit: dependencies.inventoryCommit } }));
vi.mock('../../marketing/MarketingModule', () => ({ marketingPort: { commit: dependencies.marketingCommit } }));
vi.mock('../../fulfillment/FulfillmentModule', () => ({ fulfillmentPort: { create: dependencies.fulfillmentCreate } }));
vi.mock('../../order/OrderModule', () => ({
  orderPort: {
    paymentState: dependencies.paymentState,
    markPaid: dependencies.markPaid,
    markRefunded: dependencies.markRefunded,
  },
}));

import { PaymentSettlement } from './PaymentSettlement';
import { RefundSettlement } from './RefundSettlement';

const monthEnd = '2026-08-31T23:59:59.987654+08:00';

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.fulfillmentCreate.mockResolvedValue([]);
  dependencies.paymentState.mockResolvedValue('unpaid');
});

describe('PaymentSettlement provider accounting time', () => {
  it('uses the sealed provider month-end instant only for a mixed payment financial event', async () => {
    const fixture = paymentDatabase([
      { sequence: 1, kind: 'wechat', reference_id: null, amount_minor: 400, state: 'planned' },
      { sequence: 2, kind: 'voucher', reference_id: 'voucher:one', amount_minor: 600, state: 'held' },
    ]);

    await new PaymentSettlement().capture(fixture.database, settlementTarget(), 'mixed', monthEnd);

    const financial = fixture.calls.find((call) => call.sql.includes('insert into runtime.outbox') && call.values[1] === 'payment.succeeded');
    const order = fixture.calls.find((call) => call.sql.includes('insert into runtime.outbox') && call.values[1] === 'order.paid');
    expect(financial?.values[6]).toBe(monthEnd);
    expect(order?.values[6]).toBeNull();
    expect(dependencies.voucherConsume).toHaveBeenCalledOnce();
  });

  it('keeps an internal-only capture on the transactional clock', async () => {
    const fixture = paymentDatabase([{ sequence: 1, kind: 'benefit', reference_id: 'benefit:one', amount_minor: 1000, state: 'held' }]);

    await new PaymentSettlement().capture(fixture.database, settlementTarget(), 'internal');

    const financial = fixture.calls.find((call) => call.sql.includes('insert into runtime.outbox') && call.values[1] === 'payment.succeeded');
    expect(financial?.values[6]).toBeNull();
    expect(dependencies.benefitConsume).toHaveBeenCalledOnce();
  });

  it('fails closed when an external capture has no valid provider time', async () => {
    const fixture = paymentDatabase([{ sequence: 1, kind: 'wechat', reference_id: null, amount_minor: 1000, state: 'planned' }]);

    await expect(new PaymentSettlement().capture(fixture.database, settlementTarget(), 'wechat')).rejects.toThrow('PAYMENT_CAPTURE_PROVIDER_OCCURRED_AT_REQUIRED');
    await expect(new PaymentSettlement().capture(fixture.database, settlementTarget(), 'wechat', '2026-08-31 23:59:59')).rejects.toThrow('PAYMENT_CAPTURE_PROVIDER_OCCURRED_AT_REQUIRED');
    expect(fixture.query).not.toHaveBeenCalled();
  });

  it('rejects provider time on an internal-only capture', async () => {
    const fixture = paymentDatabase([{ sequence: 1, kind: 'benefit', reference_id: 'benefit:one', amount_minor: 1000, state: 'held' }]);

    await expect(new PaymentSettlement().capture(fixture.database, settlementTarget(), 'internal', monthEnd)).rejects.toThrow('PAYMENT_INTERNAL_CAPTURE_PROVIDER_OCCURRED_AT_FORBIDDEN');
    expect(fixture.query).not.toHaveBeenCalled();
  });
});

describe('RefundSettlement provider accounting time', () => {
  it('uses the immutable provider attempt time for a mixed refund financial event', async () => {
    const fixture = refundDatabase(
      [
        { sequence: 1, kind: 'wechat', reference_id: null, amount_minor: 400 },
        { sequence: 2, kind: 'benefit', reference_id: 'benefit:one', amount_minor: 600 },
      ],
      monthEnd
    );

    await new RefundSettlement().complete(fixture.database, 'refund:one', 'wechat-refund:one');

    const authority = fixture.calls.find((call) => call.sql.includes('from payment.providerattempt attempt'));
    const financial = fixture.calls.find((call) => call.sql.includes('insert into runtime.outbox'));
    expect(authority?.values).toEqual(['refund:one', 'wechat-refund:one', 400, 'CNY']);
    expect(financial?.values[10]).toBe(monthEnd);
    expect(dependencies.benefitRefund).toHaveBeenCalledOnce();
  });

  it('keeps an internal-only refund on the transactional clock', async () => {
    const fixture = refundDatabase([{ sequence: 1, kind: 'benefit', reference_id: 'benefit:one', amount_minor: 1000 }], null);

    await new RefundSettlement().complete(fixture.database, 'refund:one', null);

    expect(fixture.calls.some((call) => call.sql.includes('from payment.providerattempt attempt'))).toBe(false);
    const financial = fixture.calls.find((call) => call.sql.includes('insert into runtime.outbox'));
    expect(financial?.values[10]).toBeNull();
  });

  it.each([
    ['missing seal', 'wechat-refund:one', null],
    ['wrong reference', 'wechat-refund:other', monthEnd],
  ])('fails closed before mutation for an external refund with %s', async (_case, providerReference, occurredAt) => {
    const fixture = refundDatabase([{ sequence: 1, kind: 'wechat', reference_id: null, amount_minor: 1000 }], occurredAt, 'wechat-refund:one');

    await expect(new RefundSettlement().complete(fixture.database, 'refund:one', providerReference)).rejects.toThrow('PAYMENT_REFUND_PROVIDER_EFFECT_REQUIRED');
    expect(fixture.calls.some((call) => call.sql.includes('update payment.payment'))).toBe(false);
  });
});

function settlementTarget() {
  return Object.freeze({
    intent: 'intent:one',
    order: 'order:one',
    scope: 'mall:one',
    mall: 'mall:one',
    member: 'member:one',
    amountMinor: 1000,
    currency: 'CNY',
  });
}

function paymentDatabase(plans: readonly Record<string, unknown>[]) {
  const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
  const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.startsWith('select state from payment.intent')) return rows([{ state: 'created' }]);
    if (sql.startsWith('select id from payment.payment')) return rows([]);
    if (sql.includes('from payment.intenttender')) return rows(plans);
    if (sql.includes("where event_type='order.placed'")) return rows([]);
    return rows([]);
  });
  return { database: { query } as unknown as OperationDatabase, query, calls };
}

function refundDatabase(legs: readonly Record<string, unknown>[], occurredAt: string | null, authoritativeReference = 'wechat-refund:one') {
  const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
  const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.startsWith('select refund.id')) {
      return rows([
        {
          id: 'refund:one',
          payment_id: 'payment:one',
          amount_minor: 1000,
          currency: 'CNY',
          state: 'processing',
          aftersale_id: 'aftersale:one',
          order_id: 'order:one',
          scope_id: 'mall:one',
          mall_id: 'mall:one',
          member_id: 'member:one',
        },
      ]);
    }
    if (sql.includes('from payment.refundtender')) return rows(legs);
    if (sql.includes('from payment.providerattempt attempt')) {
      return values[1] === authoritativeReference && occurredAt !== null ? rows([{ occurred_at: occurredAt }]) : rows([]);
    }
    if (sql.includes('update payment.payment')) return rows([{ refunded_minor: 1000, captured_minor: 1000 }]);
    return rows([]);
  });
  return { database: { query } as unknown as OperationDatabase, query, calls };
}

function rows(values: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows: [...values], rowCount: values.length } as unknown as QueryResult<Record<string, unknown>>;
}
