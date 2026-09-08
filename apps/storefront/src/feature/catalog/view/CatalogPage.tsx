import { Drawer } from '@shop/design';
import { Filter, Search } from 'lucide-react';
import type { useCatalogViewModel } from '../viewmodel/CatalogViewModel';
import { ProductCard } from '../../../entity/product';
import { responsivePattern } from '../../../shared/view/ResponsivePattern';

export function CatalogPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useCatalogViewModel> }>) {
  const { presentationProducts: products, state, filters, updateFilters, hasMore, isLoadingMore, loadMore, filterOpen, actions } = viewmodel;
  return (
    <div className={responsivePattern.page}>
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
            <button type="button" onClick={actions.openFilters} className="grid h-11 w-11 shrink-0 place-items-center lg:hidden" aria-label="打开筛选">
              <Filter size={18} />
            </button>
          </label>
        </header>
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="hidden rounded-3xl border border-edge bg-surface p-4 shadow-sm lg:block">
            <CatalogFilters viewmodel={viewmodel} />
          </aside>
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-black">可购商品</h2>
                <p className="text-xs text-muted">已加载 {products.length} 件</p>
              </div>
              <button type="button" onClick={actions.openFilters} className="min-h-11 rounded-xl border bg-surface px-3 py-2 text-xs font-bold lg:hidden" aria-label="筛选商品">
                <Filter size={14} className="inline" /> 筛选
              </button>
            </div>
            {state === 'loading' ? <div role="status" className="grid min-h-64 place-items-center rounded-3xl border bg-surface text-sm text-muted">正在读取商品、价格、库存与经营资格…</div> : state === 'error' ? (
              <div role="alert" className="grid min-h-64 place-items-center rounded-3xl border border-warning bg-warning-surface p-6 text-center text-sm text-warning-strong">
                <div><b>商品暂时读取失败</b><p className="mt-2">请检查网络后重试，已选择的筛选条件不会丢失。</p><button type="button" onClick={() => void viewmodel.refresh()} className="mt-4 min-h-11 rounded-xl bg-brand px-5 font-bold text-inverse">重新读取</button></div>
              </div>
            ) : products.length ? (
              <div className={responsivePattern.productGrid}>
                {products.map((product) => (
                  <ProductCard key={product.listingId} product={product} open={actions.openProduct} add={(item) => viewmodel.addToCart(item, 1)} />
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
      <Drawer open={filterOpen} title="筛选商品" onClose={actions.closeFilters}>
        <CatalogFilters viewmodel={viewmodel} heading={false} />
      </Drawer>
    </div>
  );
}

function CatalogFilters({ viewmodel, heading = true }: Readonly<{ viewmodel: ReturnType<typeof useCatalogViewModel>; heading?: boolean }>) {
  const { presentationCategories: categories, filters, updateFilters, resetFilters } = viewmodel;
  return (
    <div>
      {heading ? <h2 className="font-black">筛选商品</h2> : null}
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
    </div>
  );
}
