import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CheckoutExperienceRelease, CheckoutExperiencePort } from '../../public/CheckoutExperiencePort';
export class PgCheckoutExperiencePort implements CheckoutExperiencePort {
  private readonly transactions = new PgTransactionAccess();
  async published(context: ReadTransactionContext, application: string): Promise<CheckoutExperienceRelease | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      version: string;
      hash: string;
    }>(
      `select version_id version,content_hash hash from experience.publication
      where application_id=$1 and state='active' order by published_at desc,release_id limit 1`,
      [application]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
