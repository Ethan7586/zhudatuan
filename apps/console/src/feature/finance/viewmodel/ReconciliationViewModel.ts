import { presentError, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { defaultFinanceColumns, financeOperations, type FinanceColumnKey, type FinanceReconciliation, type FinanceReconciliationAction, type FinanceReconciliationQuery } from '../model/Finance';
import { availableReconciliationCommands, reconciliationLimit, reconciliationMessage, validateReconciliationCommand } from '../model/ReconciliationPolicy';
import { financeReconciliationKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

const removedQueryKeys = ['q', 'reconPeriod', 'channel', 'mall', 'status', 'difference', 'tab'] as const;

export function useReconciliationViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
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
  const cursor = search.get('cursor') ?? undefined;
  const queryInput: FinanceReconciliationQuery = { limit: reconciliationLimit(search.get('limit')), ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({ queryKey: financeReconciliationKey(context, queryInput), queryFn: ({ signal }) => dependencies.readReconciliations.execute(context, queryInput, signal) });
  const page = query.data;
  const selectedId = search.get('selected') ?? undefined;
  const selected = page?.items.find((row) => row.id === selectedId);
  const commandOptions = useMemo(() => availableReconciliationCommands(selected), [selected]);

  useEffect(() => {
    const scopeChanged = previousScope.current !== scope;
    previousScope.current = scope;
    const stale = removedQueryKeys.some((key) => search.has(key)) || (search.has('limit') && search.get('limit') !== '20');
    if (!scopeChanged && !stale) return;
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        removedQueryKeys.forEach((key) => next.delete(key));
        if (next.get('limit') !== '20') next.delete('limit');
        if (scopeChanged) {
          next.delete('cursor');
          next.delete('selected');
        }
        return next;
      },
      { replace: true }
    );
  }, [scope, search, setSearch]);

  useEffect(() => {
    if (!page) return;
    const ids = new Set(page.items.map((row) => row.id));
    setSelectedRows((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [page]);

  useEffect(() => {
    setCommand(commandOptions[0]?.value ?? 'retry');
    setReason('');
    setProof('');
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  }, [commandOptions, dependencies, selectedId]);

  const mutation = useMutation({
    mutationFn: async (input: Readonly<{ row: FinanceReconciliation; action: FinanceReconciliationAction; reason: string; proof: string; identity: string }>) => {
      const item = input.row.items.find((candidate) => (input.action === 'resolve' ? candidate.state === 'difference' : candidate.state === 'resolutionpending'));
      await dependencies.manageReconciliation.execute(context, input.row.id, input.row.version, { action: input.action, reason: input.reason, ...(item === undefined ? {} : { item: item.id }) }, input.proof, input.identity);
    },
    onSuccess: async (_, input) => {
      await query.refetch();
      setReceipt(Object.freeze({ requestId: input.identity, reference: input.row.id, occurredAt: new Date().toISOString(), message: reconciliationMessage(input.action) }));
    },
  });

  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setSearch((current) => {
        const next = new URLSearchParams(current);
        mutate(next);
        return next;
      });
    },
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
    updateSearch((next) => {
      if (nextCursor) next.set('cursor', nextCursor);
      else next.delete('cursor');
      next.delete('selected');
    });
  const setLimit = (limit: 20 | 50) =>
    updateSearch((next) => {
      if (limit === 50) next.delete('limit');
      else next.set('limit', String(limit));
      next.delete('cursor');
      next.delete('selected');
    });
  const validation = validateReconciliationCommand(selected, commandOptions, command, reason, proof, confirmed);
  const submit = () => {
    if (!selected || validation || mutation.isPending) return;
    if (context.session.assurance.level < 3) {
      requestStepup();
      return;
    }
    mutation.mutate({ row: selected, action: command, reason: reason.trim(), proof, identity });
  };

  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'reconciliations'),
    page,
    selected,
    selectedRows,
    visibleColumns,
    columnsOpen,
    limit: queryInput.limit,
    cursor,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
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
        void query.refetch();
      },
      toggleRow,
      toggleAll,
      toggleColumn,
      toggleColumns: () => setColumnsOpen((open) => !open),
      closeColumns: () => setColumnsOpen(false),
      open: (id: string) => updateSearch((next) => next.set('selected', id)),
      close: () => updateSearch((next) => next.delete('selected')),
      next: (nextCursor: string) => setCursor(nextCursor),
      first: () => setCursor(),
      limit: setLimit,
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
