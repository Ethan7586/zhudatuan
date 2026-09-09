import { BriefcaseBusiness, Building2, Gift, HeartPulse, House, Laptop, ShoppingBag, Utensils } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';

const ICONS = Object.freeze([Building2, House, Gift, ShoppingBag, HeartPulse, Laptop, Utensils, BriefcaseBusiness]);
const TONES = Object.freeze(['bg-brand-light text-brand', 'bg-success-surface text-success-strong', 'bg-warning-surface text-warning-strong', 'bg-danger-surface text-danger-strong']);

export function CategoryGrid({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const categories = viewmodel.presentationCategories.slice(0, 8);
  if (categories.length === 0) return null;
  return (
    <aside className="order-2 rounded-3xl border border-edge bg-surface p-3 shadow-sm lg:order-1 lg:p-4">
      <div className="mb-2 flex items-center justify-between lg:mb-3">
        <div className="flex items-center gap-2 font-black">
          <Gift size={18} className="text-brand" />
          福利分类
        </div>
        <button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="min-h-9 rounded-full px-2 text-xs font-bold text-brand lg:hidden">
          全部商品
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-1 lg:gap-1">
        {categories.map((category, index) => {
          const Icon = ICONS[index % ICONS.length]!;
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => viewmodel.openCategory(category.id)}
              title={category.name}
              className="group flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center rounded-2xl px-1 text-center hover:bg-brand-light lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-2 lg:text-left"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[index % TONES.length]}`}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="mt-1 min-w-0 max-w-full lg:mt-0">
                <b className="block truncate text-[11px] lg:text-xs">{category.name}</b>
                <span className="hidden truncate text-[10px] font-normal text-muted lg:block">{category.description || '当前商城已发布'}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
