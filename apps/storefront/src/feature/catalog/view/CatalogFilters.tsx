import type { useCatalogViewModel } from '../viewmodel/CatalogViewModel';
import { CategorySelector } from './CategorySelector';

export function CatalogFilters({ viewmodel, heading = true }: Readonly<{ viewmodel: ReturnType<typeof useCatalogViewModel>; heading?: boolean }>) {
  const { presentationCategories: categories, filters, updateFilters, resetFilters } = viewmodel;
  return (
    <div>
      {heading ? <h2 className="font-black">筛选商品</h2> : null}
      <div className="mt-4">
        <CategorySelector categories={categories} selected={filters.category} onSelect={(category) => updateFilters({ category })} />
      </div>
      <div className="mt-4 space-y-3 border-t pt-4">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>仅看餐卡可用</span>
          <input type="checkbox" checked={filters.mealOnly} onChange={(event) => updateFilters({ mealOnly: event.target.checked })} />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>仅看企业专享</span>
          <input type="checkbox" checked={filters.subsidyOnly} onChange={(event) => updateFilters({ subsidyOnly: event.target.checked })} />
        </label>
        <button type="button" onClick={resetFilters} className="min-h-11 w-full whitespace-nowrap rounded-xl border font-bold hover:bg-subtle">
          清除筛选
        </button>
      </div>
    </div>
  );
}
