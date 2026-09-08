import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { NavigationProjectionRepository } from '../../application/port/NavigationProjectionRepository';
import type { NavigationProjector } from '../../application/service/NavigationProjector';
export class PgNavigationProjectionRepository implements NavigationProjectionRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly projector: NavigationProjector
  ) {}
  project(context: ReadTransactionContext, access: Parameters<NavigationProjectionRepository['project']>[1], scope: string, signal?: AbortSignal) {
    const database = this.transactions.database(context);
    return this.projector.project(context, access, scope, signal);
  }
}
