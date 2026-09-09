import { ArrowRight, BadgeCheck, Sparkles } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { ProductCard } from '../../../entity/product';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { responsivePattern } from '../../../shared/view/ResponsivePattern';
import { CategoryGrid } from './CategoryGrid';

export function DefaultHome({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const products = viewmodel.presentationProducts.slice(0, 8);
  const campaignProduct = products.find(({ image }) => image?.trim().length > 0);
  return (
    <>
      <section aria-labelledby="storefront-campaign-title" className="relative min-h-44 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand to-brand-dark p-5 text-inverse sm:min-h-56 sm:p-8">
        <Sparkles className="absolute -right-10 -top-10 h-48 w-48 opacity-15" aria-hidden="true" />
        {campaignProduct ? (
          <ProductMedia
            source={campaignProduct.image}
            alt=""
            className="absolute -bottom-5 -right-5 h-40 w-40 rotate-3 rounded-[2rem] object-cover opacity-90 ring-4 ring-surface/20 sm:bottom-[-2rem] sm:right-5 sm:h-64 sm:w-64"
            emptyClassName="hidden"
          />
        ) : null}
        <div className="relative z-10 max-w-[65%] sm:max-w-[58%]">
          <p className="flex items-center gap-1 text-[11px] font-bold text-inverse-label sm:text-xs">
            <BadgeCheck size={15} aria-hidden="true" />
            {viewmodel.currentMall.enterpriseName} · 员工专享
          </p>
          <h1 id="storefront-campaign-title" className="mt-2 text-2xl font-black leading-tight sm:text-4xl">
            员工专享福利季
          </h1>
          <p className="mt-2 text-xs leading-5 text-inverse-label sm:mt-3 sm:text-sm sm:leading-6">严选好物与专属权益，价格、库存和购买资格实时核验，安心选购。</p>
          <button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-black text-brand-dark hover:bg-brand-faint sm:mt-6">
            进入福利专区
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </section>
      <CategoryGrid viewmodel={viewmodel} layout="scenes" />
      <section className="rounded-3xl border border-edge bg-surface p-3 shadow-sm sm:p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">员工严选</h2>
            <p className="text-xs text-muted">当前账号可见、可购商品</p>
          </div>
          <button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="text-xs font-bold text-brand">
            查看全部
          </button>
        </div>
        {products.length ? (
          <div className={responsivePattern.productGrid}>
            {products.map((product) => (
              <ProductCard key={product.listingId} product={product} open={viewmodel.openProduct} add={(item) => viewmodel.addToCart(item, 1)} />
            ))}
          </div>
        ) : (
          <div role="status" className="grid min-h-40 place-items-center rounded-2xl border border-dashed text-sm text-muted">
            {viewmodel.catalogState === 'loading' ? '正在同步商品…' : '当前商城尚未发布商品'}
          </div>
        )}
      </section>
    </>
  );
}
