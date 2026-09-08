import { presentError, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { OP_FINANCE_AUDIT_READ } from '@shop/contract/ids';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { defineQueryState, optionalQuery, trimmedQuery } from '../../../shared/query/QueryState';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { FinanceRecord, FinanceSection } from '../model/Finance';
import { emptyFinanceActionDraft, sectionActions, validateFinanceAction, type FinanceAction, type FinanceActionDraft } from '../model/FinanceCommand';
import { financeSectionOperation } from '../model/FinanceOperation';
import { useFinancePrefetch } from './FinancePrefetch';
import { financeSectionKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

const sectionQuery = defineQueryState({ cursor: optionalQuery(), selected: optionalQuery(255), status: trimmedQuery() });

export function useSectionViewModel(context: ConsoleContext, dependencies: FinanceDependencies, section: FinanceSection, requestStepup: () => void = () => undefined) {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const url = sectionQuery.read(search);
  const cursor = url.cursor;
  const scope = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scope);
  const operation = financeSectionOperation(section);
  const allowed = canUseOperation(context, operation);
  const ready = allowed && context.session.assurance.level >= requiredAssurance(operation);
  const query = useQuery({ queryKey: financeSectionKey(context, section, cursor), queryFn: ({ signal }) => dependencies.readSection.execute(context, section, cursor, signal), enabled: ready, staleTime: 30_000 });
  useFinancePrefetch(context, dependencies, section, query.data !== undefined);
  const [action, setAction] = useState<FinanceAction>();
  const [draft, setDraft] = useState<FinanceActionDraft>(emptyFinanceActionDraft);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const mutation = useMutation({
    mutationFn: async (value: Readonly<{ action: FinanceAction; draft: FinanceActionDraft; identity: string }>) => {
      const result = await dependencies.execute.execute(context, value.action, value.draft, value.identity);
      const refreshed = await query.refetch();
      if (refreshed.error) throw refreshed.error;
      return result;
    },
    onSuccess: (result, input) => {
      setAction(undefined);
      setReceipt(Object.freeze({ requestId: input.identity, reference: result.reference, occurredAt: new Date().toISOString(), message: `${input.action.label}已提交，服务端状态：${result.state}` }));
    },
  });
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setSearch((current) => sectionQuery.patch(current, { cursor: undefined, selected: undefined, status: undefined }), { replace: true });
  }, [scope, setSearch]);
  const data = query.data;
  const states = useMemo(() => [...new Set(data?.items.map(({ state }) => state) ?? [])].sort(), [data?.items]);
  useEffect(() => {
    if (data === undefined || !url.status || states.includes(url.status)) return;
    setSearch((current) => sectionQuery.patch(current, { status: undefined, selected: undefined }), { replace: true });
  }, [data, setSearch, states, url.status]);
  const rows = useMemo(() => data?.items.filter((row) => !url.status || row.state === url.status) ?? [], [data?.items, url.status]);
  const selected = data?.items.find(({ id }) => id === url.selected);
  const globalActions = useMemo(() => sectionActions(section).filter(({ operation }) => canUseOperation(context, operation)), [context, section]);
  const recordActions = useMemo(() => sectionActions(section, selected).filter(({ operation }) => canUseOperation(context, operation)), [context, section, selected]);
  const begin = useCallback(
    (next: FinanceAction) => {
      setAction(next);
      if (next.record !== undefined) setSearch((current) => sectionQuery.patch(current, { selected: undefined }), { replace: true });
      setDraft(emptyFinanceActionDraft());
      setIdentity(dependencies.createIdentity());
      setReceipt(undefined);
      mutation.reset();
    },
    [dependencies, mutation, setSearch]
  );
  const change = useCallback(
    <TKey extends keyof FinanceActionDraft>(key: TKey, value: FinanceActionDraft[TKey]) => {
      setDraft((current) => ({ ...current, [key]: value, ...(key === 'proof' || key === 'confirmed' ? {} : { proof: '', confirmed: false }) }));
      if (key !== 'proof' && key !== 'confirmed') {
        setIdentity(dependencies.createIdentity());
        mutation.reset();
      }
    },
    [dependencies, mutation]
  );
  const validation = validateFinanceAction(action, draft, context.session.assurance.level);
  const submit = useCallback(() => {
    if (action === undefined || validation !== undefined || mutation.isPending) return;
    mutation.mutate({ action, draft, identity });
  }, [action, draft, identity, mutation, validation]);
  return Object.freeze({
    section,
    navigation: useFinanceNavigationViewModel(context, section),
    data,
    rows,
    states,
    status: url.status,
    selected,
    globalActions,
    recordActions,
    canAudit: canUseOperation(context, OP_FINANCE_AUDIT_READ),
    receipt,
    action:
      action === undefined ? undefined : Object.freeze({ target: action, draft, validation, busy: mutation.isPending, error: mutation.error ? presentError(mutation.error).message : undefined, assurance: context.session.assurance.level }),
    condition: allowed ? (ready ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 }) : 'forbidden') : 'forbidden',
    error: allowed ? safeQueryError(query.error) : '当前账号没有读取此财务模块的权限。',
    needsStepup: allowed && !ready,
    refresh: () => {
      if (ready) void query.refetch();
    },
    next: (nextCursor: string) => setSearch((current) => sectionQuery.patch(current, { cursor: nextCursor, selected: undefined })),
    actions: Object.freeze({
      filter: (status: string) => setSearch((current) => sectionQuery.patch(current, { status: status || undefined, cursor: undefined, selected: undefined })),
      open: (id: string) => setSearch((current) => sectionQuery.patch(current, { selected: id })),
      close: () => setSearch((current) => sectionQuery.patch(current, { selected: undefined })),
      audit: (record: FinanceRecord) => void navigate({ pathname: scopeRoutePath(context.scope, 'consolefinanceaudit'), search: new URLSearchParams({ reference: record.reference }).toString() }),
      begin,
      cancel: () => {
        if (!mutation.isPending) setAction(undefined);
      },
      reason: (value: string) => change('reason', value),
      proof: (value: string) => change('proof', value.trim()),
      confirmed: (value: boolean) => change('confirmed', value),
      periodStart: (value: string) => change('periodStart', value),
      periodEnd: (value: string) => change('periodEnd', value),
      currency: (value: string) => change('currency', value.trim().toUpperCase()),
      statementState: (value: FinanceActionDraft['statementState']) => change('statementState', value),
      settlement: (value: string) => change('settlement', value),
      amountMinor: (value: string) => change('amountMinor', value),
      destinationRef: (value: string) => change('destinationRef', value),
      submit,
      stepup: requestStepup,
      dismissReceipt: () => setReceipt(undefined),
    }),
  });
}

export type SectionViewModel = ReturnType<typeof useSectionViewModel>;
