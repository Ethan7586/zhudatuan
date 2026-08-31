import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { IdentityRetentionPort } from '../public/IdentityRetentionPort';

export class PgIdentityRetention implements IdentityRetentionPort {
  async purge(database: OperationDatabase): Promise<void> {
    await database.query(`delete from identity.challenge where expires_at<clock_timestamp()-interval '7 days'`);
    await database.query(`delete from identity.session where expires_at<clock_timestamp()-interval '30 days'`);
  }
}
