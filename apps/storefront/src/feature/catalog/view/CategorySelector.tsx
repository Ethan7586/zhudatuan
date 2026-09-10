import type { useCatalogViewModel } from '../viewmodel/CatalogViewModel';

export function CategorySelector({
  categories,
  selected,
  onSelect,
  mode = 'panel',
}: Readonly<{
  categories: ReturnType<typeof useCatalogViewModel>['presentationCategories'];
  selected: string;
  onSelect: (category: string) => void;
  mode?: 'panel' | 'rail';
}>) {
  const options = Object.freeze([{ id: 'all', name: '精选' }, ...categories]);
  return (
    <nav aria-label="商品分类选择" className={mode === 'rail' ? 'space-y-1 rounded-2xl bg-surface p-1.5 shadow-sm' : 'space-y-2'}>
      {options.map((category) => {
        const active = selected === category.id;
        return (
          <button
            type="button"
            key={category.id}
            onClick={() => onSelect(category.id)}
            aria-pressed={active}
            aria-label={category.name}
            className={`${mode === 'rail' ? 'relative min-h-12 w-full px-2 text-center text-xs' : 'min-h-11 w-full px-3 text-left text-sm'} rounded-xl transition ${
              active ? 'bg-brand-light font-black text-brand-dark' : 'text-secondary hover:bg-subtle'
            }`}
          >
            {active && mode === 'rail' ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r bg-brand" /> : null}
            <span className="block whitespace-nowrap">{category.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
