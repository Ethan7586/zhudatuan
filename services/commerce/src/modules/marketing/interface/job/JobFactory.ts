import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ExpireMarketingBudget } from '../../application/process/ExpireMarketingBudget';
import { PgMarketingReservePort } from '../../infrastructure/persistence/PgMarketingReservePort';
import { MarketingBudgetExpiryJob } from './MarketingBudgetExpiryJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const reserve = new PgMarketingReservePort();
  return Object.freeze([
    {
      id: 'marketingbudgetexpiry',
      processor: new MarketingBudgetExpiryJob(new ExpireMarketingBudget(new PgTransactionManager(context.service(DATABASE_POOL)), reserve)),
    },
  ]);
}
