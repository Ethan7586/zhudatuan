import { ResourceState, WorkspacePanelSkeleton } from '@shop/design';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { ProductCatalogHeader } from './ProductCatalogHeader';
import { ProductPagination } from './ProductPagination';
import { prefetchProducts } from './ProductPrefetch';
import { ProductSelectionCenter } from './ProductSelectionCenter';
import { canSelectProducts, selectProducts } from './ProductSelectionCommand';
import { productKey, readProducts, type ProductQuery } from './ProductQuery';
import { changeProductPageSize, goToNextProductPage, goToPreviousProductPage, switchProductWorkspace,
  type ProductWorkspace } from './ProductWorkspaceNavigation';
import './product.css';
import './product-selection.css';

const pageSizes = new Set([20, 50, 100]);
const defaultPageSize = 20;

export function ProductSelectionRoute() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const limitValue = Number(search.get('limit') ?? defaultPageSize);
  const limit = pageSizes.has(limitValue) ? limitValue : defaultPageSize;
  const pageValue = Number(search.get('page') ?? 1);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const filter: ProductQuery = {
    q: search.get('q') ?? '', category: '', supplier: '', mall: '', status: '', limit,
    preview: false, view: 'selection-center',
    ...(search.get('cursor') === null ? {} : { cursor: search.get('cursor')! }),
  };
  const query = useQuery({
    queryKey: productKey(context, filter),
    queryFn: ({ signal }) => readProducts(context, filter, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
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
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const cursorTrail = useRef(new Map<number, string | undefined>([[1, undefined]]));
  const selection = useMutation({
    mutationFn: (ids: readonly string[]) => selectProducts(context, ids),
    onSuccess: () => {
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: catalogListingScopeKey(context) });
    },
  });

  const changeWorkspace = (workspace: ProductWorkspace) =>
    switchProductWorkspace(workspace, cursorTrail, () => setSelected(new Set()), setSearch);
  const prepareWorkspace = (workspace: ProductWorkspace) => {
    if (workspace === 'selection') return;
    void import('./ProductCatalogRoute');
    void prefetchProducts(queryClient, context);
  };
  const applyQuery = (value: string) => {
    const next = new URLSearchParams();
    next.set('workspace', 'selection');
    if (value !== '') next.set('q', value);
    if (limit !== defaultPageSize) next.set('limit', String(limit));
    cursorTrail.current = new Map([[1, undefined]]);
    setSelected(new Set());
    setSearch(next);
  };
  const changeSearch = (update: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    update(next);
    setSelected(new Set());
    setSearch(next);
  };
  const nextPage = () => goToNextProductPage(query.data?.nextCursor, page, cursorTrail, changeSearch);
  const previousPage = () => goToPreviousProductPage(page, cursorTrail, changeSearch);
  const changeLimit = (nextLimit: number) =>
    changeProductPageSize(nextLimit, defaultPageSize, cursorTrail, changeSearch);
  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = (ids: readonly string[]) => {
    setSelected((current) => {
      const next = new Set(current);
      const remove = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (remove) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };
  const canPrevious = page === 2 || (page > 2 && cursorTrail.current.has(page - 1));

  if (condition === 'denied') {
    return <ResourceState condition="denied" resourceLabel="选品中心"
      {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}><span /></ResourceState>;
  }

  const feedback = selection.error !== null
    ? `选入失败：${selection.error instanceof Error ? selection.error.message : '请稍后重试'}`
    : selection.data === undefined ? undefined : `已选入 ${selection.data.count} 件商品`;
  return (
    <section className="productpage">
      <ProductCatalogHeader
        {...(query.data === undefined ? {} : { page: query.data })}
        previewEnabled={false}
        partnerWorkspace={false}
        workspace="selection"
        onWorkspace={changeWorkspace}
        onWorkspaceIntent={prepareWorkspace}
        status=""
        exportReady={false}
        writeEnabled={false}
        releasePending={false}
        onImport={() => undefined}
        onCreate={() => undefined}
        onRelease={() => undefined}
        onRetry={() => undefined}
        onExport={() => undefined}
        onStatus={() => undefined}
      />
      {condition === 'loading' ? (
        <WorkspacePanelSkeleton className="selectionloading" label="正在准备选品主数据…" cards={8} />
      ) : <ResourceState condition={condition} {...(error === undefined ? {} : { error })}
        retry={() => { void query.refetch(); }}>
        {query.data === undefined ? <span /> : (
          <>
            <ProductSelectionCenter
              rows={query.data.items}
              query={filter.q}
              selected={selected}
              canSelect={canSelectProducts(context)}
              pending={selection.isPending}
              {...(feedback === undefined ? {} : { feedback })}
              onQuery={applyQuery}
              onToggle={toggleRow}
              onToggleAll={toggleAll}
              onSelect={(ids) => selection.mutate(ids)}
            />
            <ProductPagination count={query.data.items.length} page={page} limit={limit}
              canPrevious={canPrevious} canNext={query.data.nextCursor !== undefined}
              onPrevious={previousPage} onNext={nextPage} onLimit={changeLimit} />
          </>
        )}
      </ResourceState>}
    </section>
  );
}

function catalogListingScopeKey(context: ReturnType<typeof useConsoleContext>) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion,
    'catalog.listings.read'] as const);
}
