import * as Operation from '@shop/contract/ids';
import { chineseReference, presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { VoucherDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { VoucherAction } from '../model/VoucherAction';
import { createVoucherCommand } from '../model/VoucherCommandFactory';
import { voucherOperationMeta, voucherPrimaryOperations } from '../model/VoucherOperationCatalog';
import { voucherViews, type VoucherChoiceKind, type VoucherOperation, type VoucherProgressKind, type VoucherRecord, type VoucherRecordPage, type VoucherView } from '../model/Voucher';
import { voucherSummary } from '../view/VoucherPresentation';
import { voucherDetailKey, voucherFacetsKey, voucherKey, voucherNumberKey, voucherPrefix, voucherTimelineKey } from './VoucherQueryKey';
import { taskImportPath } from '../../../shared/task/TaskLaunch';
import { canReadVoucher, useVoucherChoice, useVoucherProgress, voucherViewOperation } from './VoucherReads';
import { voucherUrl } from './VoucherUrl';

export function useVoucherViewModel(context: ConsoleContext, dependencies: VoucherDependencies, requestStepup: () => void) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const url = voucherUrl.read(search);
  const [action, setAction] = useState<VoucherAction | null>(null);
  const [receipt, setReceipt] = useState<string>();
  const [tracking, setTracking] = useState<Readonly<{ kind: VoucherProgressKind; id: string }>>();
  const [queryText, setQueryText] = useState(() => url.q);
  const [numberInput, setNumberInput] = useState('');
  const [lookupNumber, setLookupNumber] = useState('');
  useEffect(() => {
    if (!search.has('q')) return;
    setSearch((current) => voucherUrl.patch(current, { q: '' }), { replace: true });
  }, [search, setSearch]);

  const availableViews = useMemo(() => voucherViews.filter((candidate) => canUseOperation(context, voucherViewOperation[candidate])), [context]);
  const view = availableViews.includes(url.view) ? url.view : (availableViews[0] ?? 'products');
  const cursor = url.cursor;
  const deferredQuery = useDeferredValue(queryText.trim());
  const status = url.status;
  const serverQuery = view === 'search' || view === 'redemptions' ? deferredQuery || undefined : undefined;
  const serverState = status === 'all' ? undefined : status;
  const viewReady = context.session.assurance.level >= requiredAssurance(voucherViewOperation[view]);
  const query = useQuery({
    queryKey: voucherKey(context, view, cursor, serverQuery, serverState),
    queryFn: ({ signal }) => dependencies.read.page(context, view, { ...(cursor ? { cursor } : {}), ...(serverQuery ? { query: serverQuery } : {}), ...(serverState ? { state: serverState } : {}) }, signal),
    staleTime: 30_000,
    enabled: availableViews.includes(view) && viewReady && (view !== 'redemptions' || Boolean(serverQuery)),
  });
  const emptyPage: VoucherRecordPage = Object.freeze({ items: Object.freeze([]), count: 0 });
  const data: VoucherRecordPage | undefined = query.data ?? (view === 'redemptions' && !serverQuery ? emptyPage : undefined);
  const normalized = queryText.trim().toLowerCase();
  const rows = useMemo(
    () => (data?.items ?? []).filter((row) => (serverQuery || !normalized || `${row.name} ${row.id} ${row.detail}`.toLowerCase().includes(normalized)) && (serverState || status === 'all' || row.state === status)),
    [data?.items, normalized, serverQuery, serverState, status]
  );
  const states = useMemo(() => Object.freeze([...new Set((data?.items ?? []).map((row) => row.state))].sort()), [data?.items]);
  const selectedId = url.selected;
  const listedRecord = data?.items.find((record) => record.id === selectedId);
  const detail = useQuery({ queryKey: voucherDetailKey(context, view, selectedId ?? ''), queryFn: ({ signal }) => dependencies.read.detail(context, view, selectedId!, signal), enabled: Boolean(selectedId) && viewReady, staleTime: 15_000 });
  const selectedRecord = detail.data ?? listedRecord;

  const sources = action ? new Set(voucherOperationMeta(action.operation).fields.flatMap((field) => (field.source ? [field.source] : []))) : new Set<VoucherChoiceKind>();
  const productChoices = useVoucherChoice(context, dependencies, 'product', sources.has('product'));
  const stockChoices = useVoucherChoice(context, dependencies, 'stock', sources.has('stock'));
  const choices = Object.freeze({ ...(productChoices.data ? { product: productChoices.data } : {}), ...(stockChoices.data ? { stock: stockChoices.data } : {}) });
  const choiceBusy = (sources.has('product') && productChoices.isFetching) || (sources.has('stock') && stockChoices.isFetching);
  const choiceError = safeQueryError(productChoices.error ?? stockChoices.error);

  const facetAllowed = canReadVoucher(context, Operation.OP_VOUCHER_SEARCHFACETS_READ);
  const facets = useQuery({
    queryKey: voucherFacetsKey(context, serverQuery, serverState),
    queryFn: ({ signal }) => dependencies.read.facets(context, { ...(serverQuery ? { query: serverQuery } : {}), ...(serverState ? { state: serverState } : {}) }, signal),
    enabled: facetAllowed && (view === 'vouchers' || view === 'search'),
    staleTime: 30_000,
  });
  const timelineAllowed = Boolean(selectedRecord && (selectedRecord.kind === 'vouchers' || selectedRecord.kind === 'search')) && canReadVoucher(context, Operation.OP_VOUCHER_VOUCHERS_TIMELINE);
  const timeline = useQuery({
    queryKey: voucherTimelineKey(context, selectedRecord?.id ?? ''),
    queryFn: ({ signal }) => dependencies.read.timeline(context, selectedRecord!.id, undefined, signal),
    enabled: timelineAllowed,
    staleTime: 15_000,
  });
  const related = selectedRecord?.kind === 'issues' && typeof selectedRecord.raw.issueBatch === 'string' ? Object.freeze({ kind: 'issue' as const, id: selectedRecord.raw.issueBatch }) : undefined;
  const relatedProgress = useVoucherProgress(context, dependencies, related);
  const trackedProgress = useVoucherProgress(context, dependencies, tracking);
  const exactAuthorized = canUseOperation(context, Operation.OP_VOUCHER_VOUCHERS_GETBYNUMBER);
  const exactAllowed = canReadVoucher(context, Operation.OP_VOUCHER_VOUCHERS_GETBYNUMBER);
  const exact = useQuery({ queryKey: voucherNumberKey(context, lookupNumber), queryFn: ({ signal }) => dependencies.read.byNumber(context, lookupNumber, signal), enabled: exactAllowed && Boolean(lookupNumber), staleTime: 0, retry: false });

  const mutation = useMutation({
    mutationFn: ({ selected, values }: Readonly<{ selected: VoucherAction; values: Readonly<Record<string, string>> }>) => dependencies.execute.execute(context, createVoucherCommand(selected, values, dependencies.createIdentity())),
    onSuccess: (result, variables) => {
      setReceipt(`${voucherOperationMeta(variables.selected.operation).label}已提交：${result.message}。`);
      setTracking(result.reference && result.kind !== 'record' ? Object.freeze({ kind: result.kind, id: result.reference }) : undefined);
      setAction(null);
      void cache.invalidateQueries({ queryKey: voucherPrefix(context) });
    },
  });
  const updateSearch = useCallback(
    (values: Parameters<typeof voucherUrl.patch>[1]) => setSearch(voucherUrl.patch(search, values)),
    [search, setSearch]
  );
  const can = useCallback((operation: VoucherOperation) => canUseOperation(context, operation), [context]);
  const primaryOperations = useMemo(() => voucherPrimaryOperations[view].filter(can), [can, view]);
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => {
          void query.refetch();
          if (facets.isEnabled) void facets.refetch();
          if (timeline.isEnabled) void timeline.refetch();
        },
        stepup: requestStepup,
        selectView: (candidate: VoucherView) => {
          setQueryText('');
          setLookupNumber('');
          updateSearch({ view: candidate, cursor: undefined, q: '', status: 'all', selected: undefined });
        },
        filter: (key: 'q' | 'status', value: string) => {
          if (key === 'q') setQueryText(value);
          updateSearch({ q: '', ...(key === 'status' ? { status: value || 'all' } : {}), cursor: undefined, selected: undefined });
        },
        clearFilters: () => {
          setQueryText('');
          updateSearch({ q: '', status: 'all', cursor: undefined, selected: undefined });
        },
        next: () => {
          if (data?.nextCursor) updateSearch({ cursor: data.nextCursor });
        },
        open: (record: VoucherRecord) => {
          setAction(null);
          updateSearch({ selected: record.id });
        },
        close: () => updateSearch({ selected: undefined }),
        start: (operation: VoucherOperation, record?: VoucherRecord) => {
          if (context.session.assurance.level < requiredAssurance(operation)) {
            requestStepup();
            return;
          }
          if (operation === Operation.OP_VOUCHER_CREDENTIALS_IMPORT) {
            void navigate(taskImportPath(context, 'voucher', record?.kind === 'pools' ? record.id : undefined));
            return;
          }
          updateSearch({ selected: undefined });
          setAction(Object.freeze({ operation, ...(record ? { record } : {}) }));
          mutation.reset();
        },
        closeAction: () => {
          if (!mutation.isPending) setAction(null);
        },
        submit: (values: Readonly<Record<string, string>>) => {
          if (action) mutation.mutate({ selected: action, values });
        },
        dismissReceipt: () => {
          setReceipt(undefined);
          setTracking(undefined);
        },
        numberInput: setNumberInput,
        lookup: () => {
          const value = numberInput.trim();
          if (!value) return;
          if (!exactAllowed) {
            requestStepup();
            return;
          }
          setLookupNumber(value);
        },
      }),
    [action, context, data?.nextCursor, exactAllowed, facets, mutation, navigate, numberInput, query, requestStepup, timeline, updateSearch]
  );
  return Object.freeze({
    scopeName: context.scope.name ?? chineseReference('组织范围', context.scope.id),
    view,
    availableViews,
    data,
    rows,
    states,
    status,
    queryText,
    selectedRecord,
    detailPending: detail.isPending && Boolean(selectedId),
    timeline: timeline.data,
    timelinePending: timeline.isPending && timelineAllowed,
    timelineError: safeQueryError(timeline.error),
    relatedProgress: relatedProgress.data,
    summary: voucherSummary(view, data?.items ?? []),
    primaryOperations,
    facets: facets.data,
    facetPending: facets.isPending && facetAllowed,
    numberInput,
    exactRecord: exact.data,
    exactPending: exact.isFetching,
    exactError: safeQueryError(exact.error),
    exactAvailable: exactAuthorized,
    condition: viewReady ? queryCondition({ pending: query.isPending && !(view === 'redemptions' && !serverQuery), fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false }) : 'forbidden',
    error: viewReady ? safeQueryError(query.error) : '当前视图包含敏感卡券数据，请先完成二次验证。',
    needsStepup: !viewReady,
    can,
    action,
    choices,
    choiceBusy,
    choiceError,
    actionBusy: mutation.isPending,
    actionError: mutation.error ? presentError(mutation.error).message : undefined,
    receipt,
    progress: trackedProgress.data,
    progressPending: trackedProgress.isPending && Boolean(tracking),
    progressError: safeQueryError(trackedProgress.error),
    actions,
  });
}

export type VoucherViewModel = ReturnType<typeof useVoucherViewModel>;
