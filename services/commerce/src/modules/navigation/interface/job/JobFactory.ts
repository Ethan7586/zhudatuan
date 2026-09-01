import { PgInbox } from '../../../../adapter/database/PgInbox';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { CACHE } from '../../../../foundation/cache/Cache';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { NAVIGATION_SECURITY_KEY } from '../../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { TELEMETRY } from '../../../../foundation/telemetry/Telemetry';
import { NAVIGATION_CLOCK } from '../../application/port/NavigationClock';
import { InvalidateNavigation } from '../../application/process/InvalidateNavigation';
import { NavigationEventHandler } from '../event/NavigationEventHandler';
import { NavigationEventJob } from './NavigationEventJob';
import { NavigationInvalidator } from '../../infrastructure/cache/NavigationInvalidator';
import { RedisNavigationCache } from '../../infrastructure/cache/RedisNavigationCache';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const secret = context.service(NAVIGATION_SECURITY_KEY).navigation;
  const cache = new RedisNavigationCache(context.service(CACHE), secret, context.service(TELEMETRY));
  const invalidator = new NavigationInvalidator(cache, secret, context.service(NAVIGATION_CLOCK));
  return Object.freeze([
    {
      id: 'navigation',
      processor: new NavigationEventJob(new InvalidateNavigation(new PgTransactionManager(context.service(DATABASE_POOL)), new PgInbox(), new NavigationEventHandler(invalidator))),
    },
  ]);
}
