import { ResourceState } from '@shop/design';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { downloadCurrentPageCsv, timestampedCsvFilename, type CsvColumn } from '../../shared/export/CurrentPageCsv';
import { scopePath } from '../../shared/url/ScopePath';
import { ProductBatchPreview } from './ProductBatchPreview';
import { ProductCatalogHeader } from './ProductCatalogHeader';
import { ProductColumnSettings } from './ProductColumnSettings';
import { ProductDrawer } from './ProductDrawer';
import { ProductFilterForm } from './ProductFilter';
import { canCreateCatalogImport } from './ProductImportCommand';
import { ProductPagination } from './ProductPagination';
import { prefetchProductSelection } from './ProductPrefetch';
import { changeProductPageSize, goToNextProductPage, goToPreviousProductPage, switchProductWorkspace,
  type ProductWorkspace } from './ProductWorkspaceNavigation';
import { canManageListing, canReadPublicationTask, publishReadyListings, readPublicationTask,
  readyPublicationUnavailableReason, retryPublicationFailures, setListingPublication,
  type ListingPublicationAction } from './ProductPublicationCommand';
import { PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT, productKey, readProducts, type ProductQuery } from './ProductQuery';
import type { CatalogPublicationTask, Listing, ProductFilter } from './ProductSchema';
import { ProductTable, ProductTableSkeleton, type ProductColumnKey } from './ProductTable';
import './product.css';
import './product-table.css';
import './product-dialogs.css';
import './product-drawer.css';
import './product-drawer-panels.css';
import './product-responsive.css';

const allColumns: readonly ProductColumnKey[] = Object.freeze(['category', 'sku', 'malls', 'price', 'stock', 'status', 'updated']);
const coreColumns: readonly ProductColumnKey[] = Object.freeze(['category', 'sku', 'status', 'updated']);
const pageSizes = new Set([20, 50, 100]);
const publicationRefreshInterval = 1_000;
const productCsvColumns: readonly CsvColumn<Listing>[] = Object.freeze([
  { header: '记录ID', value: (row) => row.id },
  { header: '商品ID', value: (row) => row.product_id },
  { header: 'SKU ID', value: (row) => row.sku_id },
  { header: '商品编码', value: (row) => row.code },
  { header: '商品名称', value: (row) => row.title },
  { header: '商品类型', value: (row) => row.product_type },
  { header: '状态', value: (row) => row.status },
  { header: '版本', value: (row) => row.version },
  { header: '生效时间', value: (row) => row.effective_at },
  { header: '失效时间', value: (row) => row.expires_at },
  { header: '更新时间', value: (row) => row.preview?.lastSyncedAt },
]);

