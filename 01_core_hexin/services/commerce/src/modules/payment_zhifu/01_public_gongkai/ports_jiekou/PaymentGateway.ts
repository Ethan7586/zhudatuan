import { token } from '../../../../bootstrap/Container';
import type { ProviderPaymentState } from '../../02_domain_yewu/policies_guize/PaymentLifecycle';
import type { WechatScene } from '@shop/config/server';

export interface PaymentApplication {
  readonly scene: WechatScene;
  readonly applicationHash: string;
}

export interface PrepayInput {
  readonly description: string;
  readonly orderNumber: string;
  readonly amountMinor: number;
  readonly payer: string;
  readonly application: PaymentApplication;
  readonly expiresAt: string;
}

export type ProviderReceiptEvidence = Readonly<Record<string, unknown>>;

export interface ProviderPaymentObservation {
  readonly state: ProviderPaymentState;
  readonly transaction?: string;
  readonly amountMinor: number;
  readonly occurredAt?: string;
  readonly evidence: ProviderReceiptEvidence;
}

export interface ProviderRefundObservation {
  readonly state: 'processing' | 'succeeded' | 'failed';
  readonly reference: string;
  readonly occurredAt?: string;
  readonly evidence: ProviderReceiptEvidence;
}

export interface PaymentGateway {
  application(scene: WechatScene): PaymentApplication;
  prepay(input: PrepayInput): Promise<Readonly<Record<string, string>>>;
  query(orderNumber: string, application: PaymentApplication): Promise<Readonly<ProviderPaymentObservation>>;
  close(orderNumber: string, application: PaymentApplication): Promise<void>;
  refund(input: Readonly<{ refundNumber: string; transaction: string; refundMinor: number; totalMinor: number; reason: string }>): Promise<Readonly<ProviderRefundObservation>>;
  queryRefund(refundNumber: string): Promise<Readonly<ProviderRefundObservation>>;
  verifyNotification(headers: Readonly<Record<string, string>>, body: string): Promise<PaymentNotification>;
}

export type PaymentNotification =
  | Readonly<{
      kind: 'payment';
      id: string;
      providerReference: string;
      transaction: string;
      amountMinor: number;
      currency: 'CNY';
      payerHash: string;
      application: PaymentApplication;
      occurredAt: string;
      evidence: object;
    }>
  | Readonly<{
      kind: 'refund';
      id: string;
      providerReference: string;
      transaction: string;
      amountMinor: number;
      totalMinor: number;
      state: 'succeeded' | 'failed';
      occurredAt: string;
      evidence: object;
    }>;

export const PAYMENT_GATEWAY = token<PaymentGateway>('payment.gateway');

/** Strict RFC 3339 validation for an authoritative provider accounting instant. */
export function providerOccurredAt(value: unknown, code = 'PAYMENT_PROVIDER_OCCURRED_AT_INVALID'): string {
  if (typeof value !== 'string') throw new Error(code);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) throw new Error(code);
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [match[1], match[2], match[3], match[4], match[5], match[6], match[7] ?? '00', match[8] ?? '00'].map(Number);
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  if (
    year! < 2000 ||
    month! < 1 ||
    month! > 12 ||
    day! < 1 ||
    day! > days ||
    hour! > 23 ||
    minute! > 59 ||
    second! > 59 ||
    offsetHour! > 14 ||
    (offsetHour === 14 && offsetMinute !== 0) ||
    offsetMinute! > 59 ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error(code);
  return value;
}
