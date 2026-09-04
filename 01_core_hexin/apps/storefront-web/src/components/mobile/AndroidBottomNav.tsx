import React from 'react';
import { useMall, AndroidAppPage } from '../../context/MallContext';
import { Home, LayoutGrid, Gift, ShoppingCart, User } from 'lucide-react';

export const AndroidBottomNav: React.FC = () => {
  const { androidPage, setAndroidPage, cartCount } = useMall();

  const tabs: { id: AndroidAppPage; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'search', label: '分类', icon: LayoutGrid },
    { id: 'detail', label: '福利', icon: Gift },
    { id: 'checkout', label: '购物车', icon: ShoppingCart },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <div className="bg-[#F5F7FA] border-t border-gray-200/90 sticky bottom-0 z-40 px-2 py-1.5 flex items-center justify-around select-none shadow-lg font-sans">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = androidPage === tab.id;

        return (
          <button key={tab.id} onClick={() => setAndroidPage(tab.id)} className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer group">
            {/* Material 3 Active Indicator Pill */}
            <div className={`px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center relative ${isActive ? 'bg-[var(--sw-brand-light)] text-[var(--sw-brand)]' : 'text-gray-500 group-hover:text-gray-800'}`}>
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-105 stroke-[2.5]' : 'stroke-2'}`} />

              {tab.id === 'checkout' && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E5484D] text-white font-bold text-[9px] min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-1 shadow-xs">{cartCount}</span>
              )}
            </div>

            <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-[var(--sw-brand)]' : 'font-medium text-gray-600'}`}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
