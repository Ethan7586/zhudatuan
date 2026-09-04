import { presentError, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { ReferralDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { pageCursor } from '../../../shared/query/QueryState';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { decideReferralAccess } from '../model/ReferralAccess';
import type { ReferralAction, ReferralActionValues } from '../model/Referral';
import { referralReadOperations } from '../model/ReferralOperation';
import { useReferralNavigationViewModel } from './NavigationViewModel';
import { referralQueryKey } from './ReferralQueryKey';
import { emptyReferralDraft, referralActionMessage, referralActionReference, referralActionValues, referralDraftFor, validateReferralAction, validateReferralBody, type ReferralDraft } from './ReferralAction';
import { readReferralRoute, referralContent } from './ReferralContent';

interface MutationInput {
  readonly values: ReferralActionValues;
  readonly proof: string;
  readonly identity: string;
}
export function useReferralViewModel(context: ConsoleContext, dependencies: ReferralDependencies, requestStepup: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const route = readReferralRoute(location.pathname);
  const section = route.section;
  const cursor = section === 'settings' ? undefined : (search.get('cursor') ?? undefined);
  const operation = referralReadOperations[section];
  const access = decideReferralAccess(context, operation);
  const navigation = useReferralNavigationViewModel(context, section);
  const scope = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scope);

  useEffect(() => {
    if (route.valid) return;
    void navigate(scopeRoutePath(context.scope, 'consolereferralview', { view: 'settings' }), { replace: true });
  }, [context.scope, navigate, route.valid]);

  useEffect(() => {
    if (!route.valid) return;
    const scopeChanged = previousScope.current !== scope;
    previousScope.current = scope;
    if (!scopeChanged && (section !== 'settings' || !search.has('cursor'))) return;
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('cursor');
        return next;
      },
      { replace: true }
    );
  }, [route.valid, scope, search, section, setSearch]);

  const query = useQuery({
    queryKey: referralQueryKey(context, section, cursor),
    queryFn: ({ signal }) => dependencies.read.execute(context, section, cursor, signal),
    enabled: access.allowed,
  });
  const [action, setAction] = useState<ReferralAction>();
  const [draft, setDraft] = useState<ReferralDraft>(emptyReferralDraft());
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [approval, setApproval] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState<string>();
  const [receipt, setReceipt] = useState<Receipt>();

  const mutation = useMutation({
    mutationFn: async ({ values, proof, identity: requestIdentity }: MutationInput) => {
      if (values.action.kind === 'setting') await dependencies.manageSetting.execute(context, { ...values, action: values.action }, proof, requestIdentity);
      else if (values.action.kind === 'product') await dependencies.manageProduct.execute(context, { ...values, action: values.action }, proof, requestIdentity);
      else await dependencies.reviewMember.execute(context, { ...values, action: values.action }, proof, requestIdentity);
      const result = await query.refetch();
      if (result.error) throw result.error;
    },
    onSuccess: (_, input) => {
      setAction(undefined);
      setReceipt(Object.freeze({ requestId: input.identity, reference: referralActionReference(input.values.action), occurredAt: new Date().toISOString(), message: referralActionMessage(input.values.action) }));
    },
  });

  const mutate = mutation.mutate;
  const mutationPending = mutation.isPending;
  const refetch = query.refetch;
  const resetMutation = mutation.reset;
  const begin = useCallback(
    (next: ReferralAction) => {
      setAction(next);
      setDraft(referralDraftFor(next));
      setIdentity(dependencies.createIdentity());
      setApproval('');
      setApprovalError(undefined);
      setReceipt(undefined);
      resetMutation();
    },
    [dependencies, resetMutation]
  );
  const change = useCallback(
    <TKey extends keyof ReferralDraft>(key: TKey, value: ReferralDraft[TKey]) => {
      const changesBody = key !== 'proof' && key !== 'confirmed';
      setDraft((current) => ({ ...current, [key]: value, ...(changesBody ? { proof: '', confirmed: false } : {}) }));
      if (changesBody) {
        setApproval('');
        setApprovalError(undefined);
        setIdentity(dependencies.createIdentity());
        resetMutation();
      }
    },
    [dependencies, resetMutation]
  );
  const values = useMemo(() => (action === undefined ? undefined : referralActionValues(action, draft)), [action, draft]);
  const validation = validateReferralAction(action, draft, context.session.assurance.level);
  const requestApproval = useCallback(async () => {
    if (values === undefined || validateReferralBody(values) !== undefined || approvalBusy) return;
    setApprovalBusy(true);
    setApprovalError(undefined);
    try {
      setApproval(await dependencies.prepare.execute(values, context.session.membership));
    } catch (error) {
      setApprovalError(presentError(error).message);
    } finally {
      setApprovalBusy(false);
    }
  }, [approvalBusy, context.session.membership, dependencies, values]);
  const submit = useCallback(() => {
    if (values === undefined || validation !== undefined || mutationPending) return;
    mutate({ values, proof: draft.proof, identity });
  }, [draft.proof, identity, mutate, mutationPending, validation, values]);
  const page = query.data;
  const content = useMemo(() => (page === undefined ? undefined : referralContent(page, context, begin)), [begin, context, page]);
  const meta = navigation.items.find((item) => item.key === section) ?? navigation.items[0]!;
  const refresh = useCallback(() => {
    if (access.allowed) void refetch();
  }, [access.allowed, refetch]);
  const next = useCallback((nextCursor: string) => setSearch(pageCursor(search, nextCursor)), [search, setSearch]);
  const first = useCallback(
    () =>
      setSearch((current) => {
        const nextSearch = new URLSearchParams(current);
        nextSearch.delete('cursor');
        return nextSearch;
      }),
    [setSearch]
  );
  const close = useCallback(() => {
    if (!mutationPending) setAction(undefined);
  }, [mutationPending]);
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        next,
        first,
        close,
        reason: (value: string) => change('reason', value),
        proof: (value: string) => change('proof', value.trim()),
        enabled: (value: boolean) => change('enabled', value),
        recruitEnabled: (value: boolean) => change('recruitEnabled', value),
        reviewRequired: (value: boolean) => change('reviewRequired', value),
        rewardEnabled: (value: boolean) => change('rewardEnabled', value),
        bindingMode: (value: ReferralDraft['bindingMode']) => change('bindingMode', value),
        days: (value: number) => change('firstTouchDays', value),
        freezeDays: (value: number) => change('freezeDays', value),
        settlementTrigger: (value: ReferralDraft['settlementTrigger']) => change('settlementTrigger', value),
        rate: (value: number) => change('rateBasisPoints', value),
        rewardRate: (value: number) => change('rewardBasisPoints', value),
        minimum: (value: number) => change('minimumWithdrawalMinor', value),
        monthlyLimit: (value: number | null) => change('monthlyWithdrawalLimit', value),
        confirmed: (value: boolean) => change('confirmed', value),
        requestApproval: () => {
          void requestApproval();
        },
        submit,
        stepup: requestStepup,
        dismissReceipt: () => setReceipt(undefined),
      }),
    [change, close, first, next, refresh, requestApproval, requestStepup, submit]
  );

  return Object.freeze({
    section,
    meta,
    navigation,
    page,
    content,
    cursor,
    condition: access.allowed ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }) : 'forbidden',
    error: access.allowed ? safeQueryError(query.error) : access.reason,
    canRefresh: access.allowed,
    fetching: query.isFetching,
    receipt,
    action:
      action === undefined
        ? undefined
        : Object.freeze({
            target: action,
            draft,
            approval,
            approvalBusy,
            approvalError,
            busy: mutation.isPending,
            error: safeQueryError(mutation.error),
            approvalValidation: values === undefined ? undefined : validateReferralBody(values),
            validation,
            assurance: context.session.assurance.level,
          }),
    actions,
  });
}

export type ReferralViewModel = ReturnType<typeof useReferralViewModel>;
