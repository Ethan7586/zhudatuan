import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AuthorizationRepository } from '../../application/port/AuthorizationRepository';
import type { AuthorizationSnapshot, AuthorizationPort } from '../../public/AuthorizationPort';
export class PgAuthorizationPort implements AuthorizationPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly repository: AuthorizationRepository) {}
  read(
    context: ReadTransactionContext,
    input: Readonly<{
      membership: string;
      target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
      operation: string;
      resource: string | null;
    }>
  ): Promise<AuthorizationSnapshot | null> {
    const database = this.transactions.database(context);
    return this.repository.snapshot(context, input);
  }
}
