/**
 * 智慧翼企业福利商城 - 多级分类 Mega 菜单组件
 * 包含完整分类树、高频热词与浮动二级级联子菜单
 * 技术服务方：雍彻科技
 */

import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { UtensilsCrossed, Tv, Laptop, Home, Sparkles, Film, CreditCard, ShoppingBag, Store, Gift, ChevronRight, ChevronDown } from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  UtensilsCrossed,
  Tv,
  Laptop,
  Home,
  Sparkles,
  Film,
  CreditCard,
  ShoppingBag,
  Store,
  Gift,
};

export const CategoryMegaMenu: React.FC<{ isAlwaysOpen?: boolean }> = ({ isAlwaysOpen = true }) => {
  const { navigateTo, presentationCategories } = useMall();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const activeCategory = presentationCategories.find((category) => category.id === activeCategoryId);

  return (
    <div className="relative w-56 bg-white border border-gray-200 rounded-b-md shadow-md select-none font-sans z-30" onMouseLeave={() => setActiveCategoryId(null)}>
      <div className="divide-y divide-gray-100">
        {presentationCategories.map((cat) => {
          const IconComponent = ICON_MAP[cat.iconName] || Gift;
          const isHovered = activeCategoryId === cat.id;

          return (
            <div
              key={cat.id}
              onMouseEnter={() => setActiveCategoryId(cat.id)}
              onClick={() => navigateTo('category', { categoryId: cat.id })}
              className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${isHovered ? 'bg-[var(--sw-brand-light)] text-[var(--sw-brand)] font-semibold' : 'hover:bg-gray-50 text-gray-800'}`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <IconComponent className={`w-4 h-4 flex-shrink-0 ${isHovered ? 'text-[var(--sw-brand)]' : 'text-gray-400'}`} />
                <div className="truncate">
                  <div className="font-medium truncate">{cat.name}</div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5">{cat.hotKeywords.slice(0, 2).join(' / ')}</div>
                </div>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isHovered ? 'text-[var(--sw-brand)]' : 'text-gray-300'}`} />
            </div>
          );
        })}
      </div>

      {/* 浮动二级级联展开层 */}
      {activeCategory && activeCategory.children && (
        <div className="absolute top-0 left-full ml-0.5 w-[520px] min-h-full bg-white border border-gray-200 rounded-r-md shadow-2xl p-5 z-40 animate-in fade-in slide-in-from-left-1 duration-150">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{activeCategory.name}</span>
              <span className="text-xs bg-blue-50 text-[var(--sw-brand)] px-2 py-0.5 rounded">企业福利配发与兑换</span>
            </div>
            <button onClick={() => navigateTo('category', { categoryId: activeCategory.id })} className="text-xs text-[var(--sw-brand)] hover:underline flex items-center gap-0.5 font-medium">
              查看全部分类 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-4">
            {activeCategory.children.map((sub) => (
              <div key={sub.id} className="grid grid-cols-4 gap-2 text-xs">
                <div className="col-span-1 font-bold text-gray-900 border-r border-gray-100 pr-2 flex items-center justify-between">
                  <span>{sub.name}</span>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                </div>
                <div className="col-span-3 flex flex-wrap gap-2 text-gray-600">
                  {sub.items.map((item) => (
                    <button
                      key={item}
                      onClick={() =>
                        navigateTo('category', {
                          categoryId: activeCategory.id,
                          keyword: item,
                        })
                      }
                      className="hover:text-[var(--sw-brand)] hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 推荐词标签 */}
          <div className="mt-6 pt-3 border-t border-gray-100 bg-gray-50/70 -mx-5 -mb-5 p-4 rounded-b-md">
            <div className="text-[11px] font-semibold text-gray-400 mb-2">热度兑换推荐词：</div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {activeCategory.hotKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() =>
                    navigateTo('category', {
                      categoryId: activeCategory.id,
                      keyword: kw,
                    })
                  }
                  className="bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-[var(--sw-brand)] px-2 py-0.5 rounded transition-colors"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
