import { ResourceState } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { downloadCurrentPageCsv, timestampedCsvFilename, type CsvColumn } from '../../shared/export/CurrentPageCsv';
import { LocalImportDialog } from '../../shared/ui/LocalImportDialog';
import { ProductBatchPreview } from './ProductBatchPreview';
import { ProductCatalogHeader } from './ProductCatalogHeader';
import { ProductColumnSettings } from './ProductColumnSettings';
import { ProductDrawer } from './ProductDrawer';
import { ProductFilterForm } from './ProductFilter';
import { ProductPagination } from './ProductPagination';
import { productKey, readProducts, type ProductQuery } from './ProductQuery';
import type { Listing, ProductFilter } from './ProductSchema';
import { ProductTable, type ProductColumnKey } from './ProductTable';
import './product.css';
import './product-table.css';
import './product-dialogs.css';
import './product-drawer.css';
import './product-drawer-panels.css';
import './product-responsive.css';

const allColumns: readonly ProductColumnKey[] = Object.freeze(['category', 'sku', 'malls', 'price', 'stock', 'status', 'updated']);
const pageSizes = new Set([20, 50, 100]);
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
  { header: '更新时间', value: (row) => row.cursor_sort },
]);

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const previewScope = context.scope.kind === 'platform' && context.scope.id === 'platform:preview';
  const limitValue = Number(search.get('limit') ?? 50);
  const limit = pageSizes.has(limitValue) ? limitValue : 50;
  const pageValue = Number(search.get('page') ?? 1);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const filter: ProductQuery = {
    q: search.get('q') ?? '',
    category: search.get('category') ?? '',
    supplier: previewScope ? (search.get('supplier') ?? '') : '',
    mall: previewScope ? (search.get('mall') ?? '') : '',
    status: previewScope ? (search.get('status') ?? '') : '',
    limit,
    preview: previewScope,
    ...(search.get('cursor') === null ? {} : { cursor: search.get('cursor')! }),
  };
  const query = useQuery({
    queryKey: productKey(context, filter),
    queryFn: ({ signal }) => readProducts(context, filter, signal),
    staleTime: 5 * 60_000,
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
  const [importOpen, setImportOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<ProductColumnKey>>(() => new Set(allColumns));
  const cursorTrail = useRef(new Map<number, string | undefined>([[1, undefined]]));
  const visibleSelected = useMemo(() => new Set(query.data?.items.filter((row) => selected.has(row.id)).map((row) => row.id) ?? []), [query.data?.items, selected]);
  const selectedRows = query.data?.items.filter((row) => visibleSelected.has(row.id)) ?? [];

  const apply = (value: ProductFilter) => {
    const next = new URLSearchParams();
    if (value.q !== '') next.set('q', value.q);
    if (value.category !== '') next.set('category', value.category);
    if (previewScope && value.supplier !== '') next.set('supplier', value.supplier);
    if (previewScope && value.mall !== '') next.set('mall', value.mall);
    if (previewScope && value.status !== '') next.set('status', value.status);
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

  if (condition === 'unauthenticated' || condition === 'denied') {
    return (
      <section className="productpage">
        <ResourceState
          condition={condition}
          resourceLabel="商品治理台"
          {...(error === undefined ? {} : { error })}
          retry={() => {
            void query.refetch();
          }}
        >
          <span />
        </ResourceState>
      </section>
    );
  }

  return (
    <section className="productpage" data-drawer={selectedListing === undefined ? 'closed' : 'open'}>
      <ProductCatalogHeader
        {...(query.data === undefined ? {} : { page: query.data })}
        previewEnabled={previewEnabled}
        status={filter.status ?? ''}
        exportReady={query.data !== undefined}
        onImport={() => setImportOpen(true)}
        onExport={() => {
          if (query.data === undefined) return;
          downloadCurrentPageCsv({
            rows: query.data.items,
            columns: productCsvColumns,
            filename: timestampedCsvFilename('products-current-page'),
          });
        }}
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
        condition={condition}
        resourceLabel="商品治理台"
        {...(error === undefined ? {} : { error })}
        retry={() => {
          void query.refetch();
        }}
      >
        {query.data === undefined ? (
          <span />
        ) : (
          <div className="productcatalog">
            <ProductTable
              rows={query.data.items}
              previewEnabled={previewEnabled}
              visibleColumns={visibleColumns}
              selected={visibleSelected}
              {...(selectedId === undefined ? {} : { activeId: selectedId })}
              onToggle={toggleRow}
              onToggleAll={toggleAll}
              onOpen={openDrawer}
              onBatchPreview={() => setBatchOpen(true)}
            />
            <ProductPagination
              count={query.data.count}
              {...(previewEnabled && query.data.preview !== undefined ? { total: query.data.preview.totalCount } : {})}
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
      <ProductDrawer {...(selectedListing === undefined ? {} : { listing: selectedListing })} previewEnabled={previewEnabled} onClose={closeDrawer} />
      <ProductColumnSettings open={columnsOpen} visible={visibleColumns} onChange={toggleColumn} onClose={() => setColumnsOpen(false)} />
      <ProductBatchPreview open={batchOpen} rows={selectedRows} onClose={() => setBatchOpen(false)} />
      <LocalImportDialog open={importOpen} title="导入商品" resourceLabel="商品" onClose={() => setImportOpen(false)} />
    </section>
  );
}

function formatRailTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
