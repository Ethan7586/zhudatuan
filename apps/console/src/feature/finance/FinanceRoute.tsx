<<<<<<< HEAD
<<<<<<< HEAD
import { ResourceState } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { downloadCurrentPageCsv, timestampedCsvFilename, type CsvColumn } from '../../shared/export/CurrentPageCsv';
import { LocalImportDialog } from '../../shared/ui/LocalImportDialog';
import { FinanceAuthorityTab } from './FinanceAuthorityTabs';
import { FinanceColumnSettings } from './FinanceColumnSettings';
import { FinanceFilters } from './FinanceFilters';
=======
=======
import { ResourceState } from '@shop/design';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { downloadCurrentPageCsv, timestampedCsvFilename, type CsvColumn } from '../../shared/export/CurrentPageCsv';
import { LocalImportDialog } from '../../shared/ui/LocalImportDialog';
import { FinanceAuthorityTab } from './FinanceAuthorityTabs';
import { FinanceColumnSettings } from './FinanceColumnSettings';
<<<<<<< HEAD
import { FinanceFilters, emptyFinanceFilter } from './FinanceFilters';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { FinanceFilters } from './FinanceFilters';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { FinanceHeader, type FinanceHeaderAction } from './FinanceHeader';
import { FinanceIcon } from './FinanceIcon';
import { financeKey, readFinance } from './FinanceQuery';
import { FinanceTabs } from './FinanceTabs';
import { FinancePagination, ReconciliationTable, defaultFinanceColumns, type FinanceColumnKey } from './ReconciliationTable';
import { ReconciliationDrawer } from './ReconciliationDrawer';
<<<<<<< HEAD
<<<<<<< HEAD
import { financeReconciliationKey, isFinancePreviewContext, readFinanceReconciliations, type FinanceReconciliationQuery } from './FinanceWorkspaceQuery';
import { FinanceTabSchema, type FinanceFilter, type FinanceReconciliation, type FinanceTab } from './FinanceWorkspaceSchema';
import './FinanceWorkspace.css';
import './FinanceFilters.css';
import './FinanceTable.css';
import './FinanceAuthority.css';
import './FinancePolicyEditor.css';
=======
import { financeReconciliationKey, isFinancePreviewContext, readFinanceReconciliations } from './FinanceWorkspaceQuery';
import { FinanceTabSchema, type FinanceFilter, type FinanceTab } from './FinanceWorkspaceSchema';
import './FinanceWorkspace.css';
import './FinanceFilters.css';
import './FinanceTable.css';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { financeReconciliationKey, isFinancePreviewContext, readFinanceReconciliations, type FinanceReconciliationQuery } from './FinanceWorkspaceQuery';
import { FinanceTabSchema, type FinanceFilter, type FinanceReconciliation, type FinanceTab } from './FinanceWorkspaceSchema';
import './FinanceWorkspace.css';
import './FinanceFilters.css';
import './FinanceTable.css';
import './FinanceAuthority.css';
import './FinancePolicyEditor.css';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import './FinanceDrawer.css';
import './FinanceReview.css';
import './FinanceResponsive.css';

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function financeCsvColumns(reconciliationType: 'payments' | 'refunds'): readonly CsvColumn<FinanceReconciliation>[] {
  return [
    { header: '对账类型', value: () => reconciliationType },
    { header: '对账ID', value: (row) => row.id },
    { header: '范围ID', value: (row) => row.scope_id },
    { header: '渠道', value: (row) => row.provider },
    { header: '合作方ID', value: (row) => row.partner_id },
    { header: '账期', value: (row) => row.period },
    { header: '对账单引用', value: (row) => row.statement_ref },
    { header: '渠道金额（最小单位）', value: (row) => row.debit_minor },
    { header: '账本金额（最小单位）', value: (row) => row.credit_minor },
    { header: '差额（最小单位）', value: (row) => row.difference_minor },
    { header: '状态', value: (row) => row.state },
    { header: '更新时间', value: (row) => row.updated_at },
    { header: '版本', value: (row) => row.version },
  ];
}
<<<<<<< HEAD
=======
const previewOnlyKeys = ['q', 'reconPeriod', 'channel', 'mall', 'status', 'difference'] as const;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<FinanceColumnKey>>(defaultFinanceColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [headerAction, setHeaderAction] = useState<FinanceHeaderAction>();
<<<<<<< HEAD
<<<<<<< HEAD
  const [importOpen, setImportOpen] = useState(false);
  const searchRef = useRef(new URLSearchParams(search));
  const pendingSearchKey = useRef<string | undefined>(undefined);
  const searchKey = search.toString();
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const [importOpen, setImportOpen] = useState(false);
  const searchRef = useRef(new URLSearchParams(search));
  const searchKey = search.toString();
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const scopeKey = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scopeKey);
  const previewContext = isFinancePreviewContext(context);
  const tab = readTab(search);
