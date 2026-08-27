import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export class IdentityRetentionPort {
  async purge(database: OperationDatabase): Promise<void> {
<<<<<<< HEAD
    await database.query('select identity.purge_expired_job_records()');
=======
    await database.query(`delete from identity.challenge where expires_at<clock_timestamp()-interval '7 days'`);
    await database.query(`delete from identity.session where expires_at<clock_timestamp()-interval '30 days'`);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }
}

export const identityRetentionPort = new IdentityRetentionPort();
