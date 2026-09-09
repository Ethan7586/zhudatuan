import { Filter, Search } from 'lucide-react';

export function CatalogSearch({
  query,
  onQuery,
  onFilters,
  tone = 'surface',
}: Readonly<{
  query: string;
  onQuery: (query: string) => void;
  onFilters?: () => void;
  tone?: 'surface' | 'hero';
}>) {
  return (
    <div role="search" className={`flex min-h-11 min-w-0 items-center gap-2 rounded-2xl px-3 text-content ${tone === 'hero' ? 'bg-surface' : 'border border-edge bg-surface shadow-sm'}`}>
      <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <input aria-label="搜索商品" value={query} onChange={(event) => onQuery(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="搜索商品或品牌" />
      {onFilters ? (
        <button type="button" onClick={onFilters} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-brand-light" aria-label="打开筛选">
          <Filter size={18} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
