import { describe, expect, it } from 'vitest';
import { ProductionApiError, type ApiPaymentResult, type ApiPaymentResultState } from '../../services/productionApi';
import { paymentResultReadFailure, selectPaymentResult } from './PaymentResultPage';

describe('payment result polling', () => {
  it('treats a short-lived missing result as background synchronization', () => {
    expect(paymentResultReadFailure(new ProductionApiError('NOT_FOUND', 404, 'NOT_FOUND'))).toEqual({
      message: null,
      retryAfterMs: 1_000,
    });
  });

  it('keeps retrying automatically after a network interruption with Chinese copy', () => {
    expect(paymentResultReadFailure(new ProductionApiError('网络连接已中断，恢复后将自动重试', 0, 'NETWORK_OR_CLIENT_ERROR'))).toEqual({
      message: '网络连接已中断，恢复后将自动重试',
      retryAfterMs: 1_000,
    });
  });

  it('does not let a confirmed payment state move backwards', () => {
    const captured = paymentResult('captured');
    expect(selectPaymentResult(captured, paymentResult('pending'))).toBe(captured);
    const recovery = paymentResult('recovery');
    expect(selectPaymentResult(recovery, paymentResult('pending'))).toBe(recovery);
  });
});

function paymentResult(state: ApiPaymentResultState): ApiPaymentResult {
  return {
    intentId: 'intent:one', orderId: 'order:one', paymentId: 'payment:one', state, paymentState: state,
    amountMinor: 100, currency: 'CNY', action: null, expiresAt: '2026-09-07T12:00:00.000Z', retryAfter: 0,
  };
}
