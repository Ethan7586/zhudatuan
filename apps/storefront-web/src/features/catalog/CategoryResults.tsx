import React from 'react';
import { Search, X, FilterX } from 'lucide-react';
import { ProductCard } from '../../components/common/ProductCard';
import type { CategoryCatalogModel } from './useCategoryCatalog';

export const CategoryResults: React.FC<{ model: CategoryCatalogModel }> = ({ model }) => {
  const { addToCart, navigateTo, compareList, setCompareList, currentPageNum, setCurrentPageNum, pageSize, finalProducts, totalPages, paginatedProducts, resetFilters, toggleCompare, viewMode } = model;
  const pageNumbers = Array.from(new Set([1, totalPages, ...Array.from({ length: 5 }, (_, index) => Math.min(totalPages, Math.max(1, currentPageNum + index - 2)))])).sort((left, right) => left - right);
  const shouldRenderComparePanel = compareList.length > 0;
  const canPaginate = totalPages > 1 && totalPages !== Infinity;
  return (
    <>
      {/* 4. 商品展示区域 (网格 vs 列表) */}
      {paginatedProducts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-12 text-center space-y-3">
          <Search className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-700">暂无匹配的商品</h3>
          <p className="text-xs text-gray-400">请尝试清空筛选条件，或从顶部分类重新进入重新发起检索。</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button onClick={() => navigateTo('home')} className="bg-[var(--sw-brand)] text-white font-bold text-xs px-4 py-2 rounded">
              回到首页继续选购
            </button>
            <button onClick={resetFilters} className="border border-gray-300 text-gray-700 font-bold text-xs px-4 py-2 rounded hover:bg-gray-50 flex items-center gap-1">
              <FilterX className="w-3.5 h-3.5" />
              清空筛选条件
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {paginatedProducts.map((p) => (
            <ProductCard key={p.id} product={p} showCompare inCompare={compareList.some((item) => item.id === p.id)} onToggleCompare={() => toggleCompare(p)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedProducts.map((p) => {
            const inCompare = compareList.some((c) => c.id === p.id);
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-md p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-blue-400 shadow-xs transition-all">
                <img src={p.images[0]} alt={p.title} className="w-28 h-28 object-cover rounded border border-gray-100 cursor-pointer" onClick={() => navigateTo('detail', { productId: p.id })} />

                <div className="flex-1 space-y-1.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="bg-[var(--sw-brand)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{p.supplierName}</span>
                    <span className="text-xs text-gray-400 font-medium">品牌: {p.brand}</span>
                  </div>

                  <h3 onClick={() => navigateTo('detail', { productId: p.id })} className="text-sm font-bold text-gray-900 cursor-pointer hover:text-[var(--sw-brand)]">
                    {p.title}
                  </h3>

                  <p className="text-xs text-gray-500 line-clamp-1">{p.subtitle}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>月销 {p.salesCount}</span>
                    <span>·</span>
                    <span className="text-green-700 font-medium">履约: {p.deliverySla}</span>
                    <span>·</span>
                    <span>库存 {p.stock} 件</span>
                  </div>
                </div>

                <div className="text-right space-y-2 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4 min-w-[180px]">
                  <div>
                    <span className="text-xs text-[#FF7A00] font-bold">福利特惠价</span>
                    <div className="text-2xl font-black text-[#FF7A00]">¥{p.priceWelfare.toFixed(2)}</div>
                    <div className="text-[11px] text-gray-400 line-through">市场价 ¥{p.priceMarket.toFixed(2)}</div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => toggleCompare(p)} className={`text-xs px-2 py-1 rounded border ${inCompare ? 'bg-blue-50 border-blue-400 text-blue-600 font-bold' : 'border-gray-200 text-gray-600'}`}>
                      {inCompare ? '已加入对比' : '+对比'}
                    </button>
                    <button
                      onClick={(event) => {
                        event.preventDefault();
                        addToCart(p, 1, p.specs?.[0] ? { [p.specs[0].name]: p.specs[0].options[0] } : {});
                      }}
                      className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
                    >
                      加入购物车
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. 分页器 (Pagination) */}
      {canPaginate && (
        <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between text-xs">
          <div className="text-gray-500">
            显示第 {(currentPageNum - 1) * pageSize + 1} - {Math.min(currentPageNum * pageSize, finalProducts.length)} 条，共 {finalProducts.length} 条
          </div>

          <div className="flex items-center gap-1.5">
            <button disabled={currentPageNum === 1} onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
              上一页
            </button>

            {pageNumbers.map((page) => (
              <button key={page} onClick={() => setCurrentPageNum(page)} className={`w-7 h-7 rounded font-bold cursor-pointer ${currentPageNum === page ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {page}
              </button>
            ))}

            <button disabled={currentPageNum === totalPages} onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 6. 底部固定对比栏 (若添加了商品对比) */}
      {shouldRenderComparePanel && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[var(--sw-brand)] shadow-2xl p-4 z-40 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">商品对比 ({compareList.length}/3)：</span>
              <div className="flex items-center gap-3">
                {compareList.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                    <img src={item.images[0]} alt="" className="w-6 h-6 rounded object-cover" />
                    <span className="font-medium truncate max-w-[120px]">{item.title}</span>
                    <span className="text-[#FF7A00] font-bold">¥{item.priceWelfare}</span>
                    <button onClick={() => toggleCompare(item)} className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setCompareList([])} className="text-gray-500 hover:underline">
                清空对比
              </button>
              <button
                onClick={() => alert(`已生成商品对比矩阵：\n` + compareList.map((c) => `· ${c.title}: 福利价¥${c.priceWelfare}, 市场价¥${c.priceMarket}, 履约:${c.deliverySla}`).join('\n'))}
                className="bg-[var(--sw-brand)] text-white font-bold px-4 py-2 rounded"
              >
                开始对比参数
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
