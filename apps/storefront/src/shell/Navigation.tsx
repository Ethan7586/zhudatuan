import React from 'react';
import { Brand } from '@shop/design';
import { Building2, FileText, Grid3X3, Home, Layers, LogOut, ShoppingCart, UserRound } from 'lucide-react';
import { useShellRuntime } from './ShellRuntime';
import type { LaptopPage } from '../shared/manifest/StorefrontRoute';
import type { NavigationView as StorefrontNavigationNode } from '../shared/runtime/StorefrontPort';
import { STOREFRONT_WEB_SURFACE_COPY, type StorefrontWebSurface } from '../shared/ui/StorefrontPresentation';
import type { MobileChannel } from '../shared/manifest/StorefrontChannel';

type LaptopTopSwitcherProps = {
  surface?: StorefrontWebSurface;
};

export const LaptopTopSwitcher: React.FC<LaptopTopSwitcherProps> = ({ surface = 'standard' }) => {
  const { laptopPage, setLaptopPage, navigationNodes } = useShellRuntime();
  const surfaceCopy = STOREFRONT_WEB_SURFACE_COPY[surface];
  const pages = navigationPages(navigationNodes);

  return (
    <nav aria-label="商城页面导航" className="bg-[var(--sw-brand-dark)] text-white border-b border-blue-900 shadow-md py-2 px-3 sm:px-6 sticky top-0 z-50 font-sans">
      <div className="sw-web-switcher-container max-w-[1366px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Brand variant="mark" product="企业福利商城" inverse />
              <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/40 font-bold px-1.5 py-0.5 rounded">{surfaceCopy.frameBadge}</span>
            </div>
            <div className="text-[10px] text-blue-200">SMART WING B2B2C · 技术服务：雍彻科技（SGSYEN TECH）</div>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 scrollbar-none">
          <span className="text-gray-300 font-medium flex items-center gap-1 flex-shrink-0 mr-1">
            <Layers className="w-3 h-3 text-yellow-300" />
            <span>{surfaceCopy.pageSwitcherLabel}</span>
          </span>
          {pages.map((page) => (
            <button
              type="button"
              key={page.node.id}
              onClick={() => setLaptopPage(page.page)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 ${laptopPage === page.page ? 'bg-yellow-400 text-gray-900 shadow-sm' : 'bg-white/10 text-blue-100 hover:bg-white/20'}`}
              title={page.node.title}
            >
              {page.node.title}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

function navigationPages(nodes: readonly StorefrontNavigationNode[]) {
  const seen = new Set<string>();
  return flattenEnabled(nodes).flatMap((node) => {
    const page: LaptopPage = node.route === '/products' ? 'category' : node.route === '/cart' ? 'cart' : node.route === '/orders' || node.route === '/profile' ? 'orders' : 'home-1366';
    if (seen.has(page)) return [];
    seen.add(page);
    return [{ node, page }];
  });
}

function flattenEnabled(nodes: readonly StorefrontNavigationNode[]): readonly StorefrontNavigationNode[] {
  return nodes.flatMap((node) => (node.disabled ? [] : [node, ...flattenEnabled(node.children)]));
}

export const Navigation = LaptopTopSwitcher;

const channelItems: Array<{ readonly page: LaptopPage; readonly label: string; readonly icon: typeof Home }> = [
  { page: 'home-1366', label: '首页', icon: Home },
  { page: 'category', label: '分类', icon: Grid3X3 },
  { page: 'detail', label: '福利', icon: Building2 },
  { page: 'cart', label: '购物车', icon: ShoppingCart },
  { page: 'orders', label: '我的', icon: UserRound },
];

export function MobileBottomNavigation({ channel, page, onPage }: { readonly channel: MobileChannel; readonly page: LaptopPage; readonly onPage: (page: LaptopPage) => void }) {
  const { cartCount } = useShellRuntime();
  return (
    <nav
      aria-label={`${channel === 'android' ? 'Android' : '小程序'}底部导航`}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto grid max-w-[767px] grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 backdrop-blur"
    >
      {channelItems.map((item) => {
        const Icon = item.icon;
        const active = page === item.page || (item.page === 'home-1366' && page === 'home-1440');
        return (
          <button
            key={item.page}
            type="button"
            onClick={() => onPage(item.page)}
            className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold ${active ? 'text-blue-600' : 'text-slate-500'}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={19} />
            {item.page === 'category' && channel === 'android' ? '搜索' : item.label}
            {item.page === 'cart' && cartCount > 0 ? <span className="absolute right-[23%] top-0 rounded-full bg-red-500 px-1 text-[9px] text-white">{cartCount}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

export function TabletNavigation() {
  const { laptopPage, setLaptopPage, cartCount, currentMall, user, logout } = useShellRuntime();
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b bg-white/95 px-5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
            <Building2 size={20} />
          </span>
          <div>
            <div className="truncate text-sm font-black">{currentMall.mallName}</div>
            <div className="text-[10px] text-blue-600">Tablet 企业福利商城</div>
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs font-bold">{user.name}</div>
          <div className="text-[10px] text-slate-400">{user.department}</div>
        </div>
        <button type="button" onClick={() => void logout()} className="ml-3 grid h-9 w-9 place-items-center rounded-full border bg-white text-slate-500" aria-label="退出登录">
          <LogOut size={16} />
        </button>
      </header>
      <nav aria-label="平板商城导航" className="fixed bottom-0 left-0 top-16 z-30 flex w-20 flex-col items-center gap-2 border-r bg-white py-4">
        {channelItems.slice(0, 5).map(({ page, label, icon: Icon }) => {
          const active = laptopPage === page || (page === 'home-1366' && laptopPage === 'home-1440');
          return (
            <button
              type="button"
              key={page}
              onClick={() => setLaptopPage(page)}
              className={`relative flex w-16 flex-col items-center gap-1 rounded-xl py-3 text-[10px] font-bold ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              {label}
              {page === 'cart' && cartCount > 0 ? <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1 text-[8px] text-white">{cartCount}</span> : null}
            </button>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1 text-[10px] text-slate-400">
          <FileText size={18} />
          订单
        </div>
      </nav>
    </>
  );
}
