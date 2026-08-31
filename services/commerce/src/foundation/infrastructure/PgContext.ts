import type { Transaction, TransactionContext } from '../persistence/UnitOfWork';
import { applyApiDatabaseContext, applyJobDatabaseContext } from './DatabaseContext';

export class PgContext {
  apply(transaction: Transaction, context: TransactionContext): Promise<unknown> {
    if (context.workload === 'worker') return applyJobDatabaseContext(transaction, context.scope);
    return applyApiDatabaseContext(transaction, context);
  }
}
