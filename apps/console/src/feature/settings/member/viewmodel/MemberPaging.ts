import { OP_MEMBER_MEMBERS_READ } from '@shop/contract/ids';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { pageCursor } from '../../../../shared/query/QueryState';

export function useMemberPaging(context: ConsoleContext) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const next = useCallback((value: string) => setSearch(pageCursor(search, value)), [search, setSearch]);
  const first = useCallback(
    () => setSearch((current) => {
      const value = new URLSearchParams(current);
      value.delete('cursor');
      return value;
    }),
    [setSearch]
  );
  const queryKey = Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_MEMBER_MEMBERS_READ, cursor ?? null, 50] as const);
  return Object.freeze({ cursor, next, first, queryKey });
}
