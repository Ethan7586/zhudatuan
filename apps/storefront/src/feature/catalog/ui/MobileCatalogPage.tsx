import { Check, Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { useCatalogRuntime } from '../application/CatalogRuntime';
import type { MobileChannel } from '../../../shared/manifest/StorefrontChannel';
import { useNavigate } from 'react-router';

export function MobileCatalogPage({ channel }: { readonly channel: MobileChannel }) {
  const { presentationProducts, presentationCategories, addToCart, filters, updateFilters, hasMore, isLoadingMore, loadMore } = useCatalogRuntime();
  const navigate = useNavigate();
  const { query, category } = filters;
  const products = useMemo(() => presentationProducts.filter((item) => (category === 'all' || item.categoryId === category) && item.title.toLowerCase().includes(query.trim().toLowerCase())), [category, presentationProducts, query]);
  return (
    <div className="min-h-[70dvh] bg-white">
      <div className="sticky top-[87px] z-30 space-y-2 border-b bg-white px-3 py-3">
        <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
          <Search size={17} className="text-slate-400" />
          <input value={query} onChange={(event) => updateFilters({ query: event.target.value }, true)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={channel === 'android' ? '搜索福利商品' : '搜索商城商品'} />
          <SlidersHorizontal size={17} className="text-slate-500" />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button type="button" onClick={() => updateFilters({ category: 'all' })} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            全部
          </button>
          {presentationCategories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => updateFilters({ category: item.id })}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === item.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-3 text-xs">
        <span className="font-bold">已加载 {products.length} 件企业可见商品</span>
        <span className="flex items-center gap-1 text-slate-500">
          <Filter size={14} />
          综合排序
        </span>
      </div>
      {products.length === 0 ? (
        <div className="grid min-h-56 place-items-center text-center text-sm text-slate-500">
          <div>
            <Search className="mx-auto mb-2 text-slate-300" size={34} />
            没有匹配的商品
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 px-3 pb-4">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <button type="button" className="w-full text-left" onClick={() => void navigate(`/products/${encodeURIComponent(product.id)}`)}>
                {product.image ? <img src={product.image} alt="" className="aspect-square w-full object-cover" /> : <span className="grid aspect-square w-full place-items-center bg-slate-50 text-[10px] text-slate-400">暂无商品图片</span>}
                <div className="p-2">
                  <h2 className="line-clamp-2 min-h-9 text-xs font-bold leading-[18px]">{product.title}</h2>
                  <div className={`mt-1 flex items-center gap-1 text-[9px] ${product.purchasable ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Check size={11} />
                    {product.purchasable ? '当前可购买' : '当前不可购买'}
                  </div>
                </div>
              </button>
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="font-black text-red-500">¥{product.price.toFixed(2)}</span>
                <button type="button" disabled={!product.purchasable} className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300" onClick={() => addToCart(product)} aria-label="加入购物车">
                  <Plus size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMore ? (
        <button type="button" disabled={isLoadingMore} onClick={() => void loadMore()} className="mx-auto mb-5 block rounded-full border border-blue-200 px-5 py-2 text-xs font-bold text-blue-600 disabled:opacity-50">
          {isLoadingMore ? '正在加载…' : '继续加载商品'}
        </button>
      ) : null}
    </div>
  );
}
