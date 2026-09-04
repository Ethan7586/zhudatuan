import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { WeChatTabBar } from '../../components/mobile/WeChatTabBar';
import { Search, Plus, Filter, Tag, ArrowUpDown } from 'lucide-react';

export const MPCategoryPage: React.FC = () => {
  const { setMpPage, addToCart, presentationProducts: MOCK_PRODUCTS, presentationCategories: MOCK_CATEGORIES } = useMall();
  const [activeCategoryId, setActiveCategoryId] = useState(MOCK_CATEGORIES[0].id);
  const [keyword, setKeyword] = useState('');

  const currentCategory = MOCK_CATEGORIES.find((c) => c.id === activeCategoryId) || MOCK_CATEGORIES[0];

  const filteredProducts = MOCK_PRODUCTS.filter((p) => {
    const matchCat = activeCategoryId === 'cat_all' || p.categoryId === activeCategoryId;
    const matchKw = !keyword || p.title.includes(keyword) || p.subtitle?.includes(keyword);
    return matchCat && matchKw;
  });

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800">
      <WeChatCapsule title="全品类福利兑换" />

      {/* 搜索框与排序筛选 */}
      <div className="bg-white border-b border-gray-200/80 p-2.5 space-y-2 sticky top-[72px] z-20 shadow-xs">
        <div className="relative flex items-center">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="在全站品类中搜索商品..."
            className="w-full bg-gray-100 text-gray-800 placeholder-gray-400 text-xs pl-8 pr-8 py-1.5 rounded-full focus:outline-none focus:bg-white border border-gray-200 font-medium"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          {keyword && (
            <button onClick={() => setKeyword('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold">
              ✕
            </button>
          )}
        </div>

        {/* 常用热门关键词 Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[10px] text-gray-600 no-scrollbar">
          <span className="text-gray-400 font-bold flex-shrink-0">热搜:</span>
          {currentCategory.hotKeywords.map((kw) => (
            <button key={kw} onClick={() => setKeyword(kw)} className="bg-blue-50 text-[var(--sw-brand)] border border-blue-100 px-2 py-0.5 rounded-full font-medium cursor-pointer">
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* 主体左右双栏 (左侧分类 Tab，右侧商品列表) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧垂直 Category Tabs */}
        <div className="w-24 bg-gray-100/80 divide-y divide-gray-200/50 overflow-y-auto text-xs font-medium select-none flex-shrink-0">
          {MOCK_CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`w-full py-3.5 px-2 text-left relative transition-colors flex flex-col gap-0.5 cursor-pointer ${isActive ? 'bg-white font-bold text-[var(--sw-brand)] shadow-xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                {isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--sw-brand)] rounded-r" />}
                <span className="truncate">{cat.name}</span>
                <span className="text-[9px] text-gray-400 truncate font-normal">{cat.hotKeywords[0]}</span>
              </button>
            );
          })}
        </div>

        {/* 右侧商品列表区 */}
        <div className="flex-1 bg-white p-2.5 overflow-y-auto space-y-3">
          {/* Subcategory Banner/Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-2.5 rounded-xl border border-blue-100/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-gray-900">{currentCategory.name}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">企采协议补贴 · 共 {filteredProducts.length} 件福利卡可兑商品</div>
            </div>
            <span className="text-[9px] bg-[var(--sw-brand)] text-white font-bold px-2 py-0.5 rounded-full">全额包邮</span>
          </div>

          {/* Subcategories pill grid */}
          {currentCategory.subCategories && currentCategory.subCategories.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {currentCategory.subCategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setKeyword(sub.name)}
                  className="bg-gray-50 hover:bg-blue-50 hover:text-[var(--sw-brand)] border border-gray-100 rounded-lg p-1.5 text-center text-[10px] font-medium text-gray-700 truncate cursor-pointer transition-colors"
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          {/* Product Items List */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <p className="text-xs">暂无符合条件的商品</p>
              <button onClick={() => setKeyword('')} className="text-xs text-[var(--sw-brand)] underline font-bold">
                清除关键字重试
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 pb-8">
              {filteredProducts.map((p) => (
                <div key={p.id} onClick={() => setMpPage('detail', p.id)} className="bg-white rounded-xl p-2 flex gap-2.5 border border-gray-100 shadow-2xs hover:border-blue-200 transition-all cursor-pointer active:bg-gray-50">
                  <img src={p.imageUrl} alt={p.title} className="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-gray-50" />
                  <div className="flex-1 overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight">{p.title}</div>
                      <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{p.subtitle}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] bg-red-50 text-[#E5484D] font-bold px-1 py-0.2 rounded">协议价省¥{p.enterpriseSubsidyAmount}</span>
                        <span className="text-[9px] bg-blue-50 text-[var(--sw-brand)] font-bold px-1 py-0.2 rounded">支持福利卡</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-xs font-black text-[#E5484D] font-mono">¥{p.price}</span>
                          <span className="text-[9px] text-gray-400 line-through ml-1">¥{p.originalPrice}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p, 1);
                          }}
                          className="bg-[var(--sw-brand)] text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                          <span>加购物车</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WeChatTabBar />
    </div>
  );
};
