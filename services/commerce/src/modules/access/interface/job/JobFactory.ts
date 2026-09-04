import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ExpireOwnershipTransfer } from '../../application/process/ExpireOwnershipTransfer';
import { PgAccessGovernanceRepository } from '../../infrastructure/persistence/PgAccessGovernanceRepository';
import { OwnershipExpiryJob } from './OwnershipExpiryJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  return Object.freeze([{ id: 'ownershipexpiry', processor: new OwnershipExpiryJob(new ExpireOwnershipTransfer(transactions, new PgAccessGovernanceRepository())) }]);
}
