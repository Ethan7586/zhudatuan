import { Filter, Plus, Search, ShieldCheck, X } from 'lucide-react';
import type { useCatalogViewModel } from '../viewmodel/CatalogViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';

export function CatalogPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useCatalogViewModel> }>) {
  const { presentationProducts: products, presentationCategories: categories, filters, updateFilters, resetFilters, hasMore, isLoadingMore, loadMore, filterOpen, actions } = viewmodel;
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1240px]">
        <nav className="mb-3 text-xs text-muted">
          <button type="button" onClick={actions.home} className="font-bold text-brand">
            首页
          </button>
          <span className="px-2">/</span>商品分类
        </nav>
        <header className="rounded-3xl bg-gradient-to-r from-brand-ink to-brand p-5 text-inverse shadow-lg">
          <h1 className="text-2xl font-black">发现企业福利好物</h1>
          <p className="mt-2 text-sm text-inverse-label">筛选项直接写入链接；刷新或分享后仍能恢复。</p>
          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-surface px-4 text-content">
            <Search size={18} className="text-muted" />
            <input aria-label="搜索商品" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value }, true)} className="min-w-0 flex-1 outline-none" placeholder="搜索商品、品牌或分类" />
            <button type="button" onClick={actions.toggleFilters} className="lg:hidden" aria-label="打开筛选">
              <Filter size={18} />
            </button>
          </label>
        </header>
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className={`${filterOpen ? 'fixed inset-0 z-50 overflow-auto bg-surface p-5' : 'hidden'} rounded-3xl border border-edge bg-surface p-4 shadow-sm lg:static lg:block`}>
            <div className="flex items-center justify-between">
              <h2 className="font-black">筛选商品</h2>
              <button type="button" onClick={actions.toggleFilters} className="lg:hidden" aria-label="关闭筛选">
                <X />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => updateFilters({ category: 'all' })}
                className={`min-h-11 w-full rounded-xl px-3 text-left text-sm ${filters.category === 'all' ? 'bg-brand font-bold text-inverse' : 'hover:bg-brand-light'}`}
              >
                全部商品
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => updateFilters({ category: category.id })}
                  className={`min-h-11 w-full rounded-xl px-3 text-left text-sm ${filters.category === category.id ? 'bg-brand font-bold text-inverse' : 'hover:bg-brand-light'}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t pt-4">
              <label className="flex min-h-11 items-center justify-between text-sm">
                仅看餐卡可用
                <input type="checkbox" checked={filters.mealOnly} onChange={(event) => updateFilters({ mealOnly: event.target.checked })} />
              </label>
              <label className="flex min-h-11 items-center justify-between text-sm">
                仅看企业专享
                <input type="checkbox" checked={filters.subsidyOnly} onChange={(event) => updateFilters({ subsidyOnly: event.target.checked })} />
              </label>
              <button type="button" onClick={resetFilters} className="min-h-11 w-full rounded-xl border font-bold">
                清除筛选
              </button>
            </div>
          </aside>
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-black">可购商品</h2>
                <p className="text-xs text-muted">已加载 {products.length} 件</p>
              </div>
              <button type="button" onClick={actions.toggleFilters} className="rounded-xl border bg-surface px-3 py-2 text-xs font-bold lg:hidden">
                <Filter size={14} className="inline" /> 筛选
              </button>
            </div>
            {products.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <article key={product.id} className="overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm">
                    <button type="button" onClick={() => actions.openProduct(product.id)} className="block w-full text-left">
                      <ProductMedia source={product.image} alt={product.title} className="aspect-square w-full object-cover" emptyClassName="grid aspect-square place-items-center bg-subtle text-xs text-muted" />
                      <div className="p-3">
                        <h3 className="line-clamp-2 min-h-10 text-sm font-bold">{product.title}</h3>
                        <span className="mt-2 flex items-center gap-1 text-[10px] text-success-strong">
                          <ShieldCheck size={12} />
                          {product.purchasable ? '库存与资格有效' : '暂不可购买'}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center justify-between px-3 pb-3">
                      <b className="text-danger">¥{formatMinor(product.priceWelfareMinor)}</b>
                      <button
                        type="button"
                        disabled={!product.purchasable}
                        onClick={() => viewmodel.addToCart(product, 1)}
                        aria-label={`将${product.title}加入购物车`}
                        className="grid h-10 w-10 place-items-center rounded-full bg-brand text-inverse disabled:bg-disabled"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div role="status" className="grid min-h-64 place-items-center rounded-3xl border border-dashed bg-surface text-sm text-muted">
                没有符合条件的商品，请清除筛选后重试
              </div>
            )}
            {hasMore ? (
              <button type="button" disabled={isLoadingMore} onPointerEnter={() => void loadMore()} onClick={() => void loadMore()} className="mt-4 min-h-11 w-full rounded-2xl border bg-surface font-bold text-brand disabled:opacity-50">
                {isLoadingMore ? '正在加载…' : '加载更多'}
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
