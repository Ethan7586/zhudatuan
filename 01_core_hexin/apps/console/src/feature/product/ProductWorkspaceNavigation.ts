export type ProductWorkspace = 'catalog' | 'selection' | 'pending' | 'free';

type CursorTrail = { current: Map<number, string | undefined> };
type ChangeSearch = (update: (next: URLSearchParams) => void) => void;

export function switchProductWorkspace(
  workspace: ProductWorkspace,
  cursorTrail: CursorTrail,
  resetSelection: () => void,
  setSearch: (next: URLSearchParams) => void,
): void {
  const next = new URLSearchParams();
  if (workspace === 'selection') next.set('workspace', 'selection');
  if (workspace === 'pending') next.set('workspace', 'pending');
  if (workspace === 'free') next.set('workspace', 'free');
  resetProductCursorTrail(cursorTrail);
  resetSelection();
  setSearch(next);
}

export function goToNextProductPage(
  cursor: string | undefined,
  page: number,
  cursorTrail: CursorTrail,
  changeSearch: ChangeSearch,
): void {
  if (cursor === undefined) return;
  cursorTrail.current.set(page + 1, cursor);
  changeSearch((next) => {
    next.set('cursor', cursor);
    next.set('page', String(page + 1));
  });
}

export function goToPreviousProductPage(
  page: number,
  cursorTrail: CursorTrail,
  changeSearch: ChangeSearch,
): void {
  if (page <= 1) return;
  const target = page - 1;
  const cursor = cursorTrail.current.get(target);
  changeSearch((next) => {
    if (target === 1) next.delete('cursor');
    else if (cursor !== undefined) next.set('cursor', cursor);
    next.set('page', String(target));
  });
}

export function changeProductPageSize(
  limit: number,
  defaultLimit: number,
  cursorTrail: CursorTrail,
  changeSearch: ChangeSearch,
): void {
  resetProductCursorTrail(cursorTrail);
  changeSearch((next) => {
    next.delete('cursor');
    next.delete('page');
    if (limit === defaultLimit) next.delete('limit');
    else next.set('limit', String(limit));
  });
}

export function resetProductCursorTrail(cursorTrail: CursorTrail): void {
  cursorTrail.current = new Map([[1, undefined]]);
}
