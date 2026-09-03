import { ROUTES, type RouteId } from '../../generated/RouteBinding';

export type PageName = 'home' | 'catalog' | 'product' | 'cart' | 'orders';
export function pathForPage(page: PageName): string {
  if (page === 'catalog' || page === 'product') return ROUTES.storecatalog;
  if (page === 'cart') return ROUTES.storecart;
  if (page === 'orders') return ROUTES.storeorders;
  return ROUTES.storehome;
}
export function routePath(route: RouteId, parameters: Readonly<Record<string, string>> = {}): string {
  return ROUTES[route].replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = parameters[name];
    if (!value || !/^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(value)) throw new Error(`ROUTE_PARAMETER_INVALID:${name}`);
    return encodeURIComponent(value);
  });
}
export function pathForFeature(name: string): string {
  if (/客服/.test(name)) return ROUTES.storesupport;
  if (/消息/.test(name)) return ROUTES.storenotifications;
  if (/安全/.test(name)) return ROUTES.storesecurity;
  if (/地址/.test(name)) return `${ROUTES.storeprofile}?section=addresses`;
  if (/收藏/.test(name)) return `${ROUTES.storeprofile}?section=favorites`;
  if (/卡券|电影|核销/.test(name)) return ROUTES.storevouchers;
  if (/账户|流水|充值|餐卡/.test(name)) return ROUTES.storebenefits;
  if (/发票/.test(name)) return `${ROUTES.storeorders}?view=invoices`;
  if (/订单|发货|收货|物流|售后/.test(name)) return ROUTES.storeorders;
  return ROUTES.storecatalog;
}
