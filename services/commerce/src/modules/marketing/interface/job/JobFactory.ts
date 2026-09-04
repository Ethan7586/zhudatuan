import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
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
