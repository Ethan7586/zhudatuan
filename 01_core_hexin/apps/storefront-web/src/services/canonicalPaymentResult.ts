import { canonicalCall, canonicalClient, sessionContext } from './canonicalApiClient';
import { asDate, invalid, nonNegativeInteger, optionalText, record, text } from './canonicalShape';
import type { ApiPaymentResult, ApiPaymentResultState } from './productionApi.types';

const PAYMENT_RESULT_STATES = Object.freeze([
  'preparing',
  'pending',
  'recovery',
  'captured',
  'failed',
  'expired',
] as const satisfies readonly ApiPaymentResultState[]);

export async function readCanonicalPaymentResult(paymentId: string): Promise<ApiPaymentResult> {
  const value = await canonicalCall(() => canonicalClient().payment.intentsRead({
    path: { paymentid: paymentId },
  }, sessionContext()));
  return mapCanonicalPaymentResult(value);
}

export function mapCanonicalPaymentResult(value: unknown): ApiPaymentResult {
  const source = record(value, 'payment.result');
  const stateValue = text(source.state, 'payment.result.state');
  if (!PAYMENT_RESULT_STATES.includes(stateValue as ApiPaymentResultState)) invalid('payment.result.state');
  const retryAfter = nonNegativeInteger(source.retryAfter, 'payment.result.retryAfter');
  if (retryAfter !== 0 && retryAfter !== 5) invalid('payment.result.retryAfter');
  return Object.freeze({
    intentId: text(source.intentId, 'payment.result.intentId'),
    orderId: text(source.orderId, 'payment.result.orderId'),
    paymentId: text(source.paymentId, 'payment.result.paymentId'),
    state: stateValue as ApiPaymentResultState,
    paymentState: optionalText(source.paymentState),
    amountMinor: nonNegativeInteger(source.amountMinor, 'payment.result.amountMinor'),
    currency: text(source.currency, 'payment.result.currency'),
    action: paymentAction(source.action),
    expiresAt: asDate(source.expiresAt),
    retryAfter: retryAfter as 0 | 5,
  });
}

function paymentAction(value: unknown): Readonly<Record<string, string>> | null {
  if (value === null || value === undefined) return null;
  const source = record(value, 'payment.result.action');
  if (Object.values(source).some((item) => typeof item !== 'string')) invalid('payment.result.action');
  return Object.freeze(source as Record<string, string>);
}
