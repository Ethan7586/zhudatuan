import { describe, expect, it } from 'vitest';
import { mapPayment } from './infrastructure/PaymentMapper';

describe('payment mapping', () => {
  it('preserves controlled pending actions without treating them as success', () => {
    const payment = mapPayment({ intentId: 'intent:1', orderId: 'order:1', paymentId: 'intent:1', state: 'pending', action: { nonce: 'one' }, expiresAt: '2026-08-31T00:00:00Z' });
    expect(payment).toMatchObject({ state: 'pending', action: { parameters: { nonce: 'one' } }, retryAfter: null });
  });
});
