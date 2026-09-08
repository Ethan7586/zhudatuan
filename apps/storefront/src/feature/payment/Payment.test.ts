import { describe, expect, it } from 'vitest';
import { mapPayment } from './infrastructure/PaymentMapper';
import { paymentActionMessage, paymentPollingDelay } from './application/PaymentState';

describe('payment mapping', () => {
  it('preserves controlled pending actions without treating them as success', () => {
    const payment = mapPayment({ intentId: 'intent:1', orderId: 'order:1', paymentId: 'intent:1', state: 'pending', action: { nonce: 'one' }, expiresAt: '2026-08-31T00:00:00Z', retryAfter: 5 });
    expect(payment).toMatchObject({ state: 'pending', action: { parameters: { nonce: 'one' } }, retryAfter: 5 });
    expect(paymentPollingDelay(payment)).toBe(5000);
  });

  it('stops polling only after an authoritative terminal response and explains client cancellation', () => {
    const captured = mapPayment({ intentId: 'intent:1', orderId: 'order:1', paymentId: 'payment:1', state: 'captured', action: null, expiresAt: '2026-08-31T00:00:00Z', retryAfter: 0 });
    expect(paymentPollingDelay(captured)).toBe(false);
    expect(paymentActionMessage(new Error('PAYMENT_CANCELLED'))).toContain('取消');
  });

  it('keeps delayed payment in recovery until the server reports a terminal state', () => {
    const recovering = mapPayment({ intentId: 'intent:late', orderId: 'order:late', paymentId: 'payment:late', state: 'recovery', action: null, expiresAt: '2026-08-31T00:00:00Z', retryAfter: 2 });

    expect(paymentPollingDelay(recovering)).toBe(2000);
    expect(paymentActionMessage(new Error('PAYMENT_CLIENT_UNAVAILABLE'))).toContain('订单页重新进入');
  });
});
