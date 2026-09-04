import type { PaymentScene } from '../../public';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type VerifiedPaymentWebhook =
  | Readonly<{
      kind: 'payment';
      id: string;
      providerReference: string;
      amountMinor: number;
      currency: 'CNY';
      payerHash: string;
      application: Readonly<{ scene: PaymentScene; applicationHash: string }>;
      evidence: object;
    }>
  | Readonly<{
      kind: 'refund';
      id: string;
      providerReference: string;
      amountMinor: number;
      totalMinor: number;
      evidence: object;
    }>;

export interface WebhookInboxRepository {
  accept(context: WriteTransactionContext, input: Readonly<{ notification: VerifiedPaymentWebhook; raw: string; rawHash: string; headers: Readonly<Record<string, string>>; trace: string }>): Promise<Readonly<{ replayed: boolean }>>;
}
