import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CheckoutExperienceRelease, CheckoutExperiencePort } from '../../public/CheckoutExperiencePort';
export class PgCheckoutExperiencePort implements CheckoutExperiencePort {
  private readonly transactions = new PgTransactionAccess();
  async published(context: ReadTransactionContext, application: string): Promise<CheckoutExperienceRelease | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      version: string;
      hash: string;
    }>(
      `select publication.version_id version,publication.content_hash hash from experience.publication publication
      join experience.release release on release.id=publication.release_id and release.state='active'
      join experience.version version on version.id=publication.version_id and version.validation_state='valid' and version.frozen_at is not null
      where publication.application_id=$1 and publication.state='active' order by publication.published_at desc,publication.release_id limit 1`,
      [application]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
