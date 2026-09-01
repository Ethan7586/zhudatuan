import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { PaymentWebhookScopeReader } from '../../application/port/PaymentWebhookScopeReader';

export class PgPaymentWebhookScopeReader implements PaymentWebhookScopeReader {
  private readonly access = new PgTransactionAccess();

  constructor(private readonly transactions: TransactionManager) {}

  resolve(order: string, signal: AbortSignal, deadline: number): Promise<string | null> {
    return this.transactions.read(
      {
        tenant: '',
        membership: '',
        scope: 'public:ordering:webhook',
        actor: 'provider:wechat',
        trace: `webhookscope:${order}`,
        operation: 'order.paymentwebhook.scope',
        signal,
        deadline,
      },
      async (context) => {
        const result = await this.access.database(context).query<{ scope: string | null }>('select ordering.payment_webhook_scope($1::text) scope', [order]);
        return result.rows[0]?.scope ?? null;
      }
    );
  }
}
