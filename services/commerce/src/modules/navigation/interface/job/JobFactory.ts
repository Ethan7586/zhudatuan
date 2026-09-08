import { PgInbox } from '../../../../platform/database/PgInbox';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { CACHE } from '../../../../platform/cache/Cache';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { NAVIGATION_SECURITY_KEY } from '../../../../platform/secret/SecretStore';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { TELEMETRY } from '../../../../platform/telemetry/Telemetry';
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
