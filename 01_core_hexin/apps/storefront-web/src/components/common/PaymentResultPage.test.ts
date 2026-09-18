import { describe, expect, it } from 'vitest';
import { ProductionApiError, type ApiPaymentResult, type ApiPaymentResultState } from '../../services/productionApi';
import { paymentDisplayCopy, paymentDisplayStage, paymentOrderStatusLabel, paymentResultReadFailure, selectPaymentResult } from './PaymentResultPage';
import type { PaymentRecoveryRecord } from '../../services/paymentRecovery';

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

  it('keeps a user cancellation visible until the server returns a final state', () => {
    expect(paymentDisplayStage(paymentSession('cancelled'), paymentResult('pending'))).toBe('cancelled');
    expect(paymentDisplayStage(paymentSession('cancelled'), paymentResult('captured'))).toBe('captured');
  });

  it('never claims an order exists when checkout failed before order creation', () => {
    expect(paymentDisplayCopy('failed', null)).toEqual({
      eyebrow: '订单状态待确认',
      title: '本次结算未完成',
      detail: '尚未确认是否已创建订单，请返回购物车后继续原操作。',
    });
    expect(paymentOrderStatusLabel('failed', null)).toBe('尚未确认订单');
    expect(paymentDisplayCopy('failed', 'order:one').eyebrow).toBe('订单已为你保留');
  });
});

function paymentResult(state: ApiPaymentResultState): ApiPaymentResult {
  return {
    intentId: 'intent:one', orderId: 'order:one', paymentId: 'payment:one', state, paymentState: state,
    amountMinor: 100, currency: 'CNY', action: null, expiresAt: '2026-09-07T12:00:00.000Z', retryAfter: 0,
  };
}

function paymentSession(stage: PaymentRecoveryRecord['stage']): PaymentRecoveryRecord {
  return {
    schema: 'storefront.payment-recovery.v1', scope: 'member:one:mall:one', orderId: 'order:one', paymentId: 'intent:one',
    amountMinor: 100, currency: 'CNY', mallName: '福福网', createdAt: '2026-09-09T05:00:00.000Z', updatedAt: '2026-09-09T05:00:00.000Z',
    idempotencyKey: 'checkout:one', cartFingerprint: 'cart:one', cartItemIds: ['cart:one'], stage, retryCount: 0,
  };
}
