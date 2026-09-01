import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { IdentityEventRepository } from '../../application/port/IdentityEventRepository';
export class PgIdentityEvent implements IdentityEventRepository {
  private readonly transactions = new PgTransactionAccess();
  async publish(
    context: ReadTransactionContext,
    type: string,
    aggregateType: 'invitation' | 'session' | 'challenge' | 'membership' | 'linkcase' | 'principal',
    aggregate: string,
    scope: string,
    trace: string,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await new PgRuntimeWriter(database).append({ id: `event:${randomUUID()}`, type, aggregateType, aggregate, scope, payload, trace });
  }
}
