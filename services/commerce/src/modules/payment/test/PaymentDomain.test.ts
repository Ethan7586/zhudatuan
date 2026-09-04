import { describe, expect, it } from 'vitest';
import { Allocation } from '../domain/model/Allocation';
import { PaymentAttempt } from '../domain/model/PaymentAttempt';
import { PaymentIntent } from '../domain/model/PaymentIntent';
import { Refund } from '../domain/model/Refund';

const NOW = new Date('2026-09-05T00:00:00.000Z');

describe('payment aggregates', () => {
  it('keeps terminal payment intents monotonic and rejects expired continuation', () => {
    const intent = PaymentIntent.create({ id: 'intent:one', order: 'order:one', scope: 'mall:one', mall: 'mall:one', member: 'member:one',
      currency: 'CNY', amountMinor: 100, idempotency: 'request:one', providerReference: 'P202609050001', expiresAt: new Date(NOW.getTime() + 60_000) });
    const captured = intent.transition('preparing', NOW).transition('pending', NOW).transition('captured', NOW);
    expect(() => captured.transition('preparing', NOW)).toThrow('PAYMENT_INTENT_CONFLICT');
    expect(() => intent.transition('preparing', new Date(NOW.getTime() + 60_000))).toThrow('PAYMENT_INTENT_NOT_PAYABLE');
    const failed = intent.transition('failed', NOW);
    expect(() => failed.transition('preparing', NOW)).toThrow('PAYMENT_INTENT_CONFLICT');
    expect(failed.retry('request:two', new Date(NOW.getTime() + 120_000), NOW).snapshot()).toMatchObject({ state: 'preparing', idempotency: 'request:two', version: 2 });
  });

  it('requires allocations to conserve every minor unit and bind references by tender kind', () => {
    expect(new Allocation([{ sequence: 1, kind: 'wechat', reference: null, amountMinor: 60 }, { sequence: 2, kind: 'benefit', reference: 'account:one', amountMinor: 40 }], 100).totalMinor).toBe(100);
    expect(() => new Allocation([{ sequence: 1, kind: 'wechat', reference: null, amountMinor: 99 }], 100)).toThrow('PAYMENT_ALLOCATION_UNBALANCED');
    expect(() => new Allocation([{ sequence: 1, kind: 'voucher', reference: null, amountMinor: 100 }], 100)).toThrow('PAYMENT_ALLOCATION_UNBALANCED');
  });

  it('keeps refund and provider attempt terminal states final', () => {
    const refund = new Refund({ id: 'refund:one', payment: 'payment:one', amountMinor: 100, currency: 'CNY', state: 'requested', reason: '订单取消', version: 0 }).transition('succeeded');
    expect(() => refund.transition('processing')).toThrow('PAYMENT_INTENT_CONFLICT');
    expect(new Refund({ id: 'refund:retry', payment: 'payment:one', amountMinor: 100, currency: 'CNY', state: 'failed', reason: '渠道超时', version: 2 }).retry().value).toMatchObject({ state: 'requested', version: 3 });
    expect(() => new PaymentAttempt({ id: 'attempt:one', intent: 'intent:one', provider: 'wechat', scene: 'miniapp', applicationHash: 'a'.repeat(64),
      state: 'succeeded', externalTransaction: null, requestedAt: NOW, completedAt: NOW })).toThrow('PAYMENT_INTENT_CONFLICT');
  });
});
