import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { CategoryIcon } from './CategoryIcon';

export function CategoryShortcuts({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const categories = viewmodel.presentationCategories.slice(0, 8);
  if (categories.length === 0) return null;
  return (
    <nav aria-label="商品快捷分类" className="hidden rounded-2xl bg-surface p-2 lg:grid lg:grid-cols-4 lg:gap-1 xl:grid-cols-8">
      {categories.map((category, index) => (
        <button
          type="button"
          key={category.id}
          onClick={() => viewmodel.openCategory(category.id)}
          aria-label={`${category.name}，${category.description}`}
          className="flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-xl px-2 text-center hover:bg-brand-faint"
        >
          <CategoryIcon index={index} compact />
          <span className="mt-1.5 block w-full truncate text-[11px] font-bold" title={category.name}>
            {category.name}
          </span>
        </button>
      ))}
    </nav>
  );
}