export function ProductCatalogRoute() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const partnerWorkspace = context.scope.kind === 'supplier' || context.scope.kind === 'brand';
  const freeWorkspace = !partnerWorkspace && search.get('workspace') === 'free';
  const previewScope = context.scope.kind === 'platform' && context.scope.id === 'platform:preview';
  const defaultPageSize = PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT;
  const limitValue = Number(search.get('limit') ?? defaultPageSize);
  const limit = pageSizes.has(limitValue) ? limitValue : defaultPageSize;
  const pageValue = Number(search.get('page') ?? 1);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const filter: ProductQuery = {
    q: search.get('q') ?? '',
    category: search.get('category') ?? '',
    supplier: previewScope ? (search.get('supplier') ?? '') : '',
    mall: previewScope ? (search.get('mall') ?? '') : '',
    status: search.get('status') ?? '',
    limit,
    preview: previewScope,
    ...(search.get('cursor') === null ? {} : { cursor: search.get('cursor')! }),
  };
  const query = useQuery({
    queryKey: productKey(context, filter),
    queryFn: ({ signal }) => readProducts(context, filter, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: true,
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: query.data?.items.length === 0,
    stale: query.isStale,
  });
  const previewEnabled = previewScope && query.data?.preview?.kind === 'console-product-v1';
  const selectedId = search.get('selected') ?? undefined;
  const selectedListing = query.data?.items.find((item) => item.id === selectedId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [publicationReference, setPublicationReference] = useState(() =>
    readPublicationTaskHint(context) ?? 'catalogpublication:latest');
  const [publicationDiscoveryPending, setPublicationDiscoveryPending] = useState(() =>
    readPublicationTaskHint(context) !== undefined);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden');
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<ProductColumnKey>>(() => new Set(previewScope ? allColumns : coreColumns));
  const cursorTrail = useRef(new Map<number, string | undefined>([[1, undefined]]));
  const launchedPublicationTasks = useRef(new Set<string>());
  const publicationStates = useRef(new Map<string, CatalogPublicationTask['state']>());
  const invalidatedPublicationTasks = useRef(new Set<string>());
  const visibleSelected = useMemo(() => new Set(query.data?.items.filter((row) => selected.has(row.id)).map((row) => row.id) ?? []), [query.data?.items, selected]);
  const selectedRows = query.data?.items.filter((row) => visibleSelected.has(row.id)) ?? [];
  const publicationReadable = canReadPublicationTask(context);
  const publicationKey = useMemo(() => publicationTaskKey(context, publicationReference),
    [context.scope.id, context.scope.kind, context.session.accessVersion, publicationReference]);
  const publicationQuery = useQuery({
    queryKey: publicationKey,
    queryFn: ({ signal }) => readPublicationTask(context, publicationReference, signal),
    enabled: publicationReadable && pageVisible && !freeWorkspace,
    retry: false,
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchInterval: (current) => isPublicationActive(current.state.data) ? publicationRefreshInterval : false,
    refetchIntervalInBackground: false,
  });
  const publicationTask = publicationQuery.data?.state === 'idle' ? undefined : publicationQuery.data;
  const publicationActive = isPublicationActive(publicationTask);
  const publication = useMutation({
    mutationFn: ({ listing, action }: Readonly<{ listing: Listing; action: ListingPublicationAction }>) =>
      setListingPublication(context, listing, action),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: productKey(context, filter) }); },
  });
  const readyPublication = useMutation({
    mutationFn: () => publishReadyListings(context),
    onSuccess: (receipt) => {
      setSelected(new Set());
      launchedPublicationTasks.current.add(receipt.id);
      writePublicationTaskHint(context, receipt.id);
      setPublicationDiscoveryPending(false);
      setPublicationReference(receipt.id);
    },
  });
  const retryPublication = useMutation({
    mutationFn: (task: CatalogPublicationTask) => retryPublicationFailures(context, task),
    onSuccess: (receipt) => {
      launchedPublicationTasks.current.add(receipt.id);
      writePublicationTaskHint(context, receipt.id);
      setPublicationDiscoveryPending(false);
      setPublicationReference(receipt.id);
    },
  });
  useEffect(() => {
    const visibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (pageVisible) return;
    void queryClient.cancelQueries({ queryKey: publicationKey, exact: true });
  }, [pageVisible, publicationKey, queryClient]);
  useEffect(() => {
    const hint = readPublicationTaskHint(context);
    setPublicationReference(hint ?? 'catalogpublication:latest');
    setPublicationDiscoveryPending(hint !== undefined);
  }, [context.scope.id, context.scope.kind]);
  useEffect(() => {
    const task = publicationQuery.data;
    if (task === undefined) return;
    if (publicationDiscoveryPending) {
      if (isPublicationActive(task)) {
        setPublicationDiscoveryPending(false);
      } else {
        setPublicationDiscoveryPending(false);
        setPublicationReference('catalogpublication:latest');
      }
      return;
    }
    if (publicationReference === 'catalogpublication:latest' && task.id !== null) {
      writePublicationTaskHint(context, task.id);
    }
  }, [context.scope.id, context.scope.kind, publicationDiscoveryPending, publicationQuery.data, publicationReference]);
  useEffect(() => {
    if (!publicationDiscoveryPending || publicationQuery.error === null) return;
    clearPublicationTaskHint(context);
    setPublicationDiscoveryPending(false);
    setPublicationReference('catalogpublication:latest');
  }, [context.scope.id, context.scope.kind, publicationDiscoveryPending, publicationQuery.error]);
  useEffect(() => {
    const task = publicationTask;
    if (task?.id === null || task?.id === undefined) return;
    const previous = publicationStates.current.get(task.id);
    publicationStates.current.set(task.id, task.state);
    if (!isPublicationTerminal(task) || invalidatedPublicationTasks.current.has(task.id)
      || (!launchedPublicationTasks.current.has(task.id) && previous !== 'queued' && previous !== 'running')) return;
    invalidatedPublicationTasks.current.add(task.id);
    void queryClient.invalidateQueries({ queryKey: catalogListingScopeKey(context) });
  }, [context.scope.id, context.scope.kind, context.session.accessVersion, publicationTask, queryClient]);
  useEffect(() => {
    return () => {
      void queryClient.cancelQueries({ queryKey: publicationKey, exact: true });
    };
  }, [publicationKey, queryClient]);
  const writeEnabled = canCreateCatalogImport(context);
  const releaseDisabledReason = readyPublication.isPending
    ? '正在创建审核上架任务，请勿重复操作'
    : retryPublication.isPending ? '正在创建失败项重试任务，请勿重复操作'
      : publicationActive ? '审核上架任务正在执行，请勿重复操作'
        : publicationReadable && publicationQuery.isPending ? '正在从服务端恢复发布任务状态'
          : publicationReadable && publicationQuery.error !== null ? '发布任务状态读取失败，请刷新页面后重试'
            : readyPublicationUnavailableReason(context)
              ?? (query.data?.status_counts === undefined
                ? '正在读取待审核商品数量'
                : query.data.status_counts.pending_review === 0 ? '当前商城没有待审核商品' : undefined);
  const releaseFeedback = readyPublication.error !== null
    ? { tone: 'error' as const, message: readyPublication.error instanceof Error
      ? `审核上架失败：${readyPublication.error.message}` : '一键审核上架失败' }
    : retryPublication.error !== null ? { tone: 'error' as const, message: retryPublication.error instanceof Error
      ? `失败项重试创建失败：${retryPublication.error.message}` : '失败项重试创建失败' }
      : publicationQuery.error !== null && !publicationDiscoveryPending
        ? { tone: 'error' as const, message: '发布任务状态读取失败，请刷新页面后重试。' } : undefined;
  const prepareWorkspace = (workspace: ProductWorkspace) => {
    if (workspace !== 'selection' && workspace !== 'pending') return;
    void import('./ProductSelectionRoute');
    if (workspace === 'selection') void prefetchProductSelection(queryClient, context);
  };

  const changeWorkspace = (workspace: ProductWorkspace) =>
    switchProductWorkspace(workspace, cursorTrail, () => setSelected(new Set()), setSearch);

  const apply = (value: ProductFilter) => {
    const next = new URLSearchParams();
    if (freeWorkspace) next.set('workspace', 'free');
    if (value.q !== '') next.set('q', value.q);
    if (value.category !== '') next.set('category', value.category);
    if (previewScope && value.supplier !== '') next.set('supplier', value.supplier);
    if (previewScope && value.mall !== '') next.set('mall', value.mall);
    if (value.status !== '') next.set('status', value.status);
    if (limit !== 50) next.set('limit', String(limit));
    cursorTrail.current = new Map([[1, undefined]]);
    setSelected(new Set());
    setSearch(next);
  };
  const changeSearch = (update: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    next.delete('selected');
    update(next);
    setSelected(new Set());
    setSearch(next);
  };
  const openDrawer = (listing: Listing) => {
    const next = new URLSearchParams(search);
    next.set('selected', listing.id);
    setSearch(next);
  };
  const closeDrawer = () => {
    const next = new URLSearchParams(search);
    next.delete('selected');
    setSearch(next);
  };
  const nextPage = () => goToNextProductPage(query.data?.nextCursor, page, cursorTrail, changeSearch);
  const previousPage = () => goToPreviousProductPage(page, cursorTrail, changeSearch);
  const changeLimit = (nextLimit: number) =>
    changeProductPageSize(nextLimit, defaultPageSize, cursorTrail, changeSearch);
  const toggleRow = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      const rows = query.data?.items ?? [];
      const remove = rows.length > 0 && rows.every((row) => next.has(row.id));
      for (const row of rows) {
        if (remove) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  const toggleColumn = (key: ProductColumnKey) =>
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const canPrevious = page === 2 || (page > 2 && cursorTrail.current.has(page - 1));

  if (condition === 'denied') {
    return <ResourceState condition="denied" resourceLabel={partnerWorkspace ? '供货工作台' : '商品管理'}
      {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}><span /></ResourceState>;
  }

  return (
    <section className="productpage" data-drawer={selectedListing === undefined ? 'closed' : 'open'}>
      <div className="productworkspace">
        <div className="productdirectory">
          <ProductCatalogHeader
        {...(query.data === undefined ? {} : { page: query.data })}
        previewEnabled={previewEnabled}
        partnerWorkspace={partnerWorkspace}
        workspace={freeWorkspace ? 'free' : 'catalog'}
        onWorkspaceIntent={prepareWorkspace}
        onWorkspace={changeWorkspace}
        status={filter.status ?? ''}
        exportReady={query.data !== undefined}
        writeEnabled={writeEnabled}
        {...(releaseDisabledReason === undefined ? {} : { releaseDisabledReason })}
        releasePending={readyPublication.isPending || retryPublication.isPending || publicationActive}
        {...(publicationTask === undefined ? {} : { publicationTask })}
        {...(releaseFeedback === undefined ? {} : { releaseFeedback })}
        onImport={() => { void navigate(`${scopePath(context.scope, 'products/owned/new')}?mode=batch`); }}
        onCreate={() => { void navigate(scopePath(context.scope, 'products/owned/new')); }}
        onRelease={() => readyPublication.mutate()}
        onRetry={() => publicationTask === undefined ? undefined : retryPublication.mutate(publicationTask)}
        onExport={() => downloadCurrentPageCsv({ rows: query.data?.items ?? [], columns: productCsvColumns,
          filename: timestampedCsvFilename('products-current-page') })}
        onStatus={(status) => apply({ q: filter.q, category: filter.category, supplier: filter.supplier ?? '', mall: filter.mall ?? '', status })}
          />
          <section className="productcontrols" aria-label="商品筛选">
        <ProductFilterForm
          value={{ q: filter.q, category: filter.category, supplier: filter.supplier ?? '', mall: filter.mall ?? '', status: filter.status ?? '' }}
          {...(previewEnabled && query.data?.preview !== undefined ? { preview: query.data.preview } : {})}
          onApply={apply}
          onColumns={() => setColumnsOpen(true)}
        />
        <p className="productservertime">
          <span aria-hidden="true" />
          {query.isFetching ? '正在同步服务端数据…' : query.data?.preview?.kind === 'console-product-v1' ? `服务端数据时钟：${formatRailTime(query.data.preview.asOf)}` : '服务端未返回列表数据时钟'}
        </p>
          </section>
          <ResourceState
        condition={condition === 'loading' ? 'ready' : condition}
        {...(error === undefined ? {} : { error })}
        retry={() => {
          void query.refetch();
        }}
      >
        {query.data === undefined ? (
          <div className="productcatalog"><ProductTableSkeleton /></div>
        ) : (
          <div className="productcatalog">
            <ProductTable
              rows={query.data.items}
              compact={selectedListing !== undefined}
              previewEnabled={previewEnabled}
              visibleColumns={visibleColumns}
              selected={visibleSelected}
              {...(selectedId === undefined ? {} : { activeId: selectedId })}
              onToggle={toggleRow}
              onToggleAll={toggleAll}
              onOpen={openDrawer}
              onBatchPreview={() => setBatchOpen(true)}
              canPublish={!partnerWorkspace && canManageListing(context, 'publish')}
              canUnpublish={!partnerWorkspace && canManageListing(context, 'unpublish')}
              {...(publication.isPending && publication.variables !== undefined
                ? { publicationPending: publication.variables.listing.id } : {})}
              onPublication={(listing, action) => publication.mutate({ listing, action })}
            />
            <ProductPagination
              count={query.data.count}
              {...(query.data.total_count !== undefined
                ? { total: query.data.total_count }
                : previewEnabled && query.data.preview !== undefined ? { total: query.data.preview.totalCount } : {})}
              page={page}
              limit={limit}
              canPrevious={canPrevious}
              canNext={query.data.nextCursor !== undefined}
              onPrevious={previousPage}
              onNext={nextPage}
              onLimit={changeLimit}
            />
          </div>
        )}
          </ResourceState>
          {publication.error === null ? null : <p className="productcommanderror" role="alert">
            {publication.error instanceof Error ? publication.error.message : '货架状态更新失败'}
          </p>}
        </div>
        <ProductDrawer {...(selectedListing === undefined ? {} : { listing: selectedListing })} previewEnabled={previewEnabled} onClose={closeDrawer} />
      </div>
      <ProductColumnSettings open={columnsOpen} visible={visibleColumns} onChange={toggleColumn} onClose={() => setColumnsOpen(false)} />
      <ProductBatchPreview open={batchOpen} rows={selectedRows} onClose={() => setBatchOpen(false)} />
    </section>
  );
}

function formatRailTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

function publicationTaskKey(context: ReturnType<typeof useConsoleContext>, reference: string) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion,
    'catalogpublication', reference] as const);
}

function catalogListingScopeKey(context: ReturnType<typeof useConsoleContext>) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion,
    'catalog.listings.read'] as const);
}

function isPublicationActive(task: CatalogPublicationTask | undefined): boolean {
  return task?.state === 'queued' || task?.state === 'running';
}

function isPublicationTerminal(task: CatalogPublicationTask): boolean {
  return task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled';
}

function publicationTaskStorageKey(context: ReturnType<typeof useConsoleContext>): string {
  return `console:catalogpublication:${context.scope.kind}:${context.scope.id}`;
}

function readPublicationTaskHint(context: ReturnType<typeof useConsoleContext>): string | undefined {
  try {
    const value = window.localStorage.getItem(publicationTaskStorageKey(context));
    return value?.startsWith('catalogpublication:') ? value : undefined;
  } catch {
    return undefined;
  }
}

function writePublicationTaskHint(context: ReturnType<typeof useConsoleContext>, id: string): void {
  try { window.localStorage.setItem(publicationTaskStorageKey(context), id); } catch { /* status remains server-owned */ }
}

function clearPublicationTaskHint(context: ReturnType<typeof useConsoleContext>): void {
  try { window.localStorage.removeItem(publicationTaskStorageKey(context)); } catch { /* status remains server-owned */ }
}