<<<<<<< HEAD
<<<<<<< HEAD
  const filter = readFilter(search);
  const limit = readLimit(search.get('limit'));
  const cursor = search.get('cursor') ?? undefined;
  const kind: FinanceReconciliationQuery['kind'] = tab === 'refunds' ? 'refund' : 'payment';
  const queryInput = { ...filter, kind, limit, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({
    queryKey: financeReconciliationKey(context, queryInput),
    queryFn: ({ signal }) => readFinanceReconciliations(context, queryInput, signal),
    enabled: tab === 'payments' || tab === 'refunds',
=======
  const filter = readFilter(search, previewContext);
=======
  const filter = readFilter(search);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const limit = readLimit(search.get('limit'));
  const cursor = search.get('cursor') ?? undefined;
  const kind: FinanceReconciliationQuery['kind'] = tab === 'refunds' ? 'refund' : 'payment';
  const queryInput = { ...filter, kind, limit, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({
    queryKey: financeReconciliationKey(context, queryInput),
    queryFn: ({ signal }) => readFinanceReconciliations(context, queryInput, signal),
<<<<<<< HEAD
    enabled: tab === 'payments',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    enabled: tab === 'payments' || tab === 'refunds',
>>>>>>> 018b2a71 (chore(release): capture current production source)
  });
  const overviewQuery = useQuery({
    queryKey: financeKey(context),
    queryFn: ({ signal }) => readFinance(context, signal),
  });
  const page = query.data;
  const previewEnabled = previewContext && page?.preview?.source === 'local-preview';
  const overviewPreview = previewContext && overviewQuery.data?.preview?.source === 'local-preview' ? overviewQuery.data.preview : undefined;
  const statusSummary = overviewPreview ?? (previewEnabled ? page?.preview : undefined);
  const selectedId = search.get('selected') ?? undefined;
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const selectedRow = page?.items.find((row) => row.id === selectedId && row.items.some((item) => item.state === 'difference' || item.state === 'resolutionpending'));
  const reconciliationCondition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: page !== undefined, empty: page?.items.length === 0, stale: query.isStale });
  const overviewCondition = queryCondition({ pending: overviewQuery.isPending, fetching: overviewQuery.isFetching,
    error: overviewQuery.error, hasData: overviewQuery.data !== undefined, empty: false, stale: overviewQuery.isStale });
  const accessCondition = [reconciliationCondition, overviewCondition]
    .find((condition) => condition === 'unauthenticated' || condition === 'denied');
  const accessError = reconciliationCondition === accessCondition ? safeQueryError(query.error)
    : overviewCondition === accessCondition ? safeQueryError(overviewQuery.error) : undefined;

  useEffect(() => {
<<<<<<< HEAD
    if (pendingSearchKey.current !== undefined && pendingSearchKey.current !== searchKey) return;
    searchRef.current = new URLSearchParams(searchKey);
    pendingSearchKey.current = undefined;
=======
    searchRef.current = new URLSearchParams(searchKey);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  }, [searchKey]);

  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = false) => {
      const next = new URLSearchParams(searchRef.current);
      mutate(next);
      searchRef.current = next;
<<<<<<< HEAD
      pendingSearchKey.current = next.toString() === searchKey ? undefined : next.toString();
      setSearch(next, { replace });
    },
    [searchKey, setSearch]
  );
=======
  const selectedRow = page?.items.find((row) => row.id === selectedId);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      setSearch(next, { replace });
    },
    [setSearch]
  );
