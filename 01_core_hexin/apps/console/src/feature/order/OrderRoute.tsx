import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { safeQueryError } from '../../shared/api/QueryState';
import { appConfig } from '../../shared/config/AppConfig';
import { formatOrderTime } from './OrderPresentation';
import { OrderColumnSettings } from './OrderColumnSettings';
import { orderDetailKey } from './OrderDetailQuery';
import { OrderDrawer } from './OrderDrawer';
import { OrderExceptionWorkbench } from './OrderExceptionWorkbench';
import { OrderExportWorkspace } from './OrderExportWorkspace';
import { emptyOrderFilter, OrderFilterForm } from './OrderFilter';
import { OrderIcon } from './OrderIcon';
import { OrderDirectoryActions } from './OrderPageHeader';
import { isOrderPreviewContext, orderKey, readOrders, type OrderQuery } from './OrderQuery';
import { defaultOrderColumns, OrderTable, type OrderColumnKey } from './OrderTable';
import { OrderDetailTabSchema, OrderFilterSchema, OrderListFilterSchema, OrderViewSchema, type OrderDetailTab, type OrderListFilter, type OrderView } from './OrderSchema';
import { OrderStatusTabs } from './OrderStatusTabs';
import './order-layout.css';
import './order-controls.css';
import './order-table.css';
import './order-drawer.css';
import './order-drawer-panels.css';
import './order-preview-actions.css';
import './order-exception-shell.css';
import './order-exception-list.css';
import './order-exception-timeline.css';
import './order-exception-action.css';
import './order-exception-responsive.css';
import './order-member-vi.css';

const emptyChecked: ReadonlySet<string> = new Set();

