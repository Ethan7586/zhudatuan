import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CartExperiencePort } from '../../public/CartExperiencePort';
export class PgCartExperiencePort implements CartExperiencePort {
  private readonly transactions = new PgTransactionAccess();
  async active(context: ReadTransactionContext, scope: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
    }>(
      `select application.id from experience.application application
      join experience.release release on release.application_id=application.id and release.state='active' and release.effective_at<=clock_timestamp()
      join experience.publication publication on publication.release_id=release.id and publication.state='active'
      join experience.version version on version.id=release.version_id and version.validation_state='valid' and version.frozen_at is not null
      where application.mall_id=$1 and application.status='active'
      order by application.is_primary desc,release.effective_at desc,application.id limit 1`,
      [scope]
    );
    return result.rows[0]?.id ?? null;
  }
}
