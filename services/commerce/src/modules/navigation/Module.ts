import { Singleflight } from '@shop/kernel';
import { CACHE } from '../../platform/cache/Cache';
import { NAVIGATION_SECURITY_KEY } from '../../platform/secret/SecretStore';
import { TELEMETRY } from '../../platform/telemetry/Telemetry';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { MEMBERSHIP_READ_PORT } from '../access/public';
import { BENEFIT_READ_PORT } from '../benefit/public';
import { NAVIGATION_CAPABILITY_PORT } from '../capability/public';
import { CATALOG_READ_PORT } from '../catalog/public';
import { EXPERIENCE_READ_PORT } from '../experience/public';
import { IDENTITY_READ_PORT } from '../identity/public';
import { INVENTORY_READ_PORT } from '../inventory/public';
import { MEMBER_READ_PORT } from '../member/public';
import { ORDER_READ_PORT } from '../order/public';
import { NAVIGATION_ORGANIZATION_PORT } from '../organization/public';
import { PRICING_READ_PORT } from '../pricing/public';
import { CATALOG_QUALIFICATION_PORT } from '../qualification/public';
import { BootstrapReadHandler } from './application/handler/BootstrapReadHandler';
import { CatalogReadHandler } from './application/handler/CatalogReadHandler';
import { HealthReadHandler } from './application/handler/HealthReadHandler';
import { NavigationCatalogReadHandler } from './application/handler/NavigationCatalogReadHandler';
import { TreeReadHandler } from './application/handler/TreeReadHandler';
import { NAVIGATION_CLOCK } from './application/port/NavigationClock';
import { BootstrapQuery } from './application/service/BootstrapQuery';
import { CatalogMapper } from './application/service/CatalogMapper';
import { CatalogQuery } from './application/service/CatalogQuery';
import { NavigationProjector } from './application/service/NavigationProjector';
import { navigationFeatureVersion } from './application/service/NavigationVersion';
import { ReadNavigationCatalog } from './application/service/ReadNavigationCatalog';
import { ReadNavigationHealth } from './application/service/ReadNavigationHealth';
import { ReadNavigationTree } from './application/service/ReadNavigationTree';
import { NavigationInvalidator } from './infrastructure/cache/NavigationInvalidator';
import { RedisNavigationCache } from './infrastructure/cache/RedisNavigationCache';
import { PgNavigationProjectionRepository } from './infrastructure/persistence/PgNavigationProjectionRepository';
import { CatalogNavigationReader } from './infrastructure/registry/CatalogNavigationReader';
import { NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH, NAVIGATION_FEATURE_FLAGS } from './infrastructure/registry/NavigationCatalog';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';

export const NavigationModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'navigation', events: EVENT_SUBSCRIPTIONS.navigation }],
  handlers: (context) => {
    const secret = context.service(NAVIGATION_SECURITY_KEY).navigation;
    const clock = context.service(NAVIGATION_CLOCK);
    const cache = new RedisNavigationCache(context.service(CACHE), secret, context.service(TELEMETRY));
    const invalidator = new NavigationInvalidator(cache, secret, clock);
    const projector = new NavigationProjector(
      context.ports.get(NAVIGATION_ORGANIZATION_PORT),
      clock,
      secret,
      NAVIGATION_CATALOG,
      NAVIGATION_CATALOG_HASH
    );
    const projections = new PgNavigationProjectionRepository(new PgTransactionAccess(), projector);
    const tree = new ReadNavigationTree(projections, cache, new Singleflight(), secret, NAVIGATION_CATALOG_HASH, navigationFeatureVersion(NAVIGATION_FEATURE_FLAGS));
    const navigation = new CatalogNavigationReader(NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH);
    const bootstrap = new BootstrapQuery({
      identity: context.ports.get(IDENTITY_READ_PORT),
      membership: context.ports.get(MEMBERSHIP_READ_PORT),
      navigation,
      capability: context.ports.get(NAVIGATION_CAPABILITY_PORT),
      member: context.ports.get(MEMBER_READ_PORT),
      benefit: context.ports.get(BENEFIT_READ_PORT),
      order: context.ports.get(ORDER_READ_PORT),
      experience: context.ports.get(EXPERIENCE_READ_PORT),
    });
    const catalog = new CatalogQuery(
      context.ports.get(EXPERIENCE_READ_PORT),
      context.ports.get(CATALOG_READ_PORT),
      context.ports.get(PRICING_READ_PORT),
      context.ports.get(INVENTORY_READ_PORT),
      context.ports.get(CATALOG_QUALIFICATION_PORT),
      new CatalogMapper(secret)
    );
    return [
      new TreeReadHandler(tree),
      new NavigationCatalogReadHandler(new ReadNavigationCatalog(NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH)),
      new HealthReadHandler(new ReadNavigationHealth(cache, invalidator, NAVIGATION_CATALOG_HASH, NAVIGATION_CATALOG.length)),
      new BootstrapReadHandler(bootstrap),
      new CatalogReadHandler(catalog),
    ];
  },
});
