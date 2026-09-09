import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { IdentityExperiencePort } from '../../public/IdentityExperiencePort';

export class PgIdentityExperiencePort implements IdentityExperiencePort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async storefront(context: ReadTransactionContext, organization: string): Promise<Readonly<{ handle: string }> | null> {
    const result = await this.transactions.database(context).query<{ handle: string }>(`select handle from experience.identity_storefront($1)`, [organization]);
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
