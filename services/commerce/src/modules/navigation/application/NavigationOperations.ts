import { DomainError } from '../../../foundation/domain/DomainError';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../../foundation/application/ModuleOperations';
import { NAVIGATION_SECURITY_KEY } from '../../../foundation/infrastructure/SecretStore';
import { Singleflight } from '../../../foundation/performance/Singleflight';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { NAVIGATION_ACCESS_PORT } from '../../access/public';
import { MEMBERSHIP_READ_PORT } from '../../access/public';
import { NAVIGATION_CAPABILITY_PORT } from '../../capability/public';
import { NAVIGATION_IDENTITY_PORT } from '../../identity/public';
import { NAVIGATION_ORGANIZATION_PORT } from '../../organization/public';
import { NavigationProjector } from './projection/NavigationProjector';
import { ReadNavigationCatalog } from './query/ReadNavigationCatalog';
import { ReadNavigationHealth } from './query/ReadNavigationHealth';
import { ReadNavigationTree } from './query/ReadNavigationTree';
import { NAVIGATION_CLOCK } from './port/NavigationClock';
import type { CatalogNavigationNode } from './projection/NavigationFilter';
import type { NavigationCache, NavigationInvalidationState } from './port/NavigationCache';
import { BootstrapQuery } from '../../../app/storefront/BootstrapQuery';
import { CatalogMapper } from '../../../app/storefront/CatalogMapper';
import { CatalogQuery } from '../../../app/storefront/CatalogQuery';
import { BENEFIT_READ_PORT } from '../../benefit/public';
import { CATALOG_READ_PORT } from '../../catalog/public';
import { EXPERIENCE_READ_PORT } from '../../experience/public';
import { IDENTITY_READ_PORT } from '../../identity/public';
import { INVENTORY_READ_PORT } from '../../inventory/public';
import { MEMBER_READ_PORT } from '../../member/public';
import { NAVIGATION_READ_PORT } from '../public/index';
import { ORDER_READ_PORT } from '../../order/public';
import { PRICING_READ_PORT } from '../../pricing/public';

export interface NavigationComposition {
  readonly cache: NavigationCache;
  readonly invalidator: NavigationInvalidationState;
  readonly catalog: readonly CatalogNavigationNode[];
  readonly catalogHash: string;
}

export function navigationOperations(context: ModuleContext, composition: NavigationComposition): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const secret = context.service(NAVIGATION_SECURITY_KEY).navigation;
  const clock = context.service(NAVIGATION_CLOCK);
  const { cache, invalidator, catalog, catalogHash } = composition;
  const projector = new NavigationProjector(
    context.ports.get(NAVIGATION_IDENTITY_PORT),
    context.ports.get(NAVIGATION_ACCESS_PORT),
    context.ports.get(NAVIGATION_ORGANIZATION_PORT),
    context.ports.get(NAVIGATION_CAPABILITY_PORT),
    clock,
    secret,
    catalog,
    catalogHash
  );
  const tree = new ReadNavigationTree(pool.workload('query'), cache, projector, new Singleflight(), secret, catalogHash);
  const catalogQuery = new ReadNavigationCatalog(catalog, catalogHash);
  const health = new ReadNavigationHealth(cache, invalidator, catalogHash, catalog.length);
  const experience = context.ports.get(EXPERIENCE_READ_PORT);
  const bootstrap = new BootstrapQuery({
    identity: context.ports.get(IDENTITY_READ_PORT),
    membership: context.ports.get(MEMBERSHIP_READ_PORT),
    navigation: context.ports.get(NAVIGATION_READ_PORT),
    member: context.ports.get(MEMBER_READ_PORT),
    benefit: context.ports.get(BENEFIT_READ_PORT),
    order: context.ports.get(ORDER_READ_PORT),
    experience,
  });
  const storefrontCatalog = new CatalogQuery(experience, context.ports.get(CATALOG_READ_PORT), context.ports.get(PRICING_READ_PORT), context.ports.get(INVENTORY_READ_PORT), new CatalogMapper(secret));
  return new ModuleOperations('navigation', pool, context.service(AUDIT_SINK), {
    'navigation.tree.read': async (request) => {
      const value = request.input.query.scopeid;
      if (value !== undefined && typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'scopeid' });
      return tree.execute(requireAccess(request), value, { signal: request.input.signal, deadline: request.input.deadline });
    },
    'navigation.catalog.read': async () => catalogQuery.execute(),
    'navigation.health.read': async () => health.execute(),
    'storefront.bootstrap.read': (request) => bootstrap.execute(request),
    'storefront.catalog.read': (request) => storefrontCatalog.execute(request),
  });
}
