import type { ConsumerNavigationReader, ConsumerNavigationSnapshot } from '../../application/port/ConsumerNavigationReader';
import { NavigationFilter, type CatalogNavigationNode } from '../../application/service/NavigationFilter';
import { navigationVersion } from '../../application/service/NavigationVersion';
import type { NavigationContext } from '../../domain/model/NavigationContext';

export class CatalogNavigationReader implements ConsumerNavigationReader {
  readonly featureFlags: ReadonlySet<string>;
  constructor(
    private readonly catalog: readonly CatalogNavigationNode[],
    private readonly catalogHash: string,
    private readonly filter = new NavigationFilter()
  ) {
    this.featureFlags = new Set(catalog.flatMap((node) => node.featureFlags));
  }

  read(context: NavigationContext): ConsumerNavigationSnapshot {
    const nodes = this.filter.apply(this.catalog, context);
    const version = navigationVersion(this.catalogHash, context).version;
    return Object.freeze({ nodes, version });
  }
}
