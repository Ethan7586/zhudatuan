import { publicPort } from '../../../bootstrap/ModuleRegistry';

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

export const NAVIGATION_READ_PORT = publicPort<NavigationReadPort>('navigation', 'read');
