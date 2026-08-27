import React from 'react';
import { useMall, MiniProgramPage } from '../../context/MallContext';
import { Home, LayoutGrid, Gift, ShoppingCart, User } from 'lucide-react';

export const WeChatTabBar: React.FC = () => {
  const { mpPage, setMpPage, cartCount } = useMall();

  const tabs: { id: MiniProgramPage; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'category', label: '分类', icon: LayoutGrid },
    { id: 'detail', label: '企业福利', icon: Gift },
    { id: 'cart', label: '购物车', icon: ShoppingCart },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <div className="bg-white border-t border-gray-200/80 sticky bottom-0 z-40 px-2 py-1.5 flex items-center justify-around select-none shadow-lg font-sans">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = mpPage === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setMpPage(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative cursor-pointer transition-colors ${isActive ? 'text-[var(--sw-brand)]' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
              {tab.id === 'cart' && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#E5484D] text-white font-bold text-[9px] min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-1 shadow-xs animate-in zoom-in-50">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-normal'}`}>{tab.label}</span>
            {isActive && <span className="w-1 h-1 bg-[var(--sw-brand)] rounded-full mt-0.5 animate-pulse" />}
          </button>
        );
      })}
    </div>
  );
};
