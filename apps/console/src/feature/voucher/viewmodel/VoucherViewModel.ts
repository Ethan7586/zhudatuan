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

const viewOperation: Readonly<Record<VoucherView, string>> = Object.freeze({
  programs: 'voucher.programs.read', libraries: 'voucher.cardlibraries.read', reserves: 'voucher.reserves.read', batches: 'voucher.batches.read',
  statusbatches: 'voucher.statusbatches.read', bindings: 'voucher.bindings.read', redemptions: 'voucher.redemptions.read', history: 'voucher.history.read',
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
  const updateSearch = useCallback((mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(search); mutate(next); setSearch(next); }, [search, setSearch]);
  const done = useCallback((command: VoucherCommand) => {
    setAction(null); setSelected(new Set()); setReceipt(receiptText(command));
    const target = targetView(command);
    const next = new URLSearchParams(); next.set('view', target); setSearch(next);
    void cache.invalidateQueries({ queryKey: voucherPrefix(context) });
  }, [cache, context, setSearch]);
  const actionModel = useVoucherActionViewModel(action, context, dependencies, done);
  const permissions = useMemo(() => Object.freeze({
    createLibrary: allowed(context, 'voucher.cardlibrary.create', 'voucher.cardlibraries.create'),
    allocateLibrary: allowed(context, 'voucher.cardlibrary.allocate', 'voucher.cardlibraries.allocate'),
    saveProgram: allowed(context, 'voucher.program.manage', 'voucher.programs.manage'),
    requestReserve: allowed(context, 'voucher.reserve.request', 'voucher.reserves.request'),
    decideReserve: allowed(context, 'voucher.reserve.decide', 'voucher.reserves.decide'),
    issueBatch: allowed(context, 'voucher.issue', 'voucher.batches.issue'),
    retryBatch: allowed(context, 'voucher.issue', 'voucher.batches.retry'),
    changeStatus: allowed(context, 'voucher.status.manage', 'voucher.status.batch'),
    bind: allowed(context, 'voucher.binding.manage', 'voucher.bindings.manage'),
    reverse: allowed(context, 'voucher.redemption.reverse', 'voucher.redemptions.reverse'),
  }), [context]);
  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const actions = useMemo(() => Object.freeze({
    refresh: () => void query.refetch(),
    selectView: (candidate: VoucherView) => updateSearch((next) => { next.set('view', candidate); next.delete('cursor'); next.delete('q'); next.delete('status'); next.delete('selected'); setSelected(new Set()); }),
    filter: (key: 'q' | 'status', value: string) => updateSearch((next) => { if (!value || value === 'all') next.delete(key); else next.set(key, value); next.delete('cursor'); next.delete('selected'); }),
    clearFilters: () => updateSearch((next) => { next.delete('q'); next.delete('status'); next.delete('cursor'); next.delete('selected'); }),
    next: () => { if (data?.nextCursor) setSearch(pageCursor(search, data.nextCursor)); },
    open: (record: VoucherRecord) => { setAction(null); updateSearch((next) => next.set('selected', record.id)); },
    close: () => updateSearch((next) => next.delete('selected')),
    choose: (id: string) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }),
    choosePage: () => setSelected((current) => { const next = new Set(current); const remove = rows.length > 0 && rows.every((row) => next.has(row.id)); for (const row of rows) remove ? next.delete(row.id) : next.add(row.id); return next; }),
    start: (next: VoucherAction) => { updateSearch((value) => value.delete('selected')); setAction(next); },
    closeAction: () => setAction(null),
    changeSelected: () => { if (selectedRows.length) setAction({ kind: 'statusbatch', records: selectedRows }); },
    dismissReceipt: () => setReceipt(undefined),
  }), [data?.nextCursor, query, rows, search, selectedRows, setSearch, updateSearch]);
  return Object.freeze({
    scopeName: context.scope.name ?? chineseReference('组织范围', context.scope.id), view, availableViews, data, rows, states, status, queryText: search.get('q') ?? '', selectedRecord,
    selected, selectedRows, summary, condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false }),
    error: safeQueryError(query.error), permissions, action: actionModel, receipt, actions,
  });
}

export type VoucherViewModel = ReturnType<typeof useVoucherViewModel>;

function readView(search: URLSearchParams, available: readonly VoucherView[]): VoucherView {
  const selected = search.get('view') as VoucherView | null;
  return selected && available.includes(selected) ? selected : available[0] ?? 'programs';
}
function allowed(context: ConsoleContext, permission: string, capability: string): boolean { return context.session.permissions.includes(permission) && context.session.capabilities.includes(capability); }
function targetView(command: VoucherCommand): VoucherView { return command.kind === 'createlibrary' || command.kind === 'allocatelibrary' ? 'libraries' : command.kind === 'saveprogram' ? 'programs' : command.kind === 'requestreserve' || command.kind === 'decidereserve' ? 'reserves' : command.kind === 'issuebatch' || command.kind === 'retrybatch' ? 'batches' : command.kind === 'statusbatch' ? 'statusbatches' : command.kind === 'bind' ? 'bindings' : 'redemptions'; }
function receiptText(command: VoucherCommand): string { return command.kind === 'statusbatch' ? `已提交 ${command.ids.length} 张卡券的批量任务，请在“操作批次”查看进度。` : '操作已提交并完成权威重读；若为异步任务，可在对应列表查看最新进度。'; }
