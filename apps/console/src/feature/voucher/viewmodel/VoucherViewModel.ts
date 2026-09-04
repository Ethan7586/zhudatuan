import {
  OP_VOUCHER_BATCHES_ISSUE,
  OP_VOUCHER_BATCHES_READ,
  OP_VOUCHER_BATCHES_RETRY,
  OP_VOUCHER_BINDINGS_MANAGE,
  OP_VOUCHER_BINDINGS_READ,
  OP_VOUCHER_CARDLIBRARIES_ALLOCATE,
  OP_VOUCHER_CARDLIBRARIES_CREATE,
  OP_VOUCHER_CARDLIBRARIES_READ,
  OP_VOUCHER_HISTORY_READ,
  OP_VOUCHER_PROGRAMS_MANAGE,
  OP_VOUCHER_PROGRAMS_READ,
  OP_VOUCHER_REDEMPTIONS_READ,
  OP_VOUCHER_REDEMPTIONS_REVERSE,
  OP_VOUCHER_RESERVES_DECIDE,
  OP_VOUCHER_RESERVES_READ,
  OP_VOUCHER_RESERVES_REQUEST,
  OP_VOUCHER_STATUSBATCHES_READ,
  OP_VOUCHER_STATUS_BATCH,
} from '@shop/contract/ids';
import {
  PERM_VOUCHER_BINDING_MANAGE,
  PERM_VOUCHER_CARDLIBRARY_ALLOCATE,
  PERM_VOUCHER_CARDLIBRARY_CREATE,
  PERM_VOUCHER_ISSUE,
  PERM_VOUCHER_PROGRAM_MANAGE,
  PERM_VOUCHER_REDEMPTION_REVERSE,
  PERM_VOUCHER_RESERVE_DECIDE,
  PERM_VOUCHER_RESERVE_REQUEST,
  PERM_VOUCHER_STATUS_MANAGE,
} from '@shop/authz/ids';
import { chineseReference, queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { VoucherDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { pageCursor } from '../../../shared/url/PageCursor';
import type { VoucherAction } from '../model/VoucherAction';
import type { VoucherCommand } from '../model/VoucherCommand';
import { voucherViews, type VoucherRecord, type VoucherView } from '../model/Voucher';
import { voucherSummary } from '../view/VoucherPresentation';
import { useVoucherActionViewModel } from './VoucherActionViewModel';
import { voucherKey, voucherPrefix } from './VoucherQueryKey';
import { allowed, readView, receiptText, targetView } from './VoucherViewState';

const viewOperation: Readonly<Record<VoucherView, string>> = Object.freeze({
  programs: OP_VOUCHER_PROGRAMS_READ,
  libraries: OP_VOUCHER_CARDLIBRARIES_READ,
  reserves: OP_VOUCHER_RESERVES_READ,
  batches: OP_VOUCHER_BATCHES_READ,
  statusbatches: OP_VOUCHER_STATUSBATCHES_READ,
  bindings: OP_VOUCHER_BINDINGS_READ,
  redemptions: OP_VOUCHER_REDEMPTIONS_READ,
  history: OP_VOUCHER_HISTORY_READ,
});

export function useVoucherViewModel(context: ConsoleContext, dependencies: VoucherDependencies) {
  const cache = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [action, setAction] = useState<VoucherAction | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [receipt, setReceipt] = useState<string>();
  const availableViews = useMemo(() => voucherViews.filter((candidate) => context.session.capabilities.includes(viewOperation[candidate])), [context.session.capabilities]);
  const view = readView(search, availableViews);
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: voucherKey(context, view, cursor), queryFn: ({ signal }) => dependencies.read.execute(context, view, cursor, signal), staleTime: 60_000 });
  const data = query.data;
  const q = (search.get('q') ?? '').trim().toLowerCase();
  const status = search.get('status') ?? 'all';
  const selectedId = search.get('selected') ?? undefined;
  const selectedRecord = data?.items.find((record) => record.id === selectedId);
  const rows = useMemo(() => (data?.items ?? []).filter((record) => (q === '' || `${record.name} ${record.id} ${record.detail}`.toLowerCase().includes(q)) && (status === 'all' || record.state === status)), [data?.items, q, status]);
  const states = useMemo(() => Object.freeze([...new Set((data?.items ?? []).map((row) => row.state))].sort()), [data?.items]);
  const summary = useMemo(() => voucherSummary(view, data?.items ?? []), [data?.items, view]);
  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(search);
      mutate(next);
      setSearch(next);
    },
    [search, setSearch]
  );
  const done = useCallback(
    (command: VoucherCommand) => {
      setAction(null);
      setSelected(new Set());
      setReceipt(receiptText(command));
      const target = targetView(command);
      const next = new URLSearchParams();
      next.set('view', target);
      setSearch(next);
      void cache.invalidateQueries({ queryKey: voucherPrefix(context) });
    },
    [cache, context, setSearch]
  );
  const actionModel = useVoucherActionViewModel(action, context, dependencies, done);
  const permissions = useMemo(
    () =>
      Object.freeze({
        createLibrary: allowed(context, PERM_VOUCHER_CARDLIBRARY_CREATE, OP_VOUCHER_CARDLIBRARIES_CREATE),
        allocateLibrary: allowed(context, PERM_VOUCHER_CARDLIBRARY_ALLOCATE, OP_VOUCHER_CARDLIBRARIES_ALLOCATE),
        saveProgram: allowed(context, PERM_VOUCHER_PROGRAM_MANAGE, OP_VOUCHER_PROGRAMS_MANAGE),
        requestReserve: allowed(context, PERM_VOUCHER_RESERVE_REQUEST, OP_VOUCHER_RESERVES_REQUEST),
        decideReserve: allowed(context, PERM_VOUCHER_RESERVE_DECIDE, OP_VOUCHER_RESERVES_DECIDE),
        issueBatch: allowed(context, PERM_VOUCHER_ISSUE, OP_VOUCHER_BATCHES_ISSUE),
        retryBatch: allowed(context, PERM_VOUCHER_ISSUE, OP_VOUCHER_BATCHES_RETRY),
        changeStatus: allowed(context, PERM_VOUCHER_STATUS_MANAGE, OP_VOUCHER_STATUS_BATCH),
        bind: allowed(context, PERM_VOUCHER_BINDING_MANAGE, OP_VOUCHER_BINDINGS_MANAGE),
        reverse: allowed(context, PERM_VOUCHER_REDEMPTION_REVERSE, OP_VOUCHER_REDEMPTIONS_REVERSE),
      }),
    [context]
  );
  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => void query.refetch(),
        selectView: (candidate: VoucherView) =>
          updateSearch((next) => {
            next.set('view', candidate);
            next.delete('cursor');
            next.delete('q');
            next.delete('status');
            next.delete('selected');
            setSelected(new Set());
          }),
        filter: (key: 'q' | 'status', value: string) =>
          updateSearch((next) => {
            if (!value || value === 'all') next.delete(key);
            else next.set(key, value);
            next.delete('cursor');
            next.delete('selected');
          }),
        clearFilters: () =>
          updateSearch((next) => {
            next.delete('q');
            next.delete('status');
            next.delete('cursor');
            next.delete('selected');
          }),
        next: () => {
          if (data?.nextCursor) setSearch(pageCursor(search, data.nextCursor));
        },
        open: (record: VoucherRecord) => {
          setAction(null);
          updateSearch((next) => next.set('selected', record.id));
        },
        close: () => updateSearch((next) => next.delete('selected')),
        choose: (id: string) =>
          setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        choosePage: () =>
          setSelected((current) => {
            const next = new Set(current);
            const remove = rows.length > 0 && rows.every((row) => next.has(row.id));
            for (const row of rows) {
              if (remove) next.delete(row.id);
              else next.add(row.id);
            }
            return next;
          }),
        start: (next: VoucherAction) => {
          updateSearch((value) => value.delete('selected'));
          setAction(next);
        },
        closeAction: () => setAction(null),
        changeSelected: () => {
          if (selectedRows.length) setAction({ kind: 'statusbatch', records: selectedRows });
        },
        dismissReceipt: () => setReceipt(undefined),
      }),
    [data?.nextCursor, query, rows, search, selectedRows, setSearch, updateSearch]
  );
  return Object.freeze({
    scopeName: context.scope.name ?? chineseReference('组织范围', context.scope.id),
    view,
    availableViews,
    data,
    rows,
    states,
    status,
    queryText: search.get('q') ?? '',
    selectedRecord,
    selected,
    selectedRows,
    summary,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false }),
    error: safeQueryError(query.error),
    permissions,
    action: actionModel,
    receipt,
    actions,
  });
}

export type VoucherViewModel = ReturnType<typeof useVoucherViewModel>;
