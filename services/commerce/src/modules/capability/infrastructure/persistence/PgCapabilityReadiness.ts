import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CapabilityReadinessPort } from '../../public/ReadinessPort';
export class PgCapabilityReadiness implements CapabilityReadinessPort {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async operationCount(context: ReadTransactionContext): Promise<number> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      count: number;
    }>('select count(*)::integer count from capability.operation');
    return result.rows[0]?.count ?? 0;
  }
}
