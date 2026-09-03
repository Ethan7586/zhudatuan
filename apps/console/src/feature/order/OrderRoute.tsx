import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
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
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<OrderColumnKey>>(() => new Set(defaultOrderColumns));
  const error = safeQueryError(query.error);

  const updateSearch = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    mutate(next);
    setSearch(next);
  };
  const applyFilter = (value: OrderListFilter) =>
    updateSearch((next) => {
      if (value.order === '') next.delete('order');
      else next.set('order', value.order);
      next.delete('cursor');
    });
  const selectView = (nextView: OrderView) =>
    updateSearch((next) => {
      if (nextView === 'all') next.delete('view');
      else next.set('view', nextView);
      next.delete('cursor');
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
  return (
    <section className="orderworkspace" aria-labelledby="ordermanagementtitle">
      <OrderPageHeader isFetching={view === 'aftersale' ? aftersaleQuery.isFetching : query.isFetching} onRefresh={refresh} />

      <p className="ordercontractnote" role="note">
        商品订单与售后订单按当前数据范围安全隔离，可使用内部订单编号精确查询并查看完整快照。
      </p>

      <OrderStatusTabs active={view} onChange={selectView} />
      <div className="orderfilterarea">
        <OrderFilterForm value={filter} onApply={applyFilter} onColumns={() => setColumnsOpen((open) => !open)} columnsOpen={columnsOpen} />
        <OrderColumnSettings open={columnsOpen} visible={visibleColumns} onToggle={toggleColumn} onClose={() => setColumnsOpen(false)} />
        <div className="orderfiltermeta">
          <span>按订单编号查询</span>
        </div>
      </div>
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
            {page === undefined || page.items.length === 0 ? null : <OrderTable rows={page.items} visible={visibleColumns} {...(selected === undefined ? {} : { activeOrder: selected })} onOpen={openOrder} />}
          </>
        )}
      </div>

      {view === 'aftersale' ? (
        aftersaleQuery.data === undefined ? null : (
          <OrderPagination count={aftersaleQuery.data.count} hasCursor={cursor !== undefined} nextCursor={aftersaleQuery.data.nextCursor} onCursor={setCursor} />
        )
      ) : page === undefined ? null : (
        <OrderPagination count={page.count} hasCursor={cursor !== undefined} nextCursor={page.nextCursor} onCursor={setCursor} />
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
