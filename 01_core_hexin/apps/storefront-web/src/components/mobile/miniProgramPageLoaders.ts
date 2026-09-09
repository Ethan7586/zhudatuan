import type { MiniProgramPage } from '../../context/MallContext';

export const loadMPCartPage = () => import('../../features/miniprogram/MPCartPage');
export const loadMPAddressPage = () => import('../../features/miniprogram/MPAddressPage');
export const loadMPCategoryPage = () => import('../../features/miniprogram/MPCategoryPage');
export const loadMPDetailPage = () => import('../../features/miniprogram/MPDetailPage');
export const loadMPWelfarePage = () => import('../../features/miniprogram/MPWelfarePage');
export const loadMobileOrdersPage = () => import('./MobileOrdersPage');
export const loadMPProfilePage = () => {
  void loadMobileOrdersPage();
  return import('../../features/miniprogram/MPProfilePage');
};
export const loadPaymentResultPage = () => import('../common/PaymentResultPage');

const PRIMARY_PAGE_LOADERS: Partial<Record<MiniProgramPage, () => Promise<unknown>>> = {
  category: loadMPCategoryPage,
  welfare: loadMPWelfarePage,
  cart: loadMPCartPage,
  profile: loadMPProfilePage,
  address: loadMPAddressPage,
  orders: loadMobileOrdersPage,
};

export function preloadMiniProgramPage(page: MiniProgramPage): void {
  const pageLoad = PRIMARY_PAGE_LOADERS[page]?.();
  void pageLoad;
}
