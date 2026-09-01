import type { NavigationReadPort, StorefrontNavigationItem } from '../../public/NavigationReadPort';
import { NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH } from './NavigationCatalog';

export class CatalogNavigationReader implements NavigationReadPort {
  storefront(): Readonly<{ items: readonly StorefrontNavigationItem[]; version: string }> {
    const items = NAVIGATION_CATALOG.filter((item) => item.surface === 'storefront')
      .map(({ id, title, icon, route, order }) => Object.freeze({ id, title, icon, route, order }))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    return Object.freeze({ items: Object.freeze(items), version: NAVIGATION_CATALOG_HASH });
  }
}
