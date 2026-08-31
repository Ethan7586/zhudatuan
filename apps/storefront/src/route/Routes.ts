import { NAVIGATION_ROUTES } from '../generated/NavigationBinding';
import { pathForPage, type LaptopPage } from '../shared/manifest/StorefrontRoute';
import { useLocation } from 'react-router';

export const ROUTES = Object.freeze({
  home: NAVIGATION_ROUTES.home,
  products: NAVIGATION_ROUTES.catalog,
  product: NAVIGATION_ROUTES.product,
  cart: NAVIGATION_ROUTES.cart,
  checkout: NAVIGATION_ROUTES.checkout,
  payment: NAVIGATION_ROUTES.payment,
  orders: NAVIGATION_ROUTES.orders,
  order: NAVIGATION_ROUTES.order,
  aftersale: NAVIGATION_ROUTES.aftersale,
  vouchers: NAVIGATION_ROUTES.vouchers,
  benefits: NAVIGATION_ROUTES.benefits,
  profile: NAVIGATION_ROUTES.profile,
  security: NAVIGATION_ROUTES.security,
  support: NAVIGATION_ROUTES.support,
  supportCase: NAVIGATION_ROUTES.supportcase,
  notifications: NAVIGATION_ROUTES.notifications,
} as const);

export type RouteName = keyof typeof ROUTES;

export function routePath(name: RouteName, parameter?: string): string {
  const path = ROUTES[name];
  if (!path.includes(':')) return path;
  if (!parameter || !/^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(parameter)) throw new Error('ROUTE_PARAMETER_INVALID');
  return path.replace(/:[A-Za-z]+/, encodeURIComponent(parameter));
}

export function pathToPage(pathname: string): LaptopPage {
  if (pathname.startsWith('/products/')) return 'detail';
  if (pathname === ROUTES.products) return 'category';
  if (pathname === ROUTES.cart || pathname === ROUTES.checkout) return 'cart';
  if (pathname.startsWith('/orders')) return 'orders';
  return 'home-1366';
}

export function useRoutePage(): LaptopPage {
  return pathToPage(useLocation().pathname);
}

export function routeForPage(page: LaptopPage): string {
  return pathForPage(page);
}
