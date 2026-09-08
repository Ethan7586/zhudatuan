import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ExpireOwnershipTransfer } from '../../application/process/ExpireOwnershipTransfer';
import { PgAccessGovernanceRepository } from '../../infrastructure/persistence/PgAccessGovernanceRepository';
import { OwnershipExpiryJob } from './OwnershipExpiryJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  return Object.freeze([{ id: 'ownershipexpiry', processor: new OwnershipExpiryJob(new ExpireOwnershipTransfer(transactions, new PgAccessGovernanceRepository())) }]);
}
