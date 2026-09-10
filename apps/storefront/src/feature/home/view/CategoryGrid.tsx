import { Gift } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { CategoryIcon } from './CategoryIcon';

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
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => viewmodel.openCategory(category.id)}
              title={category.name}
              className="group flex min-h-11 min-w-0 items-center justify-start gap-3 rounded-2xl px-2 text-left hover:bg-brand-light"
            >
              <CategoryIcon index={index} compact />
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
          return (
            <button key={category.id} type="button" onClick={() => viewmodel.openCategory(category.id)} className="relative min-h-24 min-w-0 overflow-hidden rounded-2xl bg-subtle p-3 text-left">
              <span className="relative z-10 block max-w-[62%]">
                <b className="block text-sm leading-5">{category.name}</b>
                <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-muted">{category.description || '当前商城已发布'}</span>
              </span>
              {product ? (
                <ProductMedia source={product.image} alt="" className="absolute -bottom-2 -right-2 h-20 w-20 rounded-2xl object-cover" emptyClassName="hidden" />
              ) : (
                <span className="absolute bottom-3 right-3">
                  <CategoryIcon index={index} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
