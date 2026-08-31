import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { useCatalogRuntime } from '../application/CatalogRuntime';
import { useNavigate } from 'react-router';

export function TabletCatalogPage() {
  const { presentationProducts, presentationCategories, addToCart, filters, updateFilters, hasMore, isLoadingMore, loadMore } = useCatalogRuntime();
  const navigate = useNavigate();
  const { query, category } = filters;
  const products = useMemo(() => presentationProducts.filter((item) => (category === 'all' || item.categoryId === category) && item.title.includes(query.trim())), [category, presentationProducts, query]);
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-[190px_1fr]">
      <aside className="border-r bg-white p-4">
        <h1 className="text-lg font-black">商品分类</h1>
        <div className="mt-4 space-y-1">
          <button type="button" onClick={() => updateFilters({ category: 'all' })} className={`w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold ${category === 'all' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}>
            全部商品
          </button>
          {presentationCategories.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => updateFilters({ category: item.id })}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold ${category === item.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </aside>
      <section className="p-5">
        <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input value={query} onChange={(event) => updateFilters({ query: event.target.value }, true)} className="min-w-0 flex-1 outline-none" placeholder="搜索商品" />
          <SlidersHorizontal size={18} />
        </label>
        <div className="my-4 flex items-center justify-between">
          <div>
            <h2 className="font-black">{category === 'all' ? '全部商品' : presentationCategories.find((item) => item.id === category)?.name}</h2>
            <p className="text-xs text-slate-500">已加载 {products.length} 个结果</p>
          </div>
          <span className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
            <Filter size={15} />
            筛选条件已同步至地址栏
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <button type="button" className="w-full text-left" onClick={() => void navigate(`/products/${encodeURIComponent(product.id)}`)}>
                {product.image ? <img src={product.image} alt="" className="aspect-square w-full object-cover" /> : <span className="grid aspect-square w-full place-items-center bg-slate-50 text-[10px] text-slate-400">暂无商品图片</span>}
                <div className="p-3">
                  <div className="line-clamp-2 min-h-10 text-sm font-bold">{product.title}</div>
                </div>
              </button>
              <div className="flex items-center justify-between px-3 pb-3">
                <b className="text-red-500">¥{product.price.toFixed(2)}</b>
                <button type="button" disabled={!product.purchasable} onClick={() => addToCart(product)} className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300" aria-label="加入购物车">
                  <Plus size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {hasMore ? (
          <button type="button" disabled={isLoadingMore} onClick={() => void loadMore()} className="mx-auto mt-5 block rounded-full border border-blue-200 bg-white px-5 py-2 text-xs font-bold text-blue-600 disabled:opacity-50">
            {isLoadingMore ? '正在加载…' : '继续加载商品'}
          </button>
        ) : null}
      </section>
    </div>
  );
}
