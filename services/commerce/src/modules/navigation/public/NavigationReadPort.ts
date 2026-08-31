import { publicPort } from '../../../bootstrap/ModuleRegistry';
import { NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH } from '../infrastructure/catalog/NavigationCatalog';

export interface StorefrontNavigationItem {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly order: number;
}

export interface NavigationReadPort {
  storefront(): Readonly<{ items: readonly StorefrontNavigationItem[]; version: string }>;
}

export class CatalogNavigationReadPort implements NavigationReadPort {
  storefront(): Readonly<{ items: readonly StorefrontNavigationItem[]; version: string }> {
    const items = NAVIGATION_CATALOG.filter((item) => item.surface === 'storefront')
      .map(({ id, title, icon, route, order }) => Object.freeze({ id, title, icon, route, order }))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    return Object.freeze({ items: Object.freeze(items), version: NAVIGATION_CATALOG_HASH });
  }
}

export const NAVIGATION_READ_PORT = publicPort<NavigationReadPort>('navigation', 'read');
