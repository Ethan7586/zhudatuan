import { presentError } from '@shop/presentation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing } from '../model/Product';
import type { ProductAction } from '../model/ProductAction';
import { toggleSelection, visibleSelection } from '../model/ProductSelection';
import type { ProductFilter } from '../model/ProductFilter';
import { EMPTY_PRODUCT_FILTER } from '../model/ProductFilter';
import type { ProductColumnKey } from '../view/ProductTable';
import { command, useProductActionViewModel } from './ProductActionViewModel';
import { useProductDrawerViewModel } from './ProductDrawerViewModel';
import { useProductPoolViewModel } from './ProductPoolViewModel';
import { productDetailKey, productKey } from './ProductQueryKey';
import { pageLimit, pageNumber, productCondition, productState, PRODUCT_COLUMNS } from './ProductReducer';

export function useProductViewModel(context: ConsoleContext, dependencies: ProductDependencies) {
  const client = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const limit = pageLimit(search.get('limit'));
  const page = pageNumber(search.get('page'));
  const filter = Object.freeze({ q: search.get('q') ?? '', category: search.get('category') ?? '', limit, ...(search.get('cursor') === null ? {} : { cursor: search.get('cursor')! }) });
  const [filterdraft, setFilterDraft] = useState<ProductFilter>({ q: filter.q, category: filter.category });
  useEffect(() => setFilterDraft({ q: filter.q, category: filter.category }), [filter.q, filter.category]);
  const request = Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
  const query = useQuery({ queryKey: productKey(context, filter), queryFn: ({ signal }) => dependencies.readProducts.execute(request, filter, signal) });
  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [action, setAction] = useState<ProductAction | null>(null);
  const [poolsopen, setPoolsOpen] = useState(false);
  const [columnsopen, setColumnsOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [columns, setColumns] = useState<ReadonlySet<ProductColumnKey>>(() => new Set(PRODUCT_COLUMNS));
  const cursors = useRef(new Map<number, string | undefined>([[1, undefined]]));
  const visible = useMemo(() => visibleSelection(rows, selected), [rows, selected]);
  const selectedid = search.get('selected') ?? undefined;
  const selectedlisting = rows.find((item) => item.id === selectedid);
  const batch = useMutation({
    mutationFn: (published: boolean) =>
      dependencies.changePublication.execute(
        command(context),
        rows.filter((row) => visible.has(row.id)),
        published
      ),
    onSuccess: (receipt) => {
      setMessage(`批量操作完成：${receipt.count ?? visible.size} 条记录已更新`);
      setSelected(new Set());
      void query.refetch();
    },
  });

  const updateSearch = (update: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    next.delete('selected');
    update(next);
    setSelected(new Set());
    setSearch(next);
  };
  const closeAction = () => setAction(null);
  const actionvm = useProductActionViewModel(action, context, dependencies, () => {
    const productid = action !== null && 'listing' in action ? action.listing.product_id : undefined;
    closeAction();
    setMessage('商品操作已完成');
    void query.refetch();
    if (productid !== undefined) void client.invalidateQueries({ queryKey: productDetailKey(context, productid) });
  });
  const poolvm = useProductPoolViewModel(poolsopen, context, dependencies, () => setMessage('商品池操作已完成'));
  const drawervm = useProductDrawerViewModel(selectedlisting, context, dependencies);
  const error = query.error === null ? undefined : presentError(query.error).message;
  const state = productState({
    pending: query.isPending,
    fetching: query.isFetching,
    ...(query.data === undefined ? {} : { data: query.data }),
    empty: rows.length === 0,
    ...(query.error === null ? {} : { error: query.error }),
    updatedAt: new Date(query.dataUpdatedAt).toISOString(),
  });
  return Object.freeze({
    resource: Object.freeze({ state, condition: productCondition(state), ...(error === undefined ? {} : { error }), refresh: () => void query.refetch() }),
    rows,
    filter: filterdraft,
    page,
    limit,
    columns,
    selected: visible,
    selectedid,
    message,
    batch: Object.freeze({
      submitting: batch.isPending,
      ...(batch.error === null ? {} : { error: presentError(batch.error).message }),
      submit: (published: boolean) => {
        if (!batch.isPending) batch.mutate(published);
      },
    }),
    drawer: drawervm,
    action: actionvm,
    pool: poolvm,
    columnsopen,
    actions: Object.freeze({
      changeFilter: setFilterDraft,
      applyFilter: () => {
        const next = new URLSearchParams();
        if (filterdraft.q !== '') next.set('q', filterdraft.q);
        if (filterdraft.category !== '') next.set('category', filterdraft.category);
        if (limit !== 50) next.set('limit', String(limit));
        cursors.current = new Map([[1, undefined]]);
        setSelected(new Set());
        setSearch(next);
      },
      resetFilter: () => {
        setFilterDraft(EMPTY_PRODUCT_FILTER);
        cursors.current = new Map([[1, undefined]]);
        setSelected(new Set());
        setSearch(new URLSearchParams());
      },
      open: (listing: Listing) => {
        const next = new URLSearchParams(search);
        next.set('selected', listing.id);
        setSearch(next);
      },
      close: () => {
        const next = new URLSearchParams(search);
        next.delete('selected');
        setSearch(next);
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
      openAction: setAction,
      closeAction,
      openPools: () => setPoolsOpen(true),
      closePools: () => setPoolsOpen(false),
      openColumns: () => setColumnsOpen(true),
      closeColumns: () => setColumnsOpen(false),
      toggleColumn: (key: ProductColumnKey) => setColumns((current) => toggleSelection(current, key)),
      next: () => {
        const cursor = query.data?.nextCursor;
        if (cursor === undefined) return;
        cursors.current.set(page + 1, cursor);
        updateSearch((next) => {
          next.set('cursor', cursor);
          next.set('page', String(page + 1));
        });
      },
      previous: () => {
        if (page <= 1) return;
        const target = page - 1;
        const cursor = cursors.current.get(target);
        updateSearch((next) => {
          if (target === 1) next.delete('cursor');
          else if (cursor !== undefined) next.set('cursor', cursor);
          next.set('page', String(target));
        });
      },
      limit: (value: number) => {
        cursors.current = new Map([[1, undefined]]);
        updateSearch((next) => {
          next.delete('cursor');
          next.delete('page');
          if (value === 50) next.delete('limit');
          else next.set('limit', String(value));
        });
      },
    }),
    pagination: Object.freeze({ count: query.data?.count ?? 0, canPrevious: page === 2 || (page > 2 && cursors.current.has(page - 1)), canNext: query.data?.nextCursor !== undefined }),
  });
}

export type ProductViewModel = ReturnType<typeof useProductViewModel>;
