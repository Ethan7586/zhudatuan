import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { OrderReadPort } from '../../../order/public';
import type { VerifiedPaymentWebhook } from '../../application/port/WebhookInboxRepository';
import type { WebhookScopeReader } from '../../application/port/WebhookScopeReader';

export class PgWebhookScopeReader implements WebhookScopeReader {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly manager: TransactionManager,
    private readonly orders: Pick<OrderReadPort, 'resolveScope'>
  ) {}

  async resolve(notification: VerifiedPaymentWebhook, signal: AbortSignal, deadline: number): Promise<string> {
    const order = await this.manager.read(
      {
        tenant: '',
        membership: '',
        scope: 'public:payment:webhook',
        actor: 'provider:wechat',
        trace: `webhook:${notification.id}`,
        operation: 'payment.webhooks.wechat.scope',
        signal,
        deadline,
      },
      async (context) => {
        const database = this.transactions.database(context);
        const result =
          notification.kind === 'payment'
            ? await database.query<{ order_id: string }>('select order_id from payment.intent where provider_reference=$1', [notification.providerReference])
            : await database.query<{ order_id: string }>(
                `select intent.order_id from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
                 join payment.intent intent on intent.id=payment.intent_id where refund.provider_reference=$1`,
                [notification.providerReference]
              );
        return result.rows[0]?.order_id ?? null;
      }
    );
    if (!order) throw new Error('PAYMENT_WEBHOOK_TARGET_NOT_FOUND');
    const scope = await this.orders.resolveScope(order, signal, deadline);
    if (!scope) throw new Error('PAYMENT_WEBHOOK_TARGET_NOT_FOUND');
    return scope;
  }
}
