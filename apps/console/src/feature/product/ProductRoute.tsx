import { queryCondition, presentError, safeQueryError } from '@shop/presentation';
import { ResourceState } from '@shop/design';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import { ProductCatalogHeader } from './ProductCatalogHeader';
import { ProductActionDialog, PoolDialog, type ProductAction } from './ProductActions';
import { setListingsPublication } from './ProductCommand';
import { ProductColumnSettings } from './ProductColumnSettings';
import { ProductDrawer } from './ProductDrawer';
import { ProductFilterForm } from './ProductFilter';
import { ProductPagination } from './ProductPagination';
import { productDetailKey, productKey, readProducts, type ProductQuery } from './ProductQuery';
import type { Listing, ProductFilter } from './ProductSchema';
import { ProductTable, type ProductColumnKey } from './ProductTable';
import './Layout.css';
import './Table.css';
import './Dialogs.css';
import './Drawer.css';
import './DrawerPanels.css';
import './Responsive.css';

const allColumns: readonly ProductColumnKey[] = Object.freeze(['category', 'sku', 'malls', 'price', 'stock', 'status', 'updated']);
const pageSizes = new Set([20, 50, 100]);
const unsupportedSearchKeys = ['supplier', 'mall'] as const;

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const limitValue = Number(search.get('limit') ?? 50);
  const limit = pageSizes.has(limitValue) ? limitValue : 50;
  const pageValue = Number(search.get('page') ?? 1);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const filter: ProductQuery = {
    q: search.get('q') ?? '',
    category: search.get('category') ?? '',
    limit,
    ...(search.get('cursor') === null ? {} : { cursor: search.get('cursor')! }),
  };
  const query = useQuery({ queryKey: productKey(context, filter), queryFn: ({ signal }) => readProducts(context, filter, signal), staleTime: 5 * 60_000 });
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 });
  const selectedId = search.get('selected') ?? undefined;
  const selectedListing = query.data?.items.find((item) => item.id === selectedId);
  const status = search.get('status') ?? '';
  const rows = useMemo(() => (query.data?.items ?? []).filter((item) => matchesStatus(item.status, status)), [query.data?.items, status]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [action, setAction] = useState<ProductAction | null>(null);
  const [poolsOpen, setPoolsOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>();
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<ProductColumnKey>>(() => new Set(allColumns));
  const cursorTrail = useRef(new Map<number, string | undefined>([[1, undefined]]));
  const visibleSelected = useMemo(() => new Set(rows.filter((row) => selected.has(row.id)).map((row) => row.id)), [rows, selected]);
  const batch = useMutation({
    mutationFn: (published: boolean) => setListingsPublication(context, [...visibleSelected], published),
    onSuccess: (result) => {
      setActionMessage(`批量操作完成：${result.count} 条记录已更新`);
      setSelected(new Set());
      void query.refetch();
    },
  });
  useEffect(() => {
    if (!unsupportedSearchKeys.some((key) => search.has(key))) return;
    const next = new URLSearchParams(search);
    unsupportedSearchKeys.forEach((key) => next.delete(key));
    setSearch(next, { replace: true });
  }, [search, setSearch]);

  const apply = (value: ProductFilter) => {
    const next = new URLSearchParams();
    if (value.q !== '') next.set('q', value.q);
    if (value.category !== '') next.set('category', value.category);
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
  const nextPage = () => {
    if (query.data?.nextCursor === undefined) return;
    const cursor = query.data.nextCursor;
    cursorTrail.current.set(page + 1, cursor);
    changeSearch((next) => {
      next.set('cursor', cursor);
      next.set('page', String(page + 1));
    });
  };
  const previousPage = () => {
    if (page <= 1) return;
    const target = page - 1;
    const cursor = cursorTrail.current.get(target);
    changeSearch((next) => {
      if (target === 1) next.delete('cursor');
      else if (cursor !== undefined) next.set('cursor', cursor);
      next.set('page', String(target));
    });
  };
  const changeLimit = (nextLimit: number) => {
    cursorTrail.current = new Map([[1, undefined]]);
    changeSearch((next) => {
      next.delete('cursor');
      next.delete('page');
      if (nextLimit === 50) next.delete('limit');
      else next.set('limit', String(nextLimit));
    });
  };
  const toggleRow = (id: string) => setSelected((current) => toggled(current, id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      const remove = rows.length > 0 && rows.every((row) => next.has(row.id));
      for (const row of rows) {
        if (remove) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  const toggleColumn = (key: ProductColumnKey) => setVisibleColumns((current) => toggled(current, key));
  const canPrevious = page === 2 || (page > 2 && cursorTrail.current.has(page - 1));

  return (
    <section className="productpage" data-drawer={selectedListing === undefined ? 'closed' : 'open'}>
      <ProductCatalogHeader
        status={status}
        onStatus={(nextStatus) =>
          changeSearch((next) => {
            if (nextStatus === '') next.delete('status');
            else next.set('status', nextStatus);
          })
        }
        onCreate={() => setAction({ kind: 'create' })}
        onPools={() => setPoolsOpen(true)}
      />
      <section className="productcontrols" aria-label="商品筛选">
        <ProductFilterForm value={{ q: filter.q ?? '', category: filter.category ?? '', supplier: '', mall: '', status: '' }} onApply={apply} onColumns={() => setColumnsOpen(true)} />
        <p className="productservertime">
          <span aria-hidden="true" />
          {query.isFetching ? '正在同步服务端数据…' : '服务端未返回列表数据时钟'}
        </p>
      </section>
      <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={() => void query.refetch()}>
        {query.data === undefined ? (
          <span />
        ) : (
          <div className="productcatalog">
            {actionMessage === undefined ? null : (
              <p role="status" className="productactionmessage">
                {actionMessage}
              </p>
            )}
            {batch.error === null ? null : (
              <p role="alert" className="productflowerror">
                {presentError(batch.error).message}
              </p>
            )}
            <ProductTable
              rows={rows}
              visibleColumns={visibleColumns}
              selected={visibleSelected}
              {...(selectedId === undefined ? {} : { activeId: selectedId })}
              onToggle={toggleRow}
              onToggleAll={toggleAll}
              onOpen={openDrawer}
              onBatch={(published) => batch.mutate(published)}
            />
            <ProductPagination count={query.data.count} page={page} limit={limit} canPrevious={canPrevious} canNext={query.data.nextCursor !== undefined} onPrevious={previousPage} onNext={nextPage} onLimit={changeLimit} />
          </div>
        )}
      </ResourceState>
      <ProductDrawer {...(selectedListing === undefined ? {} : { listing: selectedListing })} onClose={closeDrawer} onAction={setAction} />
      <ProductColumnSettings open={columnsOpen} visible={visibleColumns} onChange={toggleColumn} onClose={() => setColumnsOpen(false)} />
      <ProductActionDialog
        action={action}
        context={context}
        onClose={() => setAction(null)}
        onDone={() => {
          const productId = action !== null && 'listing' in action ? action.listing.product_id : undefined;
          setAction(null);
          setActionMessage('商品操作已完成');
          void query.refetch();
          if (productId !== undefined) void queryClient.invalidateQueries({ queryKey: productDetailKey(context, productId) });
        }}
      />
      <PoolDialog open={poolsOpen} context={context} onClose={() => setPoolsOpen(false)} onDone={() => setActionMessage('商品池操作已完成')} />
    </section>
  );
}

function matchesStatus(value: string, filter: string): boolean {
  if (filter === '') return true;
  if (filter === 'needs_attention') return value === 'needs_attention' || value === 'incomplete' || value === 'draft';
  if (filter === 'pending_review') return value === 'pending_review' || value === 'review';
  if (filter === 'unpublished') return value === 'unpublished' || value === 'offline' || value === 'archived';
  return value === filter;
}

function toggled<T>(current: ReadonlySet<T>, key: T): ReadonlySet<T> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
