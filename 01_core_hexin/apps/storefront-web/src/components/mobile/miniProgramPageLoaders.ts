import { preloadOnce } from '@shop/interaction';
import type { MiniProgramPage } from '../../context/MallContext';

type PagePreloadKey = MiniProgramPage | 'payment-result';

const importMPCartPage = () => import('../../features/miniprogram/MPCartPage');
const importMPAddressPage = () => import('../../features/miniprogram/MPAddressPage');
const importMPCategoryPage = () => import('../../features/miniprogram/MPCategoryPage');
const importMPDetailPage = () => import('../../features/miniprogram/MPDetailPage');
const importMPWelfarePage = () => import('../../features/miniprogram/MPWelfarePage');
const importMobileOrdersPage = () => import('./MobileOrdersPage');
const importMPProfilePage = () => {
  void preloadPage('orders')?.catch(() => undefined);
  return import('../../features/miniprogram/MPProfilePage');
};
const importPaymentResultPage = () => import('../common/PaymentResultPage');

const PAGE_LOADERS = {
  category: importMPCategoryPage,
  welfare: importMPWelfarePage,
  detail: importMPDetailPage,
  cart: importMPCartPage,
  profile: importMPProfilePage,
  address: importMPAddressPage,
  orders: importMobileOrdersPage,
  'payment-result': importPaymentResultPage,
} satisfies Partial<Record<PagePreloadKey, () => Promise<unknown>>>;
const pagePreloads = new Map<PagePreloadKey, Promise<unknown>>();

const preloadPage = (key: PagePreloadKey) => preloadOnce(PAGE_LOADERS, pagePreloads, key);

function loadPage<Module>(key: PagePreloadKey, loader: () => Promise<Module>): Promise<Module> {
  return (preloadPage(key) ?? loader()) as Promise<Module>;
}

export const loadMPCartPage = () => loadPage('cart', importMPCartPage);
export const loadMPAddressPage = () => loadPage('address', importMPAddressPage);
export const loadMPCategoryPage = () => loadPage('category', importMPCategoryPage);
export const loadMPDetailPage = () => loadPage('detail', importMPDetailPage);
export const loadMPWelfarePage = () => loadPage('welfare', importMPWelfarePage);
export const loadMobileOrdersPage = () => loadPage('orders', importMobileOrdersPage);
export const loadMPProfilePage = () => loadPage('profile', importMPProfilePage);
export const loadPaymentResultPage = () => loadPage('payment-result', importPaymentResultPage);

export function preloadMiniProgramPage(page: MiniProgramPage): void {
  void preloadPage(page)?.catch(() => undefined);
}
