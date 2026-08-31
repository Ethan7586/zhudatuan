import { defineModule } from '../../bootstrap/DefinedModule';
import { navigationOperations } from './application/NavigationOperations';
import { Manifest } from './Manifest';
import { CACHE } from '../../foundation/cache/Cache';
import { NAVIGATION_SECURITY_KEY } from '../../foundation/infrastructure/SecretStore';
import { TELEMETRY } from '../../foundation/telemetry/Telemetry';
import { NAVIGATION_CLOCK } from './application/port/NavigationClock';
import { NavigationInvalidator } from './infrastructure/cache/NavigationInvalidator';
import { RedisNavigationCache } from './infrastructure/cache/RedisNavigationCache';
import { NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH } from './infrastructure/catalog/NavigationCatalog';
import { NavigationEventHandler } from './interface/event/NavigationEventHandler';
import { CatalogNavigationReadPort, NAVIGATION_READ_PORT } from './public/NavigationReadPort';

export const NavigationModule = defineModule(
  Manifest,
  (context) => {
    const secret = context.service(NAVIGATION_SECURITY_KEY).navigation;
    const cache = new RedisNavigationCache(context.service(CACHE), secret, context.service(TELEMETRY));
    const invalidator = new NavigationInvalidator(cache, secret, context.service(NAVIGATION_CLOCK));
    return navigationOperations(context, { cache, invalidator, catalog: NAVIGATION_CATALOG, catalogHash: NAVIGATION_CATALOG_HASH });
  },
  [{ token: NAVIGATION_READ_PORT, value: new CatalogNavigationReadPort() }]
);

export function navigationEventHandler(invalidator: NavigationInvalidator): NavigationEventHandler {
  return new NavigationEventHandler(invalidator);
}
