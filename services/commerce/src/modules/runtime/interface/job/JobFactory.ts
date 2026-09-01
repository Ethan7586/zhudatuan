import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { RUNTIME_CHECKOUT_PORT } from '../../../checkout/public';
import { RUNTIME_IDENTITY_PORT } from '../../../identity/public';
import { RUNTIME_PRICING_PORT } from '../../../pricing/public';
import { CleanupRuntime } from '../../application/process/CleanupRuntime';
import { PgCleanupRepository } from '../../infrastructure/persistence/PgCleanupRepository';
import { RuntimeCleanupJob } from './RuntimeCleanupJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const cleanup = new CleanupRuntime(new PgTransactionManager(context.service(DATABASE_POOL)), new PgCleanupRepository(), {
    identity: context.ports.get(RUNTIME_IDENTITY_PORT),
    checkout: context.ports.get(RUNTIME_CHECKOUT_PORT),
    pricing: context.ports.get(RUNTIME_PRICING_PORT),
  });
  return Object.freeze([
    {
      id: 'cleanup',
      processor: new RuntimeCleanupJob(cleanup),
    },
  ]);
}
