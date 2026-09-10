import { presentError, resourceCondition, resourceState } from '@shop/presentation';
import { OP_CATALOG_POOLS_ATTACH, OP_QUALIFICATION_CENTER_READ } from '@shop/contract/ids';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { usePreference } from '../../../shared/preference/PreferenceState';
import type { Listing } from '../model/Product';
import type { ProductAction } from '../model/ProductAction';
import { toggleSelection, visibleSelection } from '../model/ProductSelection';
import type { ProductFilter } from '../model/ProductFilter';
import { EMPTY_PRODUCT_FILTER } from '../model/ProductFilter';
import type { ProductColumnKey } from '../view/ProductTable';
import { useProductBatchViewModel } from './ProductBatchViewModel';
import { useProductDrawerViewModel } from './ProductDrawerViewModel';
import type { PoolMode } from './ProductPoolViewModel';
import { productFacetKey, productKey } from './ProductQueryKey';
import { PRODUCT_COLUMN_PREFERENCE } from './ProductColumns';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { normalizeProductFacets } from './ProductFacetMapper';
import { productAccess } from './ProductAccess';
import { productQuery } from './ProductQueryState';
import { useProductWorkflows } from './ProductWorkflows';

export function useProductViewModel(context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void) {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const url = productQuery.read(search);
  const { limit, page } = url;
  const filter = Object.freeze({ q: url.q, category: url.category, supplier: url.supplier, mall: url.mall, status: url.status, limit, ...(url.cursor === undefined ? {} : { cursor: url.cursor }) });
  const [filterdraft, setFilterDraft] = useState<ProductFilter>({ q: filter.q, category: filter.category, supplier: filter.supplier, mall: filter.mall, status: filter.status });
  useEffect(() => setFilterDraft({ q: filter.q, category: filter.category, supplier: filter.supplier, mall: filter.mall, status: filter.status }), [filter.category, filter.mall, filter.q, filter.status, filter.supplier]);
  const request = Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
  const query = useQuery({ queryKey: productKey(context, filter), queryFn: ({ signal }) => dependencies.readProducts.execute(request, filter, signal) });
  const facets = useQuery({ queryKey: productFacetKey(context, url.q), queryFn: ({ signal }) => dependencies.readFacets.execute(request, { q: url.q }, signal), staleTime: 30_000 });
  const filterfacets = useMemo(() => normalizeProductFacets(facets.data, context), [context, facets.data]);
  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [columnsopen, setColumnsOpen] = useState(false);
  const preference = useMemo(
    () =>
      Object.freeze({
        actor: context.session.actor,
        membership: context.session.membership,
        scope: Object.freeze({ kind: context.scope.kind, id: context.scope.id }),
        view: 'products',
        name: 'columns',
      }),
    [context.scope.id, context.scope.kind, context.session.actor, context.session.membership]
  );
  const [columnpreference, setColumnPreference] = usePreference(dependencies.preferences, preference, PRODUCT_COLUMN_PREFERENCE);
  const columns = useMemo<ReadonlySet<ProductColumnKey>>(() => new Set(columnpreference), [columnpreference]);
  const cursors = useRef(new Map<number, string | undefined>([[1, undefined]]));
  const visible = useMemo(() => visibleSelection(rows, selected), [rows, selected]);
  const access = productAccess(context);
  const selectedid = url.selected;
  const selectedlisting = rows.find((item) => item.id === selectedid);
  const workflows = useProductWorkflows(
    context,
    dependencies,
    requestStepup,
    rows,
    limit,
    () => void query.refetch(),
    () => {
      cursors.current = new Map([[1, undefined]]);
    }
  );
  const batch = useProductBatchViewModel(context, dependencies, requestStepup, (receipt) => {
    workflows.commands.notify(receipt.failed > 0 ? `批量操作完成：${receipt.count} 项成功，${receipt.failed} 项失败；可在收据中仅重试失败项。` : `批量操作完成：${receipt.count} 项全部成功。`);
    setSelected(new Set(receipt.items.filter(({ state: itemState }) => itemState === 'failed').map(({ id }) => id)));
    void query.refetch();
  });

  const updateSearch = (values: Parameters<typeof productQuery.patch>[1]) => {
    const next = productQuery.patch(search, { selected: undefined, ...values });
    setSelected(new Set());
    setSearch(next);
  };
  const drawervm = useProductDrawerViewModel(selectedlisting, context, dependencies);
  const error = query.error === null ? undefined : presentError(query.error).message;
  const faceterror = facets.error === null ? undefined : presentError(facets.error).message;
  const state = resourceState({
    pending: query.isPending,
    fetching: query.isFetching,
    ...(query.data === undefined ? {} : { data: query.data }),
    empty: rows.length === 0,
    ...(query.error === null ? {} : { error: query.error }),
    updatedAt: new Date(query.dataUpdatedAt).toISOString(),
  });
  return Object.freeze({
    resource: Object.freeze({ state, condition: resourceCondition(state), ...(error === undefined ? {} : { error }), refresh: () => void query.refetch() }),
    rows,
    filter: filterdraft,
    facets: Object.freeze({
      ...(filterfacets === undefined ? {} : { data: filterfacets }),
      loading: facets.isPending,
      ...(faceterror === undefined ? {} : { error: faceterror }),
      retry: () => void facets.refetch(),
    }),
    page,
    limit,
    columns,
    selected: visible,
    selectedid,
    message: workflows.message,
    access,
    batch,
    drawer: drawervm,
    action: workflows.action,
    pool: workflows.pool,
    columnsopen,
    actions: Object.freeze({
      changeFilter: setFilterDraft,
      applyFilter: () => {
        cursors.current = new Map([[1, undefined]]);
        setSelected(new Set());
        setSearch(productQuery.patch(search, { q: filterdraft.q, category: filterdraft.category, supplier: filterdraft.supplier, mall: filterdraft.mall, status: filterdraft.status, limit, page: 1, cursor: undefined, selected: undefined }));
      },
      resetFilter: () => {
        setFilterDraft(EMPTY_PRODUCT_FILTER);
        cursors.current = new Map([[1, undefined]]);
        setSelected(new Set());
        setSearch(productQuery.reset(search));
      },
      open: (listing: Listing) => {
        setSearch(productQuery.patch(search, { selected: listing.id }));
      },
      openDetail: (listing: Listing) => {
        if (typeof listing.product_id === 'string') void navigate(scopeRoutePath(context.scope, 'consoleproductdetail', { productId: listing.product_id }));
      },
      close: () => {
        setSearch(productQuery.patch(search, { selected: undefined }));
      },
      select: (id: string) => setSelected((current) => toggleSelection(current, id)),
      selectPage: () =>
        setSelected((current) => {
          const next = new Set(current);
          const remove = rows.length > 0 && rows.every((row) => next.has(row.id));
          for (const row of rows) {
            if (remove) next.delete(row.id);
            else next.add(row.id);
          }
          return next;
        }),
      openBatch: (published: boolean) =>
        batch.actions.open(
          published,
          rows.filter((row) => visible.has(row.id))
        ),
      openAction: (value: ProductAction | null) => {
        if (value === null || access.canOperation(value.operation)) workflows.commands.openAction(value);
      },
      closeAction: workflows.commands.closeAction,
      openPools: (listing?: Listing, intent?: PoolMode) => {
        if (listing === undefined ? !access.canManagePools : intent === 'deliver' ? !access.canOperation(OP_CATALOG_POOLS_ATTACH) : !access.canMoveListing) return;
        workflows.commands.openPools(listing, intent);
      },
      closePools: workflows.commands.closePools,
      openQualification: (_listing: Listing) => {
        if (!access.canOperation(OP_QUALIFICATION_CENTER_READ)) return;
        void navigate(scopeRoutePath(context.scope, 'consolequalification'));
      },
      openColumns: () => setColumnsOpen(true),
      closeColumns: () => setColumnsOpen(false),
      toggleColumn: (key: ProductColumnKey) => setColumnPreference([...toggleSelection(columns, key)]),
      next: () => {
        const cursor = query.data?.nextCursor;
        if (cursor === undefined) return;
        cursors.current.set(page + 1, cursor);
        updateSearch({ cursor, page: page + 1 });
      },
      previous: () => {
        if (page <= 1) return;
        const target = page - 1;
        const cursor = cursors.current.get(target);
        updateSearch({ cursor: target === 1 ? undefined : cursor, page: target });
      },
      limit: (value: number) => {
        cursors.current = new Map([[1, undefined]]);
        updateSearch({ cursor: undefined, page: 1, limit: value });
      },
    }),
    pagination: Object.freeze({ count: query.data?.count ?? 0, canPrevious: page === 2 || (page > 2 && cursors.current.has(page - 1)), canNext: query.data?.nextCursor !== undefined }),
  });
}

export type ProductViewModel = ReturnType<typeof useProductViewModel>;
