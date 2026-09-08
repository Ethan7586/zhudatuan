import type { JsonObject } from '@shop/contract';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ChannelFailure } from '../../domain/model/Failure';
import type { ChannelWebhookEvent, ChannelWebhookState } from '../../public/ChannelWebhookEvent';

export interface ChannelWebhookReceipt {
  readonly id: string;
  readonly connection: string;
  readonly provider: string;
  readonly scope: string;
  readonly external: string;
  readonly attempts: number;
  readonly ciphertext: string;
  readonly keyVersion: string;
  readonly rawHash: string;
  readonly signatureHash: string;
  readonly trace: string;
  readonly receivedAt: string;
  readonly version: number;
}

export interface StandardChannelWebhook {
  readonly eventType: string;
  readonly reference: string | null;
  readonly kind: string;
  readonly state: ChannelWebhookState;
  readonly normalized: JsonObject;
}

export type ChannelWebhookOutcome = Readonly<{ status: 'applied'; event: ChannelWebhookEvent }> | Readonly<{ status: 'duplicate' | 'stale' }> | Readonly<{ status: 'deadlettered'; error: 'CHANNEL_WEBHOOK_MAPPING_MISSING' }>;

export interface ChannelWebhookRepository {
  claim(context: WriteTransactionContext, receipt: string, scope: string): Promise<ChannelWebhookReceipt | null>;
  apply(context: WriteTransactionContext, receipt: ChannelWebhookReceipt, webhook: StandardChannelWebhook): Promise<ChannelWebhookOutcome>;
  fail(context: WriteTransactionContext, receipt: string, scope: string, failure: ChannelFailure): Promise<void>;
}
