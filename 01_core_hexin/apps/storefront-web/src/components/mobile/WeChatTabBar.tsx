import React from 'react';
import { useMall, MiniProgramPage } from '../../context/MallContext';
import { Home, LayoutGrid, Gift, ShoppingCart, User } from 'lucide-react';
import { preloadMiniProgramPage } from './miniProgramPageLoaders';

export const WECHAT_TABS: readonly { id: MiniProgramPage; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'category', label: '分类', icon: LayoutGrid },
  { id: 'welfare', label: '企业福利', icon: Gift },
  { id: 'cart', label: '购物车', icon: ShoppingCart },
  { id: 'profile', label: '我的', icon: User },
];

export const WeChatTabBar: React.FC = () => {
  const { mpPage, setMpPage, cartCount } = useMall();
  const [visualPage, setVisualPage] = React.useState<MiniProgramPage>(mpPage);

  React.useEffect(() => setVisualPage(mpPage), [mpPage]);

  const selectTab = (page: MiniProgramPage) => {
    if (page === mpPage) return;
    setVisualPage(page);
    React.startTransition(() => setMpPage(page));
  };

  return (
    <div data-storefront-mobile-tabbar className="z-40 grid h-[58px] w-full shrink-0 grid-cols-5 border-t border-gray-200/80 bg-white px-2 py-1.5 font-sans shadow-lg select-none">
      {WECHAT_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = visualPage === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onPointerDown={() => preloadMiniProgramPage(tab.id)}
            onClick={() => selectTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex h-full min-w-0 touch-manipulation cursor-pointer flex-col items-center justify-center rounded-lg py-1 transition-colors duration-100 active:bg-slate-50 ${isActive ? 'text-[var(--sw-brand)]' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <div className="relative flex h-5 items-center justify-center">
              <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {tab.id === 'cart' && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#E5484D] text-white font-bold text-[9px] min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-1 shadow-xs animate-in zoom-in-50">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span className={`mt-0.5 h-4 text-[10px] leading-4 tracking-tight ${isActive ? 'font-bold' : 'font-normal'}`}>{tab.label}</span>
            <span aria-hidden="true" className={`mt-0.5 h-1 w-1 rounded-full ${isActive ? 'bg-[var(--sw-brand)]' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </div>
  );
};
