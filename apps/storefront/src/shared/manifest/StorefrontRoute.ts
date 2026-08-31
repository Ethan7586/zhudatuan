import { NAVIGATION_ROUTES } from '../../generated/NavigationBinding';

export type LaptopPage = 'home-1366' | 'home-1440' | 'category' | 'detail' | 'cart' | 'orders';

export type PageRoute = 'home' | 'category' | 'detail' | 'cart' | 'checkout' | 'payment-result' | 'user-center' | 'orders' | 'order-detail' | 'after-sale' | 'coupons' | 'balance';

export function pathForPage(page: LaptopPage): string {
  if (page === 'category' || page === 'detail') return NAVIGATION_ROUTES.catalog;
  if (page === 'cart') return NAVIGATION_ROUTES.cart;
  if (page === 'orders') return NAVIGATION_ROUTES.orders;
  return NAVIGATION_ROUTES.home;
}

export function pathForFeature(name: string): string {
  if (/客服/.test(name)) return NAVIGATION_ROUTES.support;
  if (/消息/.test(name)) return NAVIGATION_ROUTES.notifications;
  if (/安全/.test(name)) return NAVIGATION_ROUTES.security;
  if (/收货地址|地址/.test(name)) return `${NAVIGATION_ROUTES.profile}?section=addresses`;
  if (/收藏/.test(name)) return `${NAVIGATION_ROUTES.profile}?section=favorites`;
  if (/卡券|电影|核销/.test(name)) return NAVIGATION_ROUTES.vouchers;
  if (/账户|流水|充值|餐卡/.test(name)) return NAVIGATION_ROUTES.benefits;
  if (/发票/.test(name)) return `${NAVIGATION_ROUTES.orders}?view=invoices`;
  if (/待付款/.test(name)) return `${NAVIGATION_ROUTES.orders}?status=pending_payment`;
  if (/待发货/.test(name)) return `${NAVIGATION_ROUTES.orders}?status=pending_shipment`;
  if (/待收货|物流/.test(name)) return `${NAVIGATION_ROUTES.orders}?status=pending_receipt`;
  if (/已完成/.test(name)) return `${NAVIGATION_ROUTES.orders}?status=completed`;
  if (/售后/.test(name)) return `${NAVIGATION_ROUTES.orders}?status=after_sale`;
  if (/订单/.test(name)) return NAVIGATION_ROUTES.orders;
  return NAVIGATION_ROUTES.catalog;
}

export function pathForRoute(route: PageRoute, params: Readonly<Record<string, unknown>> = {}): string {
  if (route === 'cart') return NAVIGATION_ROUTES.cart;
  if (route === 'checkout') return NAVIGATION_ROUTES.checkout;
  if (route === 'orders') {
    const orderId = typeof params.orderId === 'string' ? params.orderId : null;
    const status = typeof params.statusFilter === 'string' ? params.statusFilter : null;
    if (orderId) return NAVIGATION_ROUTES.order.replace(':orderId', encodeURIComponent(orderId));
    return status && status !== 'all' ? `${NAVIGATION_ROUTES.orders}?status=${encodeURIComponent(status)}` : NAVIGATION_ROUTES.orders;
  }
  if (route === 'coupons') return NAVIGATION_ROUTES.vouchers;
  if (route === 'balance') return NAVIGATION_ROUTES.benefits;
  if (route === 'detail' && typeof params.productId === 'string') return NAVIGATION_ROUTES.product.replace(':productId', encodeURIComponent(params.productId));
  return NAVIGATION_ROUTES.home;
}

export function resourceId(pathname: string, collection: 'orders' | 'products'): string | null {
  const prefix = `/${collection}/`;
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes('/')) return null;
  try {
    const value = decodeURIComponent(encoded);
    return /^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
