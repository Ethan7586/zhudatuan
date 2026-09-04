import { presentError, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { OP_FINANCE_FACETS_READ, OP_FINANCE_RECONCILIATIONS_READ } from '@shop/contract/ids';
import { FINANCE_RECONCILIATION_STATES } from '@shop/contract';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { defineQueryState, integerQuery, optionalQuery, trimmedQuery } from '../../../shared/query/QueryState';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { defaultFinanceColumns, financeOperations, type FinanceColumnKey, type FinanceReconciliation, type FinanceReconciliationAction, type FinanceReconciliationQuery } from '../model/Finance';
import { availableReconciliationCommands, reconciliationMessage, validateReconciliationCommand } from '../model/ReconciliationPolicy';
import { financeFacetKey, financeReconciliationKey } from './FinanceQueryKey';
import { useFinancePrefetch } from './FinancePrefetch';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

const removedQueryKeys = ['q', 'tab'] as const;
const reconciliationStates = FINANCE_RECONCILIATION_STATES;
const reconciliationQuery = defineQueryState({
  cursor: optionalQuery(), reconPeriod: trimmedQuery(), channel: trimmedQuery(), mall: trimmedQuery(), status: trimmedQuery(), difference: trimmedQuery(),
  limit: integerQuery(50, [20, 50]), selected: optionalQuery(255), item: optionalQuery(255), q: optionalQuery(255), tab: optionalQuery(64),
});

export function useReconciliationViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const url = reconciliationQuery.read(search);
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<FinanceColumnKey>>(defaultFinanceColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [command, setCommand] = useState<FinanceReconciliationAction>('retry');
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const scope = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scope);
  const cursor = url.cursor;
  const period = url.reconPeriod;
  const provider = url.channel;
  const mall = url.mall;
  const stateValue = url.status;
  const state = reconciliationStates.find((value) => value === stateValue);
  const differenceType = url.difference;
  const queryInput: FinanceReconciliationQuery = {
    limit: url.limit as 20 | 50,
    ...(cursor === undefined ? {} : { cursor }),
    ...(period === undefined ? {} : { period }),
    ...(provider === undefined ? {} : { provider }),
    ...(mall === undefined ? {} : { mall }),
    ...(state === undefined ? {} : { state }),
    ...(differenceType === undefined ? {} : { differenceType }),
  };
  const facetAllowed = canUseOperation(context, OP_FINANCE_FACETS_READ);
  const readAllowed = canUseOperation(context, OP_FINANCE_RECONCILIATIONS_READ);
  const facetQuery = useQuery({ queryKey: financeFacetKey(context), queryFn: ({ signal }) => dependencies.readFacets.execute(context, signal), enabled: facetAllowed, staleTime: 30_000 });
  const query = useQuery({ queryKey: financeReconciliationKey(context, queryInput), queryFn: ({ signal }) => dependencies.readReconciliations.execute(context, queryInput, signal), enabled: readAllowed, staleTime: 30_000 });
  const page = query.data;
  useFinancePrefetch(context, dependencies, 'reconciliations', page !== undefined);
  const selectedId = url.selected;
  const selected = page?.items.find((row) => row.id === selectedId);
  const selectedItem = selected?.items.find((item) => item.id === url.item)
    ?? selected?.items.find((item) => item.state === 'difference' || item.state === 'resolutionpending')
    ?? selected?.items[0];
  const commandOptions = useMemo(() => availableReconciliationCommands(selected, selectedItem), [selected, selectedItem]);

  useEffect(() => {
    const scopeChanged = previousScope.current !== scope;
    previousScope.current = scope;
    const stale = removedQueryKeys.some((key) => search.has(key)) || (search.has('limit') && url.limit === 50);
    if (!scopeChanged && !stale) return;
    setSearch(
      (current) => reconciliationQuery.patch(current, { q: undefined, tab: undefined, limit: url.limit, ...(scopeChanged ? { cursor: undefined, selected: undefined, item: undefined } : {}) }),
      { replace: true }
    );
  }, [scope, search, setSearch]);

  useEffect(() => {
    const facets = facetQuery.data;
    if (!facets) return;
    const selections = [
      ['reconPeriod', facets.periods.items],
      ['channel', facets.providers.items],
      ['mall', facets.malls.items],
      ['status', facets.states.items],
      ['difference', facets.differenceTypes.items],
    ] as const;
    if (!selections.some(([key, items]) => url[key] !== undefined && !items.some(({ value }) => value === url[key]))) return;
    setSearch(
      (current) => reconciliationQuery.patch(current, Object.fromEntries([
        ...selections.filter(([key, items]) => url[key] !== undefined && !items.some(({ value }) => value === url[key])).map(([key]) => [key, undefined]),
        ['cursor', undefined], ['selected', undefined], ['item', undefined],
      ]) as Parameters<typeof reconciliationQuery.patch>[1]),
      { replace: true }
    );
  }, [facetQuery.data, search, setSearch]);

  useEffect(() => {
    if (!page) return;
    const ids = new Set(page.items.map((row) => row.id));
    setSelectedRows((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [page]);

  useEffect(() => {
    if (!selected || !url.item || selected.items.some((item) => item.id === url.item)) return;
    setSearch((current) => reconciliationQuery.patch(current, { item: undefined }), { replace: true });
  }, [selected, setSearch, url.item]);

  useEffect(() => {
    setCommand(commandOptions[0]?.value ?? 'retry');
    setReason('');
    setProof('');
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  }, [commandOptions, dependencies, selectedId, selectedItem?.id]);

  const mutation = useMutation({
    mutationFn: async (input: Readonly<{ row: FinanceReconciliation; itemId?: string; action: FinanceReconciliationAction; reason: string; proof: string; identity: string }>) => {
      const item = input.row.items.find((candidate) => candidate.id === input.itemId);
      await dependencies.manageReconciliation.execute(context, input.row.id, input.row.version, { action: input.action, reason: input.reason, ...(item === undefined ? {} : { item: item.id }) }, input.proof, input.identity);
    },
    onSuccess: async (_, input) => {
      await query.refetch();
      setReceipt(Object.freeze({ requestId: input.identity, reference: input.row.id, occurredAt: new Date().toISOString(), message: reconciliationMessage(input.action) }));
    },
  });

  const updateSearch = useCallback(
    (values: Parameters<typeof reconciliationQuery.patch>[1]) => setSearch((current) => reconciliationQuery.patch(current, values)),
    [setSearch]
  );
  const resetCommand = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  };
  const toggleRow = (id: string) =>
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelectedRows((current) => {
      if (!page) return current;
      const next = new Set(current);
      const all = page.items.every((row) => next.has(row.id));
      page.items.forEach((row) => {
        if (all) next.delete(row.id);
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
  const setCursor = (nextCursor?: string) =>
    updateSearch({ cursor: nextCursor, selected: undefined, item: undefined });
  const setLimit = (limit: 20 | 50) =>
    updateSearch({ limit, cursor: undefined, selected: undefined, item: undefined });
  const validation = validateReconciliationCommand(selected, selectedItem, commandOptions, command, reason, proof, confirmed);
  const submit = () => {
    if (!selected || validation || mutation.isPending) return;
    if (context.session.assurance.level < 3) {
      requestStepup();
      return;
    }
    mutation.mutate({ row: selected, ...(selectedItem === undefined ? {} : { itemId: selectedItem.id }), action: command, reason: reason.trim(), proof, identity });
  };

  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'reconciliations'),
    page,
    selected,
    selectedItem,
    selectedRows,
    visibleColumns,
    columnsOpen,
    limit: queryInput.limit,
    cursor,
    filters: Object.freeze({ period, provider, mall, state, differenceType, active: [period, provider, mall, state, differenceType].filter(Boolean).length }),
    facets: Object.freeze({
      data: facetQuery.data,
      condition: facetAllowed ? queryCondition({ pending: facetQuery.isPending, fetching: facetQuery.isFetching, error: facetQuery.error, hasData: facetQuery.data !== undefined, empty: false }) : 'forbidden',
      error: facetAllowed ? safeQueryError(facetQuery.error) : '当前账号没有读取财务筛选项的权限。',
      retry: () => {
        if (facetAllowed) void facetQuery.refetch();
      },
    }),
    condition: readAllowed ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }) : 'forbidden',
    error: readAllowed ? safeQueryError(query.error) : '当前账号没有读取对账数据的权限。',
    fetching: query.isFetching,
    command: Object.freeze({
      allowed: canUseOperation(context, financeOperations.manageReconciliation),
      options: commandOptions,
      value: command,
      reason,
      proof,
      confirmed,
      validation,
      busy: mutation.isPending,
      error: mutation.error ? presentError(mutation.error).message : undefined,
      receipt,
      assurance: context.session.assurance.level,
    }),
    actions: Object.freeze({
      refresh: () => {
        if (readAllowed) void query.refetch();
      },
      toggleRow,
      toggleAll,
      toggleColumn,
      toggleColumns: () => setColumnsOpen((open) => !open),
      closeColumns: () => setColumnsOpen(false),
      open: (id: string) => updateSearch({ selected: id, item: undefined }),
      close: () => updateSearch({ selected: undefined, item: undefined }),
      item: (id: string) => updateSearch({ item: id }),
      next: (nextCursor: string) => setCursor(nextCursor),
      first: () => setCursor(),
      limit: setLimit,
      filter: (key: 'reconPeriod' | 'channel' | 'mall' | 'status' | 'difference', value: string) =>
        updateSearch({ [key]: value || undefined, cursor: undefined, selected: undefined, item: undefined }),
      clearFilters: () => updateSearch({ reconPeriod: undefined, channel: undefined, mall: undefined, status: undefined, difference: undefined, cursor: undefined, selected: undefined, item: undefined }),
      command: (value: FinanceReconciliationAction) => {
        setCommand(value);
        setConfirmed(false);
        setIdentity(dependencies.createIdentity());
        setReceipt(undefined);
      },
      reason: resetCommand(setReason),
      proof: resetCommand(setProof),
      confirmed: setConfirmed,
      submit,
      stepup: requestStepup,
      dismissReceipt: () => setReceipt(undefined),
    }),
  });
}

export type ReconciliationViewModel = ReturnType<typeof useReconciliationViewModel>;
