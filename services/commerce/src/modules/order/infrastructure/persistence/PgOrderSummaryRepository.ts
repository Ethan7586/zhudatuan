import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderSummaryRepository } from '../../application/port/OrderSummaryRepository';
import type { OrderSummary } from '../../application/service/GetOrderSummary';

export class PgOrderSummaryRepository implements OrderSummaryRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async find(context: ReadTransactionContext, order: string, scopes: readonly string[], member: string, memberOnly: boolean): Promise<OrderSummary | null> {
    const result = await this.transactions.database(context).query<{ id: string; scope_id: string; member_id: string; order_number: string; lifecycle_state: string; total_minor: number }>(
      `select target.id,target.scope_id,target.member_id,target.order_number,
      target.lifecycle_state,target.total_minor::float8 total_minor from ordering.orderrecord target where target.id=$1 and
      (($4=false and target.scope_id=any($2::text[])) or target.member_id=$3)`,
      [order, scopes, member, memberOnly]
    );
    const found = result.rows[0];
    return found ? { id: found.id, scope: found.scope_id, member: found.member_id, number: found.order_number, state: found.lifecycle_state, totalMinor: found.total_minor } : null;
  }
}
