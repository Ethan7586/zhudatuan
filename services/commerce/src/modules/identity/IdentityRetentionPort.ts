import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export class IdentityRetentionPort {
  async purge(database: OperationDatabase): Promise<void> {
    await database.query('select identity.purge_expired_job_records()');
  }
}

export const identityRetentionPort = new IdentityRetentionPort();
