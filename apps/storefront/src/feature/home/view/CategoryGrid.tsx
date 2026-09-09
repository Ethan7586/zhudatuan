import { BriefcaseBusiness, Building2, Gift, HeartPulse, House, Laptop, ShoppingBag, Utensils } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';

const ICONS = Object.freeze([Building2, House, Gift, ShoppingBag, HeartPulse, Laptop, Utensils, BriefcaseBusiness]);
const TONES = Object.freeze(['bg-brand-light text-brand', 'bg-success-surface text-success-strong', 'bg-warning-surface text-warning-strong', 'bg-danger-surface text-danger-strong']);

export function CategoryGrid({ viewmodel, layout }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel>; layout: 'rail' | 'scenes' }>) {
  const categories = viewmodel.presentationCategories.slice(0, 8);
  if (categories.length === 0) return null;
  if (layout === 'scenes') return <SceneGrid viewmodel={viewmodel} />;
  return (
    <aside className="hidden rounded-3xl border border-edge bg-surface p-4 shadow-sm lg:block">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black">
          <Gift size={18} className="text-brand" />
          福利分类
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {categories.map((category, index) => {
          const Icon = ICONS[index % ICONS.length]!;
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => viewmodel.openCategory(category.id)}
              title={category.name}
              className="group flex min-h-11 min-w-0 items-center justify-start gap-3 rounded-2xl px-2 text-left hover:bg-brand-light"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[index % TONES.length]}`}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 max-w-full">
                <b className="block truncate text-xs">{category.name}</b>
                <span className="block truncate text-[10px] font-normal text-muted">{category.description || '当前商城已发布'}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SceneGrid({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const categories = viewmodel.presentationCategories.slice(0, 4);
  return (
    <section aria-labelledby="storefront-scenes-title" className="rounded-3xl border border-edge bg-surface p-3 shadow-sm lg:hidden">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="storefront-scenes-title" className="text-base font-black">
            福利场景
          </h2>
          <p className="text-[11px] text-muted">按生活场景快速找到可购商品</p>
        </div>
        <button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="min-h-11 shrink-0 rounded-xl px-2 text-xs font-bold text-brand">
          全部分类
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category, index) => {
          const product = viewmodel.presentationProducts.find(({ categoryId }) => categoryId === category.id);
          const Icon = ICONS[index % ICONS.length]!;
          return (
            <button key={category.id} type="button" onClick={() => viewmodel.openCategory(category.id)} className="relative min-h-24 min-w-0 overflow-hidden rounded-2xl bg-subtle p-3 text-left">
              <span className="relative z-10 block max-w-[62%]">
                <b className="block text-sm leading-5">{category.name}</b>
                <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-muted">{category.description || '当前商城已发布'}</span>
              </span>
              {product ? (
                <ProductMedia source={product.image} alt="" className="absolute -bottom-2 -right-2 h-20 w-20 rounded-2xl object-cover" emptyClassName="hidden" />
              ) : (
                <span className="absolute bottom-3 right-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
                  <Icon size={22} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
