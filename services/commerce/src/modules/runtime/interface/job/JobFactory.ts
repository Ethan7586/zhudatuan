import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { RUNTIME_CHECKOUT_PORT } from '../../../checkout/public';
import { RUNTIME_IDENTITY_PORT } from '../../../identity/public';
import { RUNTIME_PRICING_PORT } from '../../../pricing/public';
import { RUNTIME_VERIFICATION_PORT } from '../../../verification/public';
import { CleanupRuntime } from '../../application/process/CleanupRuntime';
import { createCleanupRepositories } from '../../infrastructure/persistence/PgCleanupRepository';
import { RuntimeCleanupJob } from './RuntimeCleanupJob';
import { OBJECT_STORE } from '../../public/ObjectPort';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const cleanup = new CleanupRuntime(
    new PgTransactionManager(context.service(DATABASE_POOL)),
    createCleanupRepositories(),
    context.service(OBJECT_STORE),
    {
      identity: context.ports.get(RUNTIME_IDENTITY_PORT),
      checkout: context.ports.get(RUNTIME_CHECKOUT_PORT),
      pricing: context.ports.get(RUNTIME_PRICING_PORT),
      verification: context.ports.get(RUNTIME_VERIFICATION_PORT),
    },
    RUNTIME_LIMITS.cleanup
  );
  return Object.freeze([
    {
      id: 'cleanup',
      processor: new RuntimeCleanupJob(cleanup),
    },
  ]);
}
