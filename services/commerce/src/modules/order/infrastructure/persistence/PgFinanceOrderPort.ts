import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { FinanceOrderPort } from '../../public';

export class PgFinanceOrderPort implements FinanceOrderPort {
  private readonly transactions = new PgTransactionAccess();

  async verified(context: ReadTransactionContext, orders: readonly string[]): Promise<readonly string[]> {
    if (orders.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{ id: string }>(`select id from ordering.orderrecord where id=any($1::text[]) and verification_state='verified' order by id`, [orders]);
    return Object.freeze(result.rows.map(({ id }) => id));
  }
}
