import type { MiniProgramPage } from '../../context/MallContext';

export const loadMPCartPage = () => import('../../features/miniprogram/MPCartPage');
export const loadMPCategoryPage = () => import('../../features/miniprogram/MPCategoryPage');
export const loadMPDetailPage = () => import('../../features/miniprogram/MPDetailPage');
export const loadMPProfilePage = () => import('../../features/miniprogram/MPProfilePage');
export const loadMPWelfarePage = () => import('../../features/miniprogram/MPWelfarePage');

const PRIMARY_PAGE_LOADERS: Partial<Record<MiniProgramPage, () => Promise<unknown>>> = {
  category: loadMPCategoryPage,
  welfare: loadMPWelfarePage,
  cart: loadMPCartPage,
  profile: loadMPProfilePage,
};

export function preloadMiniProgramPage(page: MiniProgramPage): void {
  void PRIMARY_PAGE_LOADERS[page]?.();
}

export function preloadPrimaryMiniProgramPages() {
  return Promise.all([
    loadMPCategoryPage(),
    loadMPWelfarePage(),
    loadMPCartPage(),
    loadMPProfilePage(),
  ]);
}
