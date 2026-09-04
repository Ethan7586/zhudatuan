import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgRiskRepository } from './PgRiskRepository';

export class PgRiskRepositoryFactory {
  private readonly transactions = new PgTransactionAccess();

  create(context: WriteTransactionContext): PgRiskRepository {
    return new PgRiskRepository(this.transactions.database(context));
  }
}
