import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { pageCursor } from '../../../../shared/query/QueryState';
import type { CustomerKind, CustomerQuery, CustomerStatus } from '../model/Customer';

export function useCustomerQuery() {
  const [search, setSearch] = useSearchParams();
  const kind = customerKind(search.get('customerKind'));
  const status = customerStatus(search.get('customerStatus'));
  const query: CustomerQuery = Object.freeze({
    ...(search.get('q') ? { q: search.get('q')! } : {}),
    ...(kind === undefined ? {} : { kind }),
    ...(status === undefined ? {} : { status }),
    ...(search.get('cursor') ? { cursor: search.get('cursor')! } : {}),
  });
  const change = useCallback((key: 'q' | 'customerKind' | 'customerStatus', value: string) => setSearch((current) => querySearch(current, key, value)), [setSearch]);
  const next = useCallback((cursor: string) => setSearch(pageCursor(search, cursor)), [search, setSearch]);
  const first = useCallback(() => setSearch((current) => querySearch(current, 'cursor', '')), [setSearch]);
  return Object.freeze({ query, change, next, first });
}

function querySearch(current: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key !== 'cursor') next.delete('cursor');
  return next;
}
function customerKind(value: string | null): CustomerKind | undefined {
  return value === 'enterprise' || value === 'institution' || value === 'government' ? value : undefined;
}
function customerStatus(value: string | null): CustomerStatus | undefined {
  return value === 'draft' || value === 'active' || value === 'disabled' ? value : undefined;
}