export function Component() {
  const context = useConsoleContext();
  const mallName = context.scope.name?.trim() || '当前商城';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const previewEnabled = isOrderPreviewContext(context);
  const filter = readFilter(search);
  const view = readView(search);
  const selected = readSelected(search);
  const exportOpen = search.get('mode') === 'export';
  const detailTab = readDetailTab(search);
  const cursor = search.get('cursor') ?? undefined;
  const queryFilter: OrderQuery = { ...filter, view, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({ queryKey: orderKey(context, queryFilter), queryFn: ({ signal }) => readOrders(context, queryFilter, signal) });
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
  const previewPage = previewEnabled && page?.preview?.source === 'local-preview' ? page.preview : undefined;
  const error = safeQueryError(query.error);
  const unauthenticated = query.error !== null && errorStatus(query.error) === 401;

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
  const openOrder = (id: string) => {
    const order = page?.items.find((item) => item.id === id);
    if (order !== undefined) queryClient.setQueryData(orderDetailKey(context, id), order);
    updateSearch((next) => {
      next.set('selected', id);
      next.delete('tab');
    });
  };
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
    void query.refetch();
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

  if (exportOpen) {
    return <OrderExportWorkspace
      context={context}
      mallName={mallName}
      pageIds={pageIds}
      selectedIds={[...checked]}
      initialTasks={page?.exports ?? []}
      filter={{ ...filter, view }}
      onReloadHistory={async () => { await query.refetch(); }}
      onClose={() => updateSearch((next) => next.delete('mode'))}
    />;
  }

  if (previewEnabled && view === 'exception') {
    return <>
      <OrderExceptionWorkbench page={page} isPending={query.isPending} isFetching={query.isFetching} error={error}
        onBack={() => selectView('all')} onRefresh={refresh} onOpenOrder={openOrder} onOpenSystem={(route) => navigate(route)} />
      {selected === undefined ? null : <OrderDrawer orderId={selected} tab={detailTab} previewEnabled mallName={mallName} onTab={selectTab} onClose={closeOrder} />}
    </>;
  }

  return (
    <section className="orderworkspace" data-detail-open={selected !== undefined} aria-label="订单管理">
      <div className="orderstage" data-detail-open={selected !== undefined}>
        <section className="orderdirectorypanel" aria-labelledby="orderworkspacetitle">
          <header className="orderpanelheading">
            <div>
              <h2 id="orderworkspacetitle">共 {page === undefined ? '—' : page.count} 条订单</h2>
            </div>
            <OrderDirectoryActions
              isFetching={query.isFetching}
              columnsOpen={columnsOpen}
              onExport={() => updateSearch((next) => next.set('mode', 'export'))}
              onRefresh={refresh}
              onColumns={() => setColumnsOpen((open) => !open)}
            />
          </header>
              <div className="ordervi12statusbar">
                <OrderStatusTabs active={view} previewEnabled={previewEnabled} page={page} onChange={selectView} />
              </div>

              <p id="orderwriteboundary" className="ordercontractnote" role="note">
                当前列表读取本节点及授权下游的权威订单；订单、财务、商品为明线，现金结果用于核验财务。发货、退款和售后写操作暂未开放。
              </p>

              <div className="orderfilterarea">
                <OrderFilterForm value={filter} onApply={applyFilter} onColumns={() => setColumnsOpen((open) => !open)} columnsOpen={columnsOpen} />
                <OrderColumnSettings open={columnsOpen} visible={visibleColumns} onToggle={toggleColumn} onClose={() => setColumnsOpen(false)} />
                <div className="orderfiltermeta">
                  <span>{previewPage === undefined ? '服务端筛选 · 更新时间未提供' : `服务端实时筛选 · ${formatOrderTime(previewPage.updatedAt)}`}</span>
                </div>
              </div>

              {checked.size === 0 ? null : (
                <p className="orderselectionnote" role="status">
                  已选择 {checked.size} 条当前页订单；跨页动作等待 Filter Snapshot 与 Preview 证明。
                </p>
              )}
              <div id="orderlistpanel" className="orderlistpanel" aria-busy={query.isFetching}>
                {query.isPending ? (
                  <p className="orderliststate" role="status">
                    正在读取订单…
                  </p>
                ) : null}
                {query.isError && page === undefined ? (
                  <section className="orderliststate" role="alert">
                    <strong>{unauthenticated ? '登录状态已失效' : '订单读取失败'}</strong>
                    <p>{unauthenticated ? '当前 L1 会话已经失效，请重新登录后继续读取订单。' : error}</p>
                    <button type="button" onClick={unauthenticated ? () => window.location.assign(appConfig.identityEntryUrl) : refresh}>
                      {unauthenticated ? '重新登录' : '重试'}
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
                  <OrderTable
                    rows={page.items}
                    previewEnabled={previewEnabled}
                    visible={visibleColumns}
                    checked={checked}
                    {...(selected === undefined ? {} : { activeOrder: selected })}
                    onCheck={toggleChecked}
                    onCheckAll={togglePage}
                    onOpen={openOrder}
                    mallName={mallName}
                  />
                )}
              </div>

              {page === undefined ? null : <OrderPagination count={page.count} total={previewPage?.total} page={previewPage?.page} previousCursor={previewPage?.previousCursor} nextCursor={page.nextCursor} onCursor={setCursor} />}
        </section>
        {selected === undefined ? null : <OrderDrawer orderId={selected} tab={detailTab} previewEnabled={previewEnabled} mallName={mallName} onTab={selectTab} onClose={closeOrder} />}
      </div>
    </section>
  );
}

function errorStatus(error: Error): number | undefined {
  return 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}

function OrderPagination({
  count,
  total,
  page,
  previousCursor,
  nextCursor,
  onCursor,
}: Readonly<{
  count: number;
  total: number | undefined;
  page: number | undefined;
  previousCursor: string | undefined;
  nextCursor: string | undefined;
  onCursor: (cursor?: string) => void;
}>) {
  const start = page === undefined ? undefined : (page - 1) * 50 + (count === 0 ? 0 : 1);
  const end = start === undefined ? undefined : start + Math.max(0, count - 1);
  return (
    <footer className="orderpagination">
      <span>{total === undefined ? `本页 ${count} 条 · 全量总数不可用` : `${start}–${end} / 共 ${total} 笔`}</span>
      <label>
        每页{' '}
        <select aria-label="每页数量" value="50" disabled>
          <option value="50">50</option>
        </select>
      </label>
      <div>
        <button type="button" onClick={() => onCursor(previousCursor)} disabled={previousCursor === undefined} aria-label="上一页">
          <OrderIcon name="arrowLeft" />
        </button>
        {page === undefined ? null : <span aria-current="page">{page}</span>}
        <button type="button" onClick={() => onCursor(nextCursor)} disabled={nextCursor === undefined} aria-label="下一页">
          <OrderIcon name="arrowRight" />
        </button>
      </div>
    </footer>
  );
}

function readFilter(search: URLSearchParams): OrderListFilter {
  const parsed = OrderListFilterSchema.safeParse({
    order: search.get('order') ?? '',
    placed: search.get('placed') ?? '',
    lifecycle: search.get('lifecycle') ?? '',
    payment: search.get('payment') ?? '',
    fulfillment: search.get('fulfillment') ?? '',
    mall: search.get('mall') ?? '',
  });
  return parsed.success ? parsed.data : emptyOrderFilter;
}

function readView(search: URLSearchParams): OrderView {
  const parsed = OrderViewSchema.safeParse(search.get('view') ?? 'all');
  return parsed.success ? parsed.data : 'all';
}

function readSelected(search: URLSearchParams): string | undefined {
  const value = search.get('selected');
  if (value === null) return undefined;
  const parsed = OrderFilterSchema.safeParse({ order: value });
  return parsed.success && parsed.data.order !== '' ? parsed.data.order : undefined;
}

function readDetailTab(search: URLSearchParams): OrderDetailTab {
  const parsed = OrderDetailTabSchema.safeParse(search.get('tab') ?? 'overview');
  return parsed.success ? parsed.data : 'overview';
}
