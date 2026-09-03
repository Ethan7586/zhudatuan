import { chineseReference, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderColumnKey } from '../model/OrderColumn';
import { ORDER_COLUMNS } from '../model/OrderColumn';
import type { OrderListFilter, OrderView } from '../model/OrderFilter';
import type { OrderDetailTab } from '../model/Order';
import type { OrderQuery } from '../model/OrderQuery';
import { useAfterSaleViewModel } from './AfterSaleViewModel';
import { useOrderDetailViewModel } from './DetailViewModel';
import { orderKey } from './OrderQueryKey';
import { readDetailTab, readFilter, readSelected, readView } from './OrderSearch';

export function useOrderListViewModel(context: ConsoleContext, dependencies: OrderDependencies) {
  const [search, setSearch] = useSearchParams();
  const filter = readFilter(search);
  const view = readView(search);
  const selected = readSelected(search);
  const tab = readDetailTab(search);
  const cursor = search.get('cursor') ?? undefined;
  const listFilter: OrderQuery = { ...filter, view: view === 'aftersale' ? 'all' : view, ...(cursor === undefined ? {} : { cursor }) };
  const aftersaleFilter = { ...filter, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({ queryKey: orderKey(context, listFilter), queryFn: ({ signal }) => dependencies.readList.execute(context, listFilter, signal), enabled: view !== 'aftersale' });
  const aftersale = useAfterSaleViewModel(context, dependencies, aftersaleFilter, view === 'aftersale');
  const detail = useOrderDetailViewModel(context, dependencies, selected);
  const [columnsopen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ReadonlySet<OrderColumnKey>>(() => new Set(ORDER_COLUMNS));
  const updateSearch = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    mutate(next);
    setSearch(next);
  };
  const applyFilter = (value: OrderListFilter) => updateSearch((next) => {
    for (const key of ['order', 'placed', 'lifecycle', 'payment', 'fulfillment', 'mall'] as const) value[key] === '' ? next.delete(key) : next.set(key, value[key]);
    next.delete('cursor');
  });
  const selectView = (nextView: OrderView) => updateSearch((next) => {
    nextView === 'all' ? next.delete('view') : next.set('view', nextView);
    next.delete('cursor');
  });
  const open = (id: string, nextTab?: OrderDetailTab) => updateSearch((next) => {
    next.set('selected', id);
    nextTab === undefined ? next.delete('tab') : next.set('tab', nextTab);
  });
  const close = () => updateSearch((next) => { next.delete('selected'); next.delete('tab'); });
  const selectTab = (nextTab: OrderDetailTab) => updateSearch((next) => next.set('tab', nextTab));
  const setCursor = (value?: string) => updateSearch((next) => {
    value === undefined || value === 'start' ? next.delete('cursor') : next.set('cursor', value);
  });
  const refresh = () => {
    view === 'aftersale' ? aftersale.retry() : void query.refetch();
    if (selected !== undefined) detail.refresh();
  };
  const toggleColumn = (key: OrderColumnKey) => setColumns((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const malls = context.scopes.filter((scope) => scope.kind === 'mall').map((scope) => Object.freeze({ id: scope.id, label: scope.name ?? chineseReference('商城', scope.id) }));
  return Object.freeze({
    view, filter, selected, tab, cursor, columns, columnsopen, malls, detail, aftersale,
    page: query.data,
    pending: query.isPending,
    fetching: view === 'aftersale' ? aftersale.fetching : query.isFetching,
    failed: query.isError,
    error: safeQueryError(query.error),
    actions: Object.freeze({
      applyFilter, selectView, open, openAftersale: (id: string) => open(id, 'aftersale'), close, selectTab, setCursor, refresh,
      toggleColumn, toggleColumns: () => setColumnsOpen((current) => !current), closeColumns: () => setColumnsOpen(false),
    }),
  });
}

export type ListViewModel = ReturnType<typeof useOrderListViewModel>;
