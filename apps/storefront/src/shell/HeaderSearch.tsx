import { Search } from 'lucide-react';

export function HeaderSearch({ search, mobile = false }: Readonly<{ search: (value: string) => void; mobile?: boolean }>) {
  return (
    <form
      className={`${mobile ? 'mt-2 border-transparent bg-surface text-content shadow-sm' : 'mx-auto max-w-[500px] flex-1 border-brand bg-surface shadow-xs'} flex h-11 min-w-0 items-center overflow-hidden rounded-lg border-2 focus-within:ring-2 focus-within:ring-focus/30`}
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('query');
        search(typeof value === 'string' ? value : '');
      }}
    >
      <Search size={17} className="ml-3 shrink-0 text-muted" aria-hidden="true" />
      <input
        name="query"
        aria-label={mobile ? '移动端搜索商城商品' : '搜索商城商品'}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
        placeholder="搜索福利商品、品牌或分类"
      />
      <button type="submit" className={`${mobile ? 'sr-only' : 'h-full shrink-0 bg-brand px-5 text-sm font-bold text-inverse hover:bg-brand-dark'}`}>
        搜索
      </button>
    </form>
  );
}
