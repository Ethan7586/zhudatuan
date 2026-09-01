import type { IdentityPrincipal } from '../../public/IdentityPrincipalPort';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';

export class PgIdentityPrincipal implements IdentityPrincipal {
  private readonly transactions = new PgTransactionAccess();

  async ensurePending(context: Parameters<IdentityPrincipal['ensurePending']>[0], principal: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into identity.principal(id,status,created_at,updated_at)
      values($1,'pending',clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [principal]
    );
  }
}
