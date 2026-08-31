import { token } from '../../../../bootstrap/Container';
import type { ProviderPaymentState } from '../../domain/policy/PaymentLifecycle';
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

export interface PaymentGateway {
  application(scene: WechatScene): PaymentApplication;
  prepay(input: PrepayInput): Promise<Readonly<Record<string, string>>>;
  query(orderNumber: string, application: PaymentApplication): Promise<Readonly<{ state: ProviderPaymentState; transaction?: string; amountMinor: number }>>;
  close(orderNumber: string, application: PaymentApplication): Promise<void>;
  refund(input: Readonly<{ refundNumber: string; transaction: string; refundMinor: number; totalMinor: number; reason: string }>): Promise<Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>>;
  queryRefund(refundNumber: string): Promise<Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>>;
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
