import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { RunSupportJob } from '../../application/process/RunSupportJob';
import { PgSupportJobRepository } from '../../infrastructure/persistence/PgSupportJobRepository';
import { SupportJob } from './SupportJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const transactions = new PgTransactionManager(context.service(DATABASE_POOL));
  const objects = context.service(OBJECT_STORE);
  const processManager = new RunSupportJob(transactions, new PgSupportJobRepository(), objects);
  return Object.freeze([
    { id: 'supportsla', processor: new SupportJob('supportsla', processManager) },
    { id: 'supportscan', processor: new SupportJob('supportscan', processManager) },
  ]);
}
