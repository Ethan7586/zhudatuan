import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderExpiryRepository } from '../../application/port/OrderExpiryRepository';

export class PgOrderExpiryRepository implements OrderExpiryRepository {
  private readonly transactions = new PgTransactionAccess();

  async claim(context: WriteTransactionContext, id: string, scope: string): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `insert into checkout.expiryreceipt(id,scope_id,completed_at) values($1,$2,clock_timestamp()) on conflict(id) do nothing returning id`,
      [id, scope]
    );
    return result.rows.length === 1;
  }

  schedulePaymentQuery(context: WriteTransactionContext, intent: string, scope: string): Promise<void> {
    return new PgRuntimeWriter(this.transactions.database(context)).reschedule({
      id: `job:expiry:${intent}`,
      kind: 'paymentquery',
      owner: 'payment',
      scope,
      payload: { intent },
      priority: 1,
    });
  }

  recordCancellation(context: WriteTransactionContext, order: string, scope: string, trace: string): Promise<void> {
    return new PgRuntimeWriter(this.transactions.database(context)).append({
      id: `event:${randomUUID()}`,
      type: 'order.cancelled',
      aggregateType: 'order',
      aggregate: order,
      scope,
      payload: { order, reason: 'paymenttimeout' },
      trace: `orderexpiry:${trace}`,
    });
  }
}
