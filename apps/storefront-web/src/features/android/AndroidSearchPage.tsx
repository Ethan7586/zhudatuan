import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { AndroidStatusBar } from '../../components/mobile/AndroidStatusBar';
import { AndroidBottomNav } from '../../components/mobile/AndroidBottomNav';
import { Search, SlidersHorizontal, X, History, Trash2, Plus, ArrowUpDown, Filter, Check } from 'lucide-react';

export const AndroidSearchPage: React.FC = () => {
  const { setAndroidPage, addToCart, triggerPendingFeature, presentationProducts: MOCK_PRODUCTS } = useMall();
  const [keyword, setKeyword] = useState('');
  const [searchHistory, setSearchHistory] = useState(['星巴克代金券', '五常大米', '戴森吹风机', '影音通兑']);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<'all' | 'welfare' | 'meal'>('all');
  const [maxPrice, setMaxPrice] = useState<number>(1000);

  const filteredProducts = MOCK_PRODUCTS.filter((p) => {
    const matchKw = !keyword || p.title.includes(keyword) || p.subtitle?.includes(keyword) || p.brand?.includes(keyword);
    const matchPrice = p.price <= maxPrice;
    const matchType = selectedAccountType === 'all' || (selectedAccountType === 'meal' ? p.categoryId === 'cat_food' : p.isEnterpriseExclusive);
    return matchKw && matchPrice && matchType;
  });

  const handleSearchSubmit = (term: string) => {
    setKeyword(term);
    if (term && !searchHistory.includes(term)) {
      setSearchHistory((prev) => [term, ...prev.slice(0, 5)]);
    }
  };

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800 relative">
      <AndroidStatusBar title="搜索福利商品" showBack={true} onBack={() => setAndroidPage('home')} />

      {/* Android Search Input Bar */}
      <div className="bg-[var(--sw-brand-dark)] px-3 pb-3 pt-1">
        <div className="bg-white rounded-2xl p-1.5 flex items-center gap-2 shadow-md">
          <Search className="w-4 h-4 text-gray-400 ml-1.5 flex-shrink-0" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(keyword)}
            placeholder="在企采福利库中搜索..."
            className="w-full text-xs text-gray-900 placeholder-gray-400 focus:outline-none font-medium"
          />
          {keyword && (
            <button onClick={() => setKeyword('')} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => handleSearchSubmit(keyword)} className="bg-[var(--sw-brand)] text-white font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex-shrink-0">
            搜索
          </button>
        </div>
      </div>

      {/* History & Filter Chips Section */}
      <div className="p-3 space-y-3 flex-1 overflow-y-auto pb-16">
        {/* Search History Chips */}
        {!keyword && (
          <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-gray-400" />
                搜索历史
              </span>
              <button onClick={() => setSearchHistory([])} className="hover:text-red-500 cursor-pointer p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {searchHistory.map((term) => (
                <button key={term} onClick={() => handleSearchSubmit(term)} className="bg-gray-100 hover:bg-blue-50 hover:text-[var(--sw-brand)] text-gray-700 text-xs px-3 py-1 rounded-full cursor-pointer transition-colors">
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar & Bottom Sheet Trigger */}
        <div className="bg-white rounded-2xl p-2.5 shadow-2xs border border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-[var(--sw-brand)]">综合排序</span>
            <span className="text-gray-400">销量榜</span>
            <span className="text-gray-400">价格区间</span>
          </div>

          <button onClick={() => setShowBottomSheet(true)} className="bg-blue-50 text-[var(--sw-brand)] border border-blue-200 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>筛选 Bottom Sheet</span>
          </button>
        </div>

        {/* Filter Results List */}
        <div className="space-y-2">
          <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between px-1">
            <span>
              为您找到 <span className="text-[var(--sw-brand)] font-bold">{filteredProducts.length}</span> 件相关企采福利商品
            </span>
            <span>可用福利卡/餐卡抵扣</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2 bg-white rounded-3xl p-6">
              <p className="text-xs">未找到搜索结果</p>
              <button
                onClick={() => {
                  setKeyword('');
                  setMaxPrice(1000);
                }}
                className="text-xs text-[var(--sw-brand)] font-bold underline"
              >
                重置筛选条件
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredProducts.map((p) => (
                <div key={p.id} onClick={() => setAndroidPage('detail', p.id)} className="bg-white rounded-3xl p-3 shadow-2xs border border-gray-100 flex gap-3 cursor-pointer active:bg-gray-50 transition-colors">
                  <img src={p.imageUrl} alt={p.title} className="w-20 h-20 object-cover rounded-2xl flex-shrink-0 bg-gray-50" />
                  <div className="flex-1 overflow-hidden flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 line-clamp-1">{p.title}</h3>
                      <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{p.subtitle}</p>
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
                        className="bg-[var(--sw-brand)] text-white text-[10px] font-bold px-3 py-1 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>加入购物车</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Material 3 Bottom Sheet Modal */}
      {showBottomSheet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl max-w-[430px] w-full p-4 space-y-4 shadow-2xl border-t border-gray-200 animate-in slide-in-from-bottom duration-300">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-black text-sm text-gray-900">Material 3 属性与预算筛选</h3>
              <button onClick={() => setShowBottomSheet(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">账户支付抵扣方式</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'all', label: '全部商品' },
                  { id: 'welfare', label: '福利卡专享' },
                  { id: 'meal', label: '餐卡专区' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedAccountType(opt.id as any)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${selectedAccountType === opt.id ? 'bg-blue-50 border-[var(--sw-brand)] text-[var(--sw-brand)]' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Slider Filter */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-700">
                <span>最大预算区间</span>
                <span className="text-[var(--sw-brand)] font-mono">¥{maxPrice} 以内</span>
              </div>
              <input type="range" min="50" max="3000" step="50" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-[var(--sw-brand)] cursor-pointer" />
            </div>

            {/* Apply Button */}
            <button onClick={() => setShowBottomSheet(false)} className="w-full bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-2xl shadow-md cursor-pointer">
              完成并应用筛选
            </button>
          </div>
        </div>
      )}

      <AndroidBottomNav />
    </div>
  );
};
