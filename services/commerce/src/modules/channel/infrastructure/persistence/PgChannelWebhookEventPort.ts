import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ChannelWebhookEventPort } from '../../application/port/ChannelWebhookEventPort';
import type { ChannelWebhookEvent } from '../../public/ChannelWebhookEvent';

export class PgChannelWebhookEventPort implements ChannelWebhookEventPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  publish(context: WriteTransactionContext, event: ChannelWebhookEvent, trace: string): Promise<void> {
    const type = event.kind === 'refund' ? 'channel.refund.changed' as const : 'channel.webhook.applied' as const;
    const payload = parseEventPayload(type, event);
    return new PgRuntimeWriter(this.transactions.database(context)).append({
      id: `event:channel:webhook:${event.webhook}`,
      type,
      aggregateType: 'webhook',
      aggregate: event.webhook,
      scope: context.scope,
      payload,
      trace,
    });
  }
}
import { parseEventPayload } from '@shop/contract';
