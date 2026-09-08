import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ChannelWebhookEvent } from '../../public/ChannelWebhookEvent';

export interface ChannelWebhookEventPort {
  publish(context: WriteTransactionContext, event: ChannelWebhookEvent, trace: string): Promise<void>;
}
