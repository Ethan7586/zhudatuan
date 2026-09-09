import { Drawer } from '@shop/design';
import { Filter } from 'lucide-react';
import type { useCatalogViewModel } from '../viewmodel/CatalogViewModel';
import { ProductCard } from '../../../entity/product';
import { responsivePattern } from '../../../shared/view/ResponsivePattern';
import { CatalogSearch } from './CatalogSearch';
import { CategorySelector } from './CategorySelector';
import { CatalogFilters } from './CatalogFilters';

export function CatalogPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useCatalogViewModel> }>) {
  const { presentationProducts: products, state, filters, updateFilters, hasMore, isLoadingMore, loadMore, filterOpen, actions } = viewmodel;
  return (
    <div className={responsivePattern.page}>
      <div className="mx-auto max-w-[1240px]">
        <nav className="mb-3 hidden text-xs text-muted lg:block">
          <button type="button" onClick={actions.home} className="font-bold text-brand">
            首页
          </button>
          <span className="px-2">/</span>商品分类
        </nav>
        <header data-catalog-layout="desktop" className="hidden rounded-3xl bg-gradient-to-r from-brand-ink to-brand p-5 text-inverse shadow-lg lg:block">
          <h1 className="text-2xl font-black">发现企业福利好物</h1>
          <p className="mt-2 text-sm text-inverse-label">筛选项直接写入链接；刷新或分享后仍能恢复。</p>
          <div className="mt-4">
            <CatalogSearch query={filters.query} onQuery={(query) => updateFilters({ query }, true)} tone="hero" />
          </div>
        </header>
        <header data-catalog-layout="mobile" className="space-y-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-content">商品分类</h1>
              <p className="mt-0.5 text-xs text-muted">按分类和购买资格快速找到福利商品</p>
            </div>
            <button type="button" onClick={actions.openFilters} className="flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-edge bg-surface px-3 text-xs font-bold" aria-label="筛选商品">
              <Filter size={15} aria-hidden="true" />
              筛选
            </button>
          </div>
          <CatalogSearch query={filters.query} onQuery={(query) => updateFilters({ query }, true)} onFilters={actions.openFilters} />
          <div role="group" aria-label="快捷筛选" className="flex gap-2 overflow-x-auto pb-0.5">
            <QuickFilter active={filters.mealOnly} onClick={() => updateFilters({ mealOnly: !filters.mealOnly })} label="餐卡可用" />
            <QuickFilter active={filters.subsidyOnly} onClick={() => updateFilters({ subsidyOnly: !filters.subsidyOnly })} label="企业专享" />
          </div>
        </header>
        <div className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-4">
          <aside className="sticky top-36 min-w-0 lg:hidden">
            <CategorySelector categories={viewmodel.presentationCategories} selected={filters.category} onSelect={(category) => updateFilters({ category })} mode="rail" />
          </aside>
          <aside className="hidden rounded-3xl border border-edge bg-surface p-4 shadow-sm lg:block">
            <CatalogFilters viewmodel={viewmodel} />
          </aside>
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-black lg:text-lg">可购商品</h2>
                <p className="text-xs text-muted">已加载 {products.length} 件</p>
              </div>
            </div>
            {state === 'loading' ? (
              <div role="status" className="grid min-h-64 place-items-center rounded-3xl border bg-surface text-sm text-muted">
                正在读取商品、价格、库存与经营资格…
              </div>
            ) : state === 'error' ? (
              <div role="alert" className="grid min-h-64 place-items-center rounded-3xl border border-warning bg-warning-surface p-6 text-center text-sm text-warning-strong">
                <div>
                  <b>商品暂时读取失败</b>
                  <p className="mt-2">请检查网络后重试，已选择的筛选条件不会丢失。</p>
                  <button type="button" onClick={() => void viewmodel.refresh()} className="mt-4 min-h-11 rounded-xl bg-brand px-5 font-bold text-inverse">
                    重新读取
                  </button>
                </div>
              </div>
            ) : products.length ? (
              <div className={`${responsivePattern.productGrid} gap-2 sm:gap-3`}>
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

function QuickFilter({ active, onClick, label }: Readonly<{ active: boolean; onClick: () => void; label: string }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-bold ${active ? 'border-brand bg-brand text-inverse' : 'border-edge bg-surface text-secondary'}`}
    >
      {label}
    </button>
  );
}
