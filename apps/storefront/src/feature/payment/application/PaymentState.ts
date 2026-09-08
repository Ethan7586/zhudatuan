import type { Payment } from '../model/Payment';

export function paymentPollingDelay(payment: Payment | undefined): number | false {
  if (!payment || payment.state === 'captured' || payment.state === 'failed' || payment.state === 'expired') return false;
  return Math.max(1, payment.retryAfter) * 1000;
}

export function paymentActionMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '';
  if (message === 'PAYMENT_CANCELLED') return '您已取消本次唤起，订单不会被重复扣款，可稍后继续支付。';
  if (message === 'PAYMENT_CLIENT_UNAVAILABLE') return '当前环境无法唤起微信支付，请在微信内打开或从订单页重新进入。';
  return '支付组件未能完成唤起。系统将继续核验服务端支付状态，请勿重复提交。';
}
