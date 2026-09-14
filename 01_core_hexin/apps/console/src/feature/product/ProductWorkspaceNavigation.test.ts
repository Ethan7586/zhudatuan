import { describe, expect, it, vi } from 'vitest';
import { changeProductPageSize, goToNextProductPage, goToPreviousProductPage, switchProductWorkspace } from './ProductWorkspaceNavigation';

describe('product workspace navigation', () => {
  it('switches workspace through one canonical search state reset', () => {
    const cursorTrail = { current: new Map<number, string | undefined>([[3, 'cursor:3']]) };
    const resetSelection = vi.fn();
    const setSearch = vi.fn();

    switchProductWorkspace('selection', cursorTrail, resetSelection, setSearch);

    expect(cursorTrail.current).toEqual(new Map([[1, undefined]]));
    expect(resetSelection).toHaveBeenCalledOnce();
    expect(setSearch).toHaveBeenCalledWith(new URLSearchParams('workspace=selection'));
  });

  it('uses the cursor trail consistently in both directions and when page size changes', () => {
    const cursorTrail = { current: new Map<number, string | undefined>([[1, undefined], [2, 'cursor:2']]) };
    const updates: URLSearchParams[] = [];
    const changeSearch = (update: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams('q=tea&cursor=cursor:2&page=2');
      update(next);
      updates.push(next);
    };

    goToNextProductPage('cursor:3', 2, cursorTrail, changeSearch);
    goToPreviousProductPage(3, cursorTrail, changeSearch);
    changeProductPageSize(100, 50, cursorTrail, changeSearch);

    expect(updates.map((value) => value.toString())).toEqual([
      'q=tea&cursor=cursor%3A3&page=3',
      'q=tea&cursor=cursor%3A2&page=2',
      'q=tea&limit=100',
    ]);
    expect(cursorTrail.current).toEqual(new Map([[1, undefined]]));
  });
});
