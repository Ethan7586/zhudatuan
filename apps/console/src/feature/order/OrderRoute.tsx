import { ResourceState } from '@shop/design';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { downloadCurrentPageCsv, timestampedCsvFilename, type CsvColumn } from '../../shared/export/CurrentPageCsv';
import { LocalImportDialog } from '../../shared/ui/LocalImportDialog';
import { formatOrderTime } from './OrderPresentation';
import { OrderColumnSettings } from './OrderColumnSettings';
import { orderDetailKey } from './OrderDetailQuery';
import { OrderDrawer } from './OrderDrawer';
import { emptyOrderFilter, OrderFilterForm } from './OrderFilter';
import { OrderIcon } from './OrderIcon';
import { OrderPageHeader } from './OrderPageHeader';
import { isOrderPreviewContext, orderKey, readOrders, type OrderQuery } from './OrderQuery';
import { defaultOrderColumns, OrderTable, type OrderColumnKey } from './OrderTable';
import { OrderDetailTabSchema, OrderFilterSchema, OrderListFilterSchema, OrderViewSchema, type OrderDetailTab, type OrderListFilter, type OrderRecord, type OrderView } from './OrderSchema';
import { OrderStatusTabs } from './OrderStatusTabs';
import './order-layout.css';
import './order-controls.css';
import './order-table.css';
import './order-drawer.css';
import './order-drawer-panels.css';
import './order-preview-actions.css';

const previewOnlySearchKeys = ['placed', 'lifecycle', 'payment', 'fulfillment', 'mall', 'view'] as const;
const emptyChecked: ReadonlySet<string> = new Set();
const orderCsvColumns: readonly CsvColumn<OrderRecord>[] = Object.freeze([
  { header: '内部订单ID', value: (row) => row.id },
  { header: '订单号', value: (row) => row.order_number },
  { header: '范围ID', value: (row) => row.scope_id },
  { header: '会员ID', value: (row) => row.member_id },
  { header: '商城ID', value: (row) => row.mall_id },
  { header: '总金额（最小单位）', value: (row) => row.total_minor },
  { header: '币种', value: (row) => row.currency },
  { header: '支付状态', value: (row) => row.payment_state },
  { header: '履约状态', value: (row) => row.fulfillment_state },
  { header: '售后状态', value: (row) => row.aftersale_state },
  { header: '生命周期', value: (row) => row.lifecycle_state },
  { header: '创建时间', value: (row) => row.created_at },
  { header: '更新时间', value: (row) => row.updated_at },
  { header: '版本', value: (row) => row.version },
]);

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const previewEnabled = isOrderPreviewContext(context);
  const filter = readFilter(search, previewEnabled);
  const view = readView(search, previewEnabled);
  const selected = readSelected(search);
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
  const listCondition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: page !== undefined,
    empty: page?.items.length === 0,
    stale: query.isStale,
  });

  useEffect(() => {
    if (previewEnabled || !previewOnlySearchKeys.some((key) => search.has(key))) return;
    const next = new URLSearchParams(search);
    previewOnlySearchKeys.forEach((key) => next.delete(key));
    setSearch(next, { replace: true });
  }, [previewEnabled, search, setSearch]);
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

  if (listCondition === 'unauthenticated' || listCondition === 'denied') {
    return (
      <section className="orderworkspace" aria-label="订单管理系统">
        <ResourceState condition={listCondition} resourceLabel="订单管理系统" {...(error === undefined ? {} : { error })}>
          <span />
        </ResourceState>
      </section>
    );
  }

  return (
    <section className="orderworkspace" aria-labelledby="ordermanagementtitle">
      <OrderPageHeader
        isFetching={query.isFetching}
        exportReady={page !== undefined}
        onImport={() => setImportOpen(true)}
        onExport={() => {
          if (page === undefined) return;
          downloadCurrentPageCsv({ rows: page.items, columns: orderCsvColumns, filename: timestampedCsvFilename('orders-current-page') });
        }}
        onRefresh={refresh}
      />

      <p id="orderwriteboundary" className="ordercontractnote" role="note">
        当前页导出只使用已经加载的服务端读模型；发货、退款、售后及其他写操作仍保持关闭。
      </p>

      <OrderStatusTabs active={view} previewEnabled={previewEnabled} page={page} onChange={selectView} />
      <div className="orderfilterarea">
        <OrderFilterForm value={filter} previewEnabled={previewEnabled} onApply={applyFilter} onColumns={() => setColumnsOpen((open) => !open)} columnsOpen={columnsOpen} />
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
          <OrderTable
            rows={page.items}
            previewEnabled={previewEnabled}
            visible={visibleColumns}
            checked={checked}
            {...(selected === undefined ? {} : { activeOrder: selected })}
            onCheck={toggleChecked}
            onCheckAll={togglePage}
            onOpen={openOrder}
          />
        )}
      </div>

      {page === undefined ? null : <OrderPagination count={page.count} total={previewPage?.total} page={previewPage?.page} previousCursor={previewPage?.previousCursor} nextCursor={page.nextCursor} onCursor={setCursor} />}
      {selected === undefined ? null : <OrderDrawer orderId={selected} tab={detailTab} previewEnabled={previewEnabled} onTab={selectTab} onClose={closeOrder} />}
      <LocalImportDialog open={importOpen} title="导入订单" resourceLabel="订单" onClose={() => setImportOpen(false)} />
    </section>
  );
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

function readFilter(search: URLSearchParams, previewEnabled: boolean): OrderListFilter {
  const parsed = OrderListFilterSchema.safeParse({
    order: search.get('order') ?? '',
    placed: previewEnabled ? (search.get('placed') ?? '') : '',
    lifecycle: previewEnabled ? (search.get('lifecycle') ?? '') : '',
    payment: previewEnabled ? (search.get('payment') ?? '') : '',
    fulfillment: previewEnabled ? (search.get('fulfillment') ?? '') : '',
    mall: previewEnabled ? (search.get('mall') ?? '') : '',
  });
  return parsed.success ? parsed.data : emptyOrderFilter;
}

function readView(search: URLSearchParams, previewEnabled: boolean): OrderView {
  if (!previewEnabled) return 'all';
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
