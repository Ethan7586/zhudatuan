import type { MiniProgramPage } from '../../context/MallContext';

export const loadMPCartPage = () => import('../../features/miniprogram/MPCartPage');
export const loadMPAddressPage = () => import('../../features/miniprogram/MPAddressPage');
export const loadMPCategoryPage = () => import('../../features/miniprogram/MPCategoryPage');
export const loadMPDetailPage = () => import('../../features/miniprogram/MPDetailPage');
export const loadMPProfilePage = () => import('../../features/miniprogram/MPProfilePage');
export const loadMPWelfarePage = () => import('../../features/miniprogram/MPWelfarePage');
export const loadMobileOrdersPage = () => import('./MobileOrdersPage');

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
  if (page === 'cart') void pageLoad?.then(() => loadMPAddressPage());
  if (page === 'profile') void loadMobileOrdersPage();
}

export function preloadPrimaryMiniProgramPages() {
  const primaryPages = Promise.all([
    loadMPCategoryPage(),
    loadMPWelfarePage(),
    loadMPCartPage(),
    loadMPProfilePage(),
  ]);
  void primaryPages.then(() => Promise.all([loadMPAddressPage(), loadMobileOrdersPage()]));
  return primaryPages;
}
