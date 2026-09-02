import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { safeQueryError } from '../../shared/presentation/QueryState';
import { FinanceColumnSettings } from './FinanceColumnSettings';
import { FinanceFilters, emptyFinanceFilter } from './FinanceFilters';
import { FinanceHeader } from './FinanceHeader';
import { FinanceIcon } from './FinanceIcon';
import { financeKey, readFinance } from './FinanceQuery';
import { FinanceTabs } from './FinanceTabs';
import { FinancePagination, ReconciliationTable, defaultFinanceColumns, type FinanceColumnKey } from './ReconciliationTable';
import { ReconciliationDrawer } from './ReconciliationDrawer';
import { financeReconciliationKey, readFinanceReconciliations } from './FinanceWorkspaceQuery';
import { FinanceTabSchema, type FinanceFilter, type FinanceTab } from './FinanceWorkspaceSchema';
import './FinanceWorkspace.css';
import './FinanceFilters.css';
import './FinanceTable.css';
import './FinanceDrawer.css';
import './FinanceReview.css';
import './FinanceResponsive.css';

const unsupportedFilterKeys = ['q', 'reconPeriod', 'channel', 'mall', 'status', 'difference'] as const;

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<FinanceColumnKey>>(defaultFinanceColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const scopeKey = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scopeKey);
  const tab = readTab(search);
  const filter = emptyFinanceFilter;
  const limit = readLimit(search.get('limit'));
  const cursor = search.get('cursor') ?? undefined;
  const queryInput = { limit, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({
    queryKey: financeReconciliationKey(context, queryInput),
    queryFn: ({ signal }) => readFinanceReconciliations(context, queryInput, signal),
    enabled: tab === 'payments',
  });
  const overviewQuery = useQuery({
    queryKey: financeKey(context),
    queryFn: ({ signal }) => readFinance(context, signal),
  });
  const page = query.data;
  const selectedId = search.get('selected') ?? undefined;
  const selectedRow = page?.items.find((row) => row.id === selectedId);

  useEffect(() => {
    const scopeChanged = previousScope.current !== scopeKey;
    previousScope.current = scopeKey;
    const hasUnsupportedFilter = unsupportedFilterKeys.some((key) => search.has(key));
    if (!scopeChanged && !hasUnsupportedFilter) return;
    const next = new URLSearchParams(search);
    if (scopeChanged) {
      next.delete('cursor');
      next.delete('selected');
    }
    unsupportedFilterKeys.forEach((key) => next.delete(key));
    setSearch(next, { replace: true });
  }, [scopeKey, search, setSearch]);

  const updateSearch = (mutate: (next: URLSearchParams) => void, replace = false) => {
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        mutate(next);
        return next;
      },
      { replace }
    );
  };
  const applyFilters = (value: FinanceFilter) =>
    updateSearch((next) => {
      setValue(next, 'q', value.q);
      setValue(next, 'reconPeriod', value.period);
      setValue(next, 'channel', value.channel);
      setValue(next, 'mall', value.mall);
      setValue(next, 'status', value.status);
      setValue(next, 'difference', value.difference);
      next.delete('cursor');
      next.delete('selected');
    });
  const setCursor = (value?: string) =>
    updateSearch((next) => {
      setValue(next, 'cursor', value ?? '');
      next.delete('selected');
    });
  const setLimit = (value: number) =>
    updateSearch((next) => {
      if (value === 50) next.delete('limit');
      else next.set('limit', String(value));
      next.delete('cursor');
      next.delete('selected');
    });
  const openRow = (id: string) => updateSearch((next) => next.set('selected', id));
  const closeDrawer = () => updateSearch((next) => next.delete('selected'));
  const toggleRow = (id: string) =>
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelectedRows((current) => {
      if (page === undefined) return current;
      const next = new Set(current);
      const allSelected = page.items.every((row) => next.has(row.id));
      page.items.forEach((row) => {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      });
      return next;
    });
  const toggleColumn = (key: FinanceColumnKey) =>
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="financeworkspace" aria-labelledby="financeworkspacetitle">
      <span id="financeworkspacetitle" className="sr-only">
        财务与对账系统
      </span>
      <FinanceHeader
        fetching={query.isFetching || overviewQuery.isFetching}
        onRefresh={() => {
          void query.refetch();
          void overviewQuery.refetch();
        }}
      />
      <FinanceTabs context={context} active={tab} />
      {tab !== 'payments' ? (
        <UnavailableTab tab={tab} />
      ) : (
        <>
          <div className="financetoolbararea">
            <FinanceFilters value={filter} columnsOpen={columnsOpen} onApply={applyFilters} onColumns={() => setColumnsOpen((open) => !open)} />
            <FinanceColumnSettings open={columnsOpen} visible={visibleColumns} onToggle={toggleColumn} onClose={() => setColumnsOpen(false)} />
          </div>
          <p className="financeproductionboundary">
            <FinanceIcon name="shield" />
            当前仅展示服务端实际返回；关键词与业务筛选等待权威读合同。
          </p>
          {query.isPending ? (
            <div className="financequerystate" role="status">
              正在读取对账权威快照…
            </div>
          ) : null}
          {query.isError ? (
            <div className="financequerystate iserror" role="alert">
              <strong>对账数据读取失败</strong>
              <p>{safeQueryError(query.error)}</p>
              <button
                type="button"
                onClick={() => {
                  void query.refetch();
                }}
              >
                重试
              </button>
            </div>
          ) : null}
          {page !== undefined && page.items.length === 0 ? (
            <div className="financequerystate" role="status">
              当前服务端筛选没有对账记录。
            </div>
          ) : null}
          {page === undefined || page.items.length === 0 ? null : (
            <>
              <ReconciliationTable page={page} visible={visibleColumns} selected={selectedRows} onToggle={toggleRow} onToggleAll={toggleAll} onOpen={openRow} />
              <FinancePagination page={page} limit={limit} onLimit={setLimit} onCursor={setCursor} />
            </>
          )}
        </>
      )}
      <ReconciliationDrawer row={selectedRow} onClose={closeDrawer} />
    </section>
  );
}

function UnavailableTab({ tab }: Readonly<{ tab: Exclude<FinanceTab, 'payments'> }>) {
  const detail =
    tab === 'refunds'
      ? ['退款对账', '现有 reconciliation read 没有退款类型筛选或退款专用权威读模型。']
      : tab === 'rules'
        ? ['对账规则', '当前只有高风险策略写 Operation，没有可验证的规则读取合同。']
        : ['审计记录', '当前没有财务审计记录的独立 read Operation。'];
  return (
    <section className="financeunavailabletab" role="status">
      <FinanceIcon name="shield" />
      <p>CAPABILITY UNAVAILABLE</p>
      <h2>{detail[0]}</h2>
      <span>{detail[1]} 本页不会推断服务端未返回的事实。</span>
    </section>
  );
}

function readTab(search: URLSearchParams): FinanceTab {
  const parsed = FinanceTabSchema.safeParse(search.get('tab') ?? 'payments');
  return parsed.success ? parsed.data : 'payments';
}
function readLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  return [20, 50].includes(parsed) ? parsed : 50;
}
function setValue(search: URLSearchParams, key: string, value: string) {
  if (value === '') search.delete(key);
  else search.set(key, value);
}
