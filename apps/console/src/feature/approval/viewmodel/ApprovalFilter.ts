import { useCallback } from 'react';

type SearchUpdate = URLSearchParams | ((current: URLSearchParams) => URLSearchParams);
type SearchSetter = (update: SearchUpdate, options?: Readonly<{ replace?: boolean }>) => void;

export function useApprovalFilter(setSearch: SearchSetter) {
  const setFilter = useCallback(
    (key: 'state' | 'subject', value: string) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('cursor');
          if (value.length === 0) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearch]
  );
  const setView = useCallback(
    (nextView: 'templates' | 'tasks') => {
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.delete('cursor');
        next.delete('state');
        if (nextView === 'templates') next.delete('view');
        else next.set('view', nextView);
        return next;
      });
    },
    [setSearch]
  );
  return Object.freeze({ setFilter, setView });
}
