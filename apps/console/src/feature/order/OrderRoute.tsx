import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { safeQueryError } from '@shop/presentation';
import { OrderColumnSettings } from './OrderColumnSettings';
import { orderDetailKey, readOrderDetail } from './OrderDetailQuery';
import { OrderFilterForm } from './OrderFilter';
import { OrderIcon } from './OrderIcon';
import { OrderPageHeader } from './OrderPageHeader';
import { orderKey, readOrders, type OrderQuery } from './OrderQuery';
import { defaultOrderColumns, OrderTable, type OrderColumnKey } from './OrderTable';
import type { OrderDetailTab, OrderListFilter, OrderView } from './OrderSchema';
import { OrderStatusTabs } from './OrderStatusTabs';
import { aftersaleKey, readAftersales } from './AfterSaleQuery';
import { AfterSalePanel } from './AfterSalePanel';
import { OrderPagination } from './OrderPagination';
import { readDetailTab, readFilter, readSelected, readView } from './OrderSearch';
import './Layout.css';
import './Controls.css';
import './Table.css';
import './Drawer.css';
import './DrawerPanels.css';

const unsupportedSearchKeys = ['placed', 'lifecycle', 'payment', 'fulfillment', 'mall'] as const;
const emptyChecked: ReadonlySet<string> = new Set();
const OrderDrawer = lazy(() => import('./OrderDrawer').then((module) => ({ default: module.OrderDrawer })));

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const filter = readFilter(search);
  const view = readView(search);
  const selected = readSelected(search);
  const detailTab = readDetailTab(search);
  const cursor = search.get('cursor') ?? undefined;
  const queryFilter: OrderQuery = { order: filter.order, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({ queryKey: orderKey(context, queryFilter), queryFn: ({ signal }) => readOrders(context, queryFilter, signal), enabled: view === 'all' });
  const aftersaleQuery = useQuery({ queryKey: aftersaleKey(context, queryFilter), queryFn: ({ signal }) => readAftersales(context, queryFilter, signal), enabled: view === 'aftersale' });
  const detailQuery = useQuery({
    queryKey: orderDetailKey(context, selected ?? ''),
    queryFn: ({ signal }) => (selected === undefined ? Promise.resolve(undefined) : readOrderDetail(context, selected, signal)),
    enabled: selected !== undefined,
  });
  const page = query.data;
  const pageIds = useMemo(() => page?.items.map((order) => order.id) ?? [], [page?.items]);
  const selectionBoundary = `${context.scope.kind}\u0000${context.scope.id}\u0000${context.session.accessVersion}`;
  const [checkedState, setCheckedState] = useState<Readonly<{ boundary: string; ids: ReadonlySet<string> }>>(() => ({ boundary: selectionBoundary, ids: new Set() }));
  const checked = useMemo(() => {
    if (checkedState.boundary !== selectionBoundary || checkedState.ids.size === 0) return emptyChecked;
    const pageIdSet = new Set(pageIds);
    const retained = new Set([...checkedState.ids].filter((id) => pageIdSet.has(id)));
    return retained.size === checkedState.ids.size ? checkedState.ids : retained;
  }, [checkedState, pageIds, selectionBoundary]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<OrderColumnKey>>(() => new Set(defaultOrderColumns));
  const error = safeQueryError(query.error);

  useEffect(() => {
    if (!unsupportedSearchKeys.some((key) => search.has(key)) && (search.get('view') === null || readView(search) === search.get('view'))) return;
    const next = new URLSearchParams(search);
    unsupportedSearchKeys.forEach((key) => next.delete(key));
    if (search.get('view') !== null && readView(search) === 'all') next.delete('view');
    setSearch(next, { replace: true });
  }, [search, setSearch]);
  useEffect(() => {
    setCheckedState((current) => (current.boundary === selectionBoundary ? current : { boundary: selectionBoundary, ids: new Set() }));
  }, [selectionBoundary]);
  useEffect(() => {
    setCheckedState((current) => {
      if (current.boundary !== selectionBoundary || current.ids.size === 0) return current;
      const pageIdSet = new Set(pageIds);
      const retained = new Set([...current.ids].filter((id) => pageIdSet.has(id)));
      return retained.size === current.ids.size ? current : { boundary: selectionBoundary, ids: retained };
    });
  }, [pageIds, selectionBoundary]);

  const updateSearch = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    mutate(next);
    setSearch(next);
  };
  const resetChecked = () => setCheckedState({ boundary: selectionBoundary, ids: new Set() });
  const applyFilter = (value: OrderListFilter) =>
    updateSearch((next) => {
      for (const key of ['order', 'placed', 'lifecycle', 'payment', 'fulfillment', 'mall'] as const) {
        if (value[key] === '') next.delete(key);
        else next.set(key, value[key]);
      }
      next.delete('cursor');
      resetChecked();
    });
  const selectView = (nextView: OrderView) =>
    updateSearch((next) => {
      if (nextView === 'all') next.delete('view');
      else next.set('view', nextView);
      next.delete('cursor');
      resetChecked();
    });
  const openOrder = (id: string) =>
    updateSearch((next) => {
      next.set('selected', id);
      next.delete('tab');
    });
  const openAfterSaleOrder = (id: string) =>
    updateSearch((next) => {
      next.set('selected', id);
      next.set('tab', 'aftersale');
    });
  const closeOrder = () =>
    updateSearch((next) => {
      next.delete('selected');
      next.delete('tab');
    });
  const selectTab = (tab: OrderDetailTab) => updateSearch((next) => next.set('tab', tab));
  const setCursor = (value?: string) =>
    updateSearch((next) => {
      if (value === undefined || value === 'start') next.delete('cursor');
      else next.set('cursor', value);
      resetChecked();
    });
  const refresh = () => {
    if (view === 'aftersale') void aftersaleQuery.refetch();
    else void query.refetch();
    if (selected !== undefined) void queryClient.refetchQueries({ queryKey: orderDetailKey(context, selected), exact: true });
  };
  const toggleColumn = (key: OrderColumnKey) =>
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleChecked = (id: string) =>
    setCheckedState((current) => {
      const next = new Set<string>(current.boundary === selectionBoundary ? current.ids : emptyChecked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { boundary: selectionBoundary, ids: next };
    });
  const togglePage = () =>
    setCheckedState((current) => {
      const next = new Set<string>(current.boundary === selectionBoundary ? current.ids : emptyChecked);
      if (pageIds.every((id) => next.has(id))) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return { boundary: selectionBoundary, ids: next };
    });

  return (
    <section className="orderworkspace" aria-labelledby="ordermanagementtitle">
      <OrderPageHeader isFetching={view === 'aftersale' ? aftersaleQuery.isFetching : query.isFetching} onRefresh={refresh} />

      <p id="orderwriteboundary" className="ordercontractnote" role="note">
        商品订单与售后订单都由服务端按当前组织树或会员本人范围隔离，并使用内部订单编号精确筛选与游标分页；最终写操作保持关闭。
      </p>

      <OrderStatusTabs active={view} onChange={selectView} />
      <div className="orderfilterarea">
        <OrderFilterForm value={filter} onApply={applyFilter} onColumns={() => setColumnsOpen((open) => !open)} columnsOpen={columnsOpen} />
        <OrderColumnSettings open={columnsOpen} visible={visibleColumns} onToggle={toggleColumn} onClose={() => setColumnsOpen(false)} />
        <div className="orderfiltermeta">
          <span>服务端筛选 · 更新时间未提供</span>
        </div>
      </div>

      {checked.size === 0 ? null : (
        <p className="orderselectionnote" role="status">
          已选择 {checked.size} 条当前页订单；跨页动作等待筛选快照与操作预览证明。
        </p>
      )}
      <div id="orderlistpanel" className="orderlistpanel" aria-busy={view === 'aftersale' ? aftersaleQuery.isFetching : query.isFetching}>
        {view === 'aftersale' ? (
          <AfterSalePanel query={aftersaleQuery} error={safeQueryError(aftersaleQuery.error)} selected={selected} onOpen={openAfterSaleOrder} onRetry={refresh} />
        ) : (
          <>
            {query.isPending ? (
              <p className="orderliststate" role="status">
                正在读取订单…
              </p>
            ) : null}
            {query.isError && page === undefined ? (
              <section className="orderliststate" role="alert">
                <strong>订单读取失败</strong>
                <p>{error}</p>
                <button type="button" onClick={refresh}>
                  重试
                </button>
              </section>
            ) : null}
            {query.isError && page !== undefined ? (
              <p className="orderstalebanner" role="status">
                刷新失败，当前保留最近一次已验证数据：{error}
              </p>
            ) : null}
            {page?.items.length === 0 ? (
              <section className="orderliststate" role="status">
                <OrderIcon name="order" />
                <strong>暂无符合条件的订单</strong>
                <p>请调整服务端筛选条件后重试。</p>
              </section>
            ) : null}
            {page === undefined || page.items.length === 0 ? null : (
              <OrderTable rows={page.items} visible={visibleColumns} checked={checked} {...(selected === undefined ? {} : { activeOrder: selected })} onCheck={toggleChecked} onCheckAll={togglePage} onOpen={openOrder} />
            )}
          </>
        )}
      </div>

      {view === 'aftersale' ? (
        aftersaleQuery.data === undefined ? null : (
          <OrderPagination count={aftersaleQuery.data.count} nextCursor={aftersaleQuery.data.nextCursor} onCursor={setCursor} />
        )
      ) : page === undefined ? null : (
        <OrderPagination count={page.count} nextCursor={page.nextCursor} onCursor={setCursor} />
      )}
      {selected === undefined ? null : (
        <Suspense fallback={null}>
          <OrderDrawer
            orderId={selected}
            tab={detailTab}
            query={{
              data: detailQuery.data,
              isPending: detailQuery.isPending,
              isError: detailQuery.isError,
              error: safeQueryError(detailQuery.error),
              refetch: () => {
                void detailQuery.refetch();
              },
            }}
            onTab={selectTab}
            onClose={closeOrder}
          />
        </Suspense>
      )}
    </section>
  );
}