>>>>>>> 018b2a71 (chore(release): capture current production source)

  useEffect(() => {
    const scopeChanged = previousScope.current !== scopeKey;
    previousScope.current = scopeKey;
<<<<<<< HEAD
<<<<<<< HEAD
    if (!scopeChanged) return;
    updateSearch((next) => {
      next.delete('cursor');
      next.delete('selected');
    }, true);
  }, [scopeKey, updateSearch]);

  useEffect(() => {
    if (page === undefined || selectedId === undefined || selectedRow !== undefined) return;
    updateSearch((next) => next.delete('selected'), true);
  }, [page, selectedId, selectedRow, updateSearch]);
=======
    const hasPreviewOnly = previewOnlyKeys.some((key) => search.has(key));
    if (!scopeChanged && (previewContext || !hasPreviewOnly)) return;
    const next = new URLSearchParams(search);
    if (scopeChanged) {
=======
    if (!scopeChanged) return;
    updateSearch((next) => {
>>>>>>> 018b2a71 (chore(release): capture current production source)
      next.delete('cursor');
      next.delete('selected');
    }, true);
  }, [scopeKey, updateSearch]);

<<<<<<< HEAD
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
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  useEffect(() => {
    if (page === undefined || selectedId === undefined || selectedRow !== undefined) return;
    updateSearch((next) => next.delete('selected'), true);
  }, [page, selectedId, selectedRow, updateSearch]);
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const applyFilterPatch = (value: Partial<FinanceFilter>) =>
    updateSearch((next) => {
      for (const [key, parameter] of Object.entries(filterParameters) as readonly [keyof FinanceFilter, string][]) {
        const patch = value[key];
        if (patch !== undefined) setValue(next, parameter, patch);
      }
      next.delete('cursor');
      next.delete('selected');
    });
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  if (accessCondition !== undefined) {
    return <section className="financeworkspace" aria-label="财务与对账系统">
      <ResourceState condition={accessCondition} resourceLabel="财务与对账系统"
        {...(accessError === undefined ? {} : { error: accessError })}><span /></ResourceState>
    </section>;
  }

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return (
    <section className="financeworkspace" aria-labelledby="financeworkspacetitle">
      <span id="financeworkspacetitle" className="sr-only">
        财务与对账系统
      </span>
      <FinanceHeader
        summary={statusSummary}
        previewEnabled={previewContext}
        fetching={query.isFetching || overviewQuery.isFetching}
        action={headerAction}
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
        exportReady={(tab === 'payments' || tab === 'refunds') && page !== undefined}
        onImport={() => setImportOpen(true)}
        onExport={() => {
          if (page === undefined || (tab !== 'payments' && tab !== 'refunds')) return;
          downloadCurrentPageCsv({
            rows: page.items,
            columns: financeCsvColumns(tab),
            filename: timestampedCsvFilename(`finance-${tab}-current-page`),
          });
        }}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
        onAction={setHeaderAction}
        onCloseAction={() => setHeaderAction(undefined)}
        onRefresh={() => {
          void query.refetch();
          void overviewQuery.refetch();
        }}
      />
      <FinanceTabs context={context} active={tab} />
<<<<<<< HEAD
<<<<<<< HEAD
      {tab === 'rules' || tab === 'audit' ? (
        <FinanceAuthorityTab context={context} tab={tab} queryInput={{ limit, ...(cursor === undefined ? {} : { cursor }) }} previewContext={previewContext} onLimit={setLimit} onCursor={setCursor} />
      ) : (
        <>
          <div className="financetoolbararea">
            <FinanceFilters value={filter} enabled facets={page?.facets ?? page?.preview?.facets} columnsOpen={columnsOpen} onApply={applyFilters} onPatch={applyFilterPatch} onColumns={() => setColumnsOpen((open) => !open)} />
=======
      {tab !== 'payments' ? (
        <UnavailableTab tab={tab} />
      ) : (
        <>
          <div className="financetoolbararea">
            <FinanceFilters value={filter} previewEnabled={previewContext} facets={previewEnabled ? page?.preview?.facets : undefined} columnsOpen={columnsOpen} onApply={applyFilters} onColumns={() => setColumnsOpen((open) => !open)} />
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      {tab === 'rules' || tab === 'audit' ? (
        <FinanceAuthorityTab context={context} tab={tab} queryInput={{ limit, ...(cursor === undefined ? {} : { cursor }) }} previewContext={previewContext} onLimit={setLimit} onCursor={setCursor} />
      ) : (
        <>
          <div className="financetoolbararea">
            <FinanceFilters value={filter} enabled facets={page?.facets ?? page?.preview?.facets} columnsOpen={columnsOpen} onApply={applyFilters} onPatch={applyFilterPatch} onColumns={() => setColumnsOpen((open) => !open)} />
>>>>>>> 018b2a71 (chore(release): capture current production source)
            <FinanceColumnSettings open={columnsOpen} visible={visibleColumns} onToggle={toggleColumn} onClose={() => setColumnsOpen(false)} />
          </div>
          {!previewContext ? (
            <p className="financeproductionboundary">
              <FinanceIcon name="shield" />
<<<<<<< HEAD
<<<<<<< HEAD
              当前结果、筛选与游标分页均来自服务端权威读模型；浏览器不重算全量状态或金额。
=======
              生产范围仅展示服务端实际返回；关键词与业务筛选等待权威读合同。
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
              当前结果、筛选与游标分页均来自服务端权威读模型；浏览器不重算全量状态或金额。
>>>>>>> 018b2a71 (chore(release): capture current production source)
            </p>
          ) : null}
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
              <ReconciliationTable
                caption={tab === 'refunds' ? '退款对账批次' : '支付对账批次'}
                page={page}
                previewEnabled={previewEnabled}
                visible={visibleColumns}
                selected={selectedRows}
                onToggle={toggleRow}
                onToggleAll={toggleAll}
                onOpen={openRow}
              />
<<<<<<< HEAD
=======
              <ReconciliationTable page={page} previewEnabled={previewEnabled} visible={visibleColumns} selected={selectedRows} onToggle={toggleRow} onToggleAll={toggleAll} onOpen={openRow} />
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
              <FinancePagination page={page} previewEnabled={previewEnabled} limit={limit} onLimit={setLimit} onCursor={setCursor} />
            </>
          )}
        </>
      )}
      <ReconciliationDrawer row={selectedRow} previewEnabled={previewEnabled} onClose={closeDrawer} />
<<<<<<< HEAD
<<<<<<< HEAD
      <LocalImportDialog open={importOpen} title="导入财务数据" resourceLabel="财务数据" onClose={() => setImportOpen(false)} />
=======
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
      <span>{detail[1]} 本页不会用演示数据替代生产事实。</span>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      <LocalImportDialog open={importOpen} title="导入财务数据" resourceLabel="财务数据" onClose={() => setImportOpen(false)} />
>>>>>>> 018b2a71 (chore(release): capture current production source)
    </section>
  );
}

function readTab(search: URLSearchParams): FinanceTab {
  const parsed = FinanceTabSchema.safeParse(search.get('tab') ?? 'payments');
  return parsed.success ? parsed.data : 'payments';
}
<<<<<<< HEAD
<<<<<<< HEAD
function readFilter(search: URLSearchParams): FinanceFilter {
=======
function readFilter(search: URLSearchParams, preview: boolean): FinanceFilter {
  if (!preview) return emptyFinanceFilter;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
function readFilter(search: URLSearchParams): FinanceFilter {
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return { q: search.get('q') ?? '', period: search.get('reconPeriod') ?? '', channel: search.get('channel') ?? '', mall: search.get('mall') ?? '', status: search.get('status') ?? '', difference: search.get('difference') ?? '' };
}
function readLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  return [20, 50].includes(parsed) ? parsed : 50;
}
function setValue(search: URLSearchParams, key: string, value: string) {
  if (value === '') search.delete(key);
  else search.set(key, value);
}
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

const filterParameters: Readonly<Record<keyof FinanceFilter, string>> = Object.freeze({
  q: 'q',
  period: 'reconPeriod',
  channel: 'channel',
  mall: 'mall',
  status: 'status',
  difference: 'difference',
});
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
