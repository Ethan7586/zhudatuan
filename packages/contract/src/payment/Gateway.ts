export type PaymentScene = 'miniapp' | 'jsapi';

export type ProviderPaymentState = 'absent' | 'pending' | 'succeeded' | 'failed' | 'closed' | 'refunded';

export interface PaymentApplication {
  readonly scene: PaymentScene;
  readonly applicationHash: string;
}

export type PaymentGatewayCapability = 'prepay' | 'query' | 'close' | 'refund' | 'webhook';

export interface PaymentGatewayManifest {
  readonly id: string;
  readonly version: string;
  readonly contractVersion: string;
  readonly scenes: readonly PaymentScene[];
  readonly capabilities: readonly PaymentGatewayCapability[];
  readonly configSchema: string;
  readonly secretRefs: readonly string[];
  readonly healthOperation: string;
}

export interface PaymentPrepayInput {
  readonly description: string;
  readonly orderNumber: string;
  readonly amountMinor: number;
  readonly payer: string;
  readonly application: PaymentApplication;
  readonly expiresAt: string;
}

export interface PaymentExecutionContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export interface PaymentGateway {
  readonly manifest: PaymentGatewayManifest;
  application(scene: PaymentScene): PaymentApplication;
  prepay(input: PaymentPrepayInput, execution?: PaymentExecutionContext): Promise<Readonly<Record<string, string>>>;
  query(orderNumber: string, application: PaymentApplication, execution?: PaymentExecutionContext): Promise<Readonly<{ state: ProviderPaymentState; transaction?: string; amountMinor: number }>>;
  close(orderNumber: string, application: PaymentApplication, execution?: PaymentExecutionContext): Promise<void>;
  refund(input: Readonly<{ refundNumber: string; transaction: string; refundMinor: number; totalMinor: number; reason: string }>, execution?: PaymentExecutionContext): Promise<Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>>;
  queryRefund(refundNumber: string, execution?: PaymentExecutionContext): Promise<Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>>;
  verifyNotification(headers: Readonly<Record<string, string>>, body: string, execution?: PaymentExecutionContext): Promise<PaymentNotification>;
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
