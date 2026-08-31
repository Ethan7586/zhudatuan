import React, { useState } from 'react';
import { useCatalogRuntime } from '../application/CatalogRuntime';
import type { LaptopPage } from '../../../shared/manifest/StorefrontRoute';
import type { FrontendProduct } from '../infrastructure/CatalogMapper';
import { ChevronDown, ChevronUp, ShoppingCart, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { defaultStorefrontWebPage, type StorefrontWebSurface } from '../../../shared/ui/StorefrontPresentation';
import { keyboardAction } from '../../../shared/ui/KeyboardAction';
import { useNavigate } from 'react-router';
interface LaptopCategoryPageProps {
  onSelectTab: (tab: LaptopPage) => void;
  surface?: StorefrontWebSurface;
}
export const LaptopCategoryPage: React.FC<LaptopCategoryPageProps> = ({ onSelectTab, surface = 'standard' }) => {
  const navigate = useNavigate();
  const { addToCart, presentationProducts: products, presentationCategories, filters, updateFilters, resetFilters, hasMore, isLoadingMore, loadMore } = useCatalogRuntime();
  const homePage = defaultStorefrontWebPage(surface);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState<boolean>(false);
  const { category: filterCategory, mealOnly: allowMealCardOnly, subsidyOnly, sort: sortBy } = filters;
  const priceRange = [filters.minimum, filters.maximum] as const;
  // Filter products
  let filtered = products.filter((p) => {
    if (filterCategory !== 'all' && p.categoryId !== filterCategory) return false;
    if (allowMealCardOnly && !p.allowMealCard) return false;
    if (subsidyOnly && !p.isEnterpriseSubsidized) return false;
    if (p.welfarePrice < priceRange[0] || p.welfarePrice > priceRange[1]) return false;
    return true;
  });
  // Sort products
  if (sortBy === 'sales') {
    filtered = [...filtered].sort((a, b) => b.salesVolume - a.salesVolume);
  } else if (sortBy === 'priceasc') {
    filtered = [...filtered].sort((a, b) => a.welfarePrice - b.welfarePrice);
  } else if (sortBy === 'pricedesc') {
    filtered = [...filtered].sort((a, b) => b.welfarePrice - a.welfarePrice);
  }
  const handleAddToCart = (product: FrontendProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };
  return (
    <div className="w-full bg-[var(--sw-background)] min-h-[80vh] pb-8 font-sans">
      <div className="sw-web-container max-w-[1240px] mx-auto pt-3 px-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2.5">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onSelectTab(homePage)} className="hover:text-[var(--sw-brand)] cursor-pointer">
              首页
            </button>
            <span>&gt;</span>
            <span className="font-bold text-gray-800">商品分类与企采搜索结果</span>
          </div>
          <div className="text-[11px] text-gray-400">
            已加载 <span className="font-bold text-[var(--sw-brand)]">{filtered.length}</span> 件符合条件商品
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <div className={`sw-web-filter-sidebar transition-all duration-300 flex-shrink-0 bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden ${isFilterCollapsed ? 'is-collapsed w-[48px]' : 'w-[200px]'}`}>
            <div className="bg-[var(--sw-brand-dark)] text-white p-2.5 flex items-center justify-between text-xs font-bold">
              {!isFilterCollapsed && (
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-yellow-300" />
                  <span>多维筛选条件</span>
                </div>
              )}
              <button onClick={() => setIsFilterCollapsed(!isFilterCollapsed)} className="hover:bg-white/20 rounded p-1 transition-colors cursor-pointer text-white" title={isFilterCollapsed ? '展开筛选' : '折叠筛选'}>
                {isFilterCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
            {!isFilterCollapsed && (
              <div className="p-3 space-y-3.5 text-xs">
                <div>
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center justify-between">
                    <span>商品类别</span>
                    <span className="text-[9px] text-gray-400">全库</span>
                  </div>
                  <div className="space-y-1">
                    {[{ id: 'all', name: '全部商品' }, ...presentationCategories].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => updateFilters({ category: item.id })}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                          filterCategory === item.id ? 'bg-[var(--sw-brand)] text-white font-bold' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="font-bold text-gray-800 mb-1.5">账户可抵扣范围</div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-700">
                      <input type="checkbox" checked={allowMealCardOnly} onChange={(e) => updateFilters({ mealOnly: e.target.checked })} className="rounded text-[var(--sw-brand)] focus:ring-[var(--sw-brand)]" />
                      <span>仅看支持餐卡商品</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-700">
                      <input type="checkbox" checked={subsidyOnly} onChange={(e) => updateFilters({ subsidyOnly: e.target.checked })} className="rounded text-[var(--sw-brand)] focus:ring-[var(--sw-brand)]" />
                      <span>仅看企业专项补贴</span>
                    </label>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="font-bold text-gray-800 mb-1.5">福利价区间 (元)</div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={(e) => updateFilters({ minimum: Number(e.target.value) }, true)}
                      className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-center outline-none focus:border-[var(--sw-brand)]"
                      placeholder="0"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) => updateFilters({ maximum: Number(e.target.value) }, true)}
                      className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-center outline-none focus:border-[var(--sw-brand)]"
                      placeholder="5000"
                    />
                  </div>
                </div>
                <button onClick={resetFilters} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors">
                  <RotateCcw className="w-3 h-3" />
                  <span>重置所有筛选</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-500 mr-1">排序规则:</span>
                <button
                  onClick={() => updateFilters({ sort: 'default' })}
                  className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${sortBy === 'default' ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  综合排序
                </button>
                <button
                  onClick={() => updateFilters({ sort: 'sales' })}
                  className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${sortBy === 'sales' ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  已加载销量
                </button>
                <button
                  onClick={() => updateFilters({ sort: sortBy === 'priceasc' ? 'pricedesc' : 'priceasc' })}
                  className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${sortBy.startsWith('price') ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  已加载价格 {sortBy === 'priceasc' ? '↑' : sortBy === 'pricedesc' ? '↓' : ''}
                </button>
              </div>
              <div className="text-[11px] text-gray-500 flex items-center gap-2">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">开票资格以订单记录为准</span>
              </div>
            </div>
            <div className="sw-web-category-product-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  onClick={() => void navigate(`/products/${encodeURIComponent(product.id)}`)}
                  onKeyDown={(event) => keyboardAction(event, () => void navigate(`/products/${encodeURIComponent(product.id)}`))}
                  role="button"
                  tabIndex={0}
                  className="bg-white border border-gray-200 hover:border-[var(--sw-brand)] rounded-lg p-2.5 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    <span className="bg-[var(--sw-promotion)] text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs">福利价</span>
                    {product.allowMealCard && <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs">餐卡支持</span>}
                  </div>
                  <div>
                    <div className="sw-web-category-product-media w-full h-[125px] rounded-md overflow-hidden bg-gray-50 mb-2 flex items-center justify-center p-1">
                      {product.image ? (
                        <img src={product.image} alt={product.title} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="text-[10px] text-gray-400">暂无商品图片</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                      {product.supplierName ? <span className="bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-medium">{product.supplierName}</span> : null}
                      <span className="text-blue-600 font-medium">{product.deliverySla || '履约以订单为准'}</span>
                    </div>
                    <h3 className="font-bold text-xs text-gray-800 group-hover:text-[var(--sw-brand)] line-clamp-2 leading-tight min-h-[32px]">{product.title}</h3>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold text-[var(--sw-promotion)]">¥</span>
                        <span className="text-base font-black text-[var(--sw-promotion)] leading-none">{product.welfarePrice.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 line-through mt-0.5">参考价 ¥{product.marketPrice.toFixed(2)}</div>
                    </div>
                    <button
                      disabled={!product.purchasable}
                      onClick={(e) => handleAddToCart(product, e)}
                      className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-2xs flex-shrink-0 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>加购物车</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {hasMore ? (
              <button type="button" disabled={isLoadingMore} onClick={() => void loadMore()} className="mx-auto block rounded-full border border-blue-200 bg-white px-5 py-2 text-xs font-bold text-[var(--sw-brand)] disabled:opacity-50">
                {isLoadingMore ? '正在加载…' : '继续加载商品'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
