import { OP_IDENTITY_INVITATIONS_CREATE, OP_IDENTITY_INVITATIONS_REVOKE } from '@shop/contract/ids';
import { chineseReference, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { InvitationDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import type { Invitation, InvitationReceipt } from '../model/Invitation';
import type { InvitationDraft } from '../model/InvitationDraft';
import { invitationTargets } from '../model/InvitationTarget';
import { identityFor, invitationMembershipKey, invitationQueryKey, readFilter, type CommandIdentity } from './InvitationState';

export type InvitationCreateKind = 'choice' | 'employee' | 'campaign' | 'signin';
export interface InvitationDepartment {
  readonly id: string;
  readonly name: string;
}
export function useInvitationViewModel(context: ConsoleContext, dependencies: InvitationDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const filter = useMemo(() => readFilter(search), [search]);
  const query = useQuery({ queryKey: invitationQueryKey(context, filter), queryFn: ({ signal }) => dependencies.read.execute(context, filter, signal) });
  const canIssue = canUseOperation(context, OP_IDENTITY_INVITATIONS_CREATE) && context.session.csrf !== undefined;
  const canRevoke = canUseOperation(context, OP_IDENTITY_INVITATIONS_REVOKE) && context.session.csrf !== undefined && context.session.assurance.level >= 3;
  const memberships = useQuery({
    queryKey: invitationMembershipKey(context),
    queryFn: ({ signal }) => dependencies.memberships.execute(context, signal),
    enabled: canIssue && context.session.assurance.level >= 3,
  });
  const [createKind, setCreateKind] = useState<InvitationCreateKind>();
  const [receipt, setReceipt] = useState<InvitationReceipt>();
  const [revoking, setRevoking] = useState<Invitation>();
  const createIdentity = useRef<CommandIdentity | undefined>(undefined);
  const revokeIdentity = useRef<CommandIdentity | undefined>(undefined);
  const refetch = query.refetch;

  const createMutation = useMutation({
    mutationFn: async (draft: InvitationDraft) => {
      const identity = identityFor(createIdentity, JSON.stringify(draft), dependencies.createIdentity);
      const result = await dependencies.create.execute(context, draft, identity);
      const read = await refetch();
      if (read.error) throw read.error;
      return result;
    },
    onSuccess: (result) => {
      createIdentity.current = undefined;
      setCreateKind(undefined);
      setReceipt(result);
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!revoking) throw new Error('INVITATION_SELECTION_REQUIRED');
      const fingerprint = JSON.stringify({ id: revoking.id, version: revoking.version, reason });
      const identity = identityFor(revokeIdentity, fingerprint, dependencies.createIdentity);
      const result = await dependencies.revoke.execute(context, revoking, reason, identity);
      const read = await refetch();
      if (read.error) throw read.error;
      return result;
    },
    onSuccess: () => {
      revokeIdentity.current = undefined;
      setRevoking(undefined);
    },
  });
  const storefronts = useMemo(() => invitationTargets(context.scope, context.scopes), [context.scope, context.scopes]);
  const departments = useMemo(
    () =>
      (context.scopes as readonly Readonly<{ id: string; kind: string; name?: string; path?: readonly Readonly<{ id: string }>[] }>[])
        .filter((scope) => scope.kind === 'department' && (scope.path?.some((entry) => entry.id === context.scope.id) ?? true))
        .map((scope) => Object.freeze({ id: scope.id, name: scope.name ?? chineseReference('组织范围', scope.id) })),
    [context.scope.id, context.scopes]
  );
  const organization =
    receipt === undefined ? (context.scope.name ?? chineseReference('组织范围', context.scope.id)) : (storefronts.find(({ id }) => id === receipt.organizationId)?.name ?? chineseReference('组织范围', receipt.organizationId));
  const updateFilter = useCallback(
    (name: 'target' | 'kind' | 'status', value: string) =>
      setSearch((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        next.delete('cursor');
        return next;
      }),
    [setSearch]
  );
  const next = useCallback(
    (cursor: string) =>
      setSearch((current) => {
        const nextSearch = new URLSearchParams(current);
        nextSearch.set('cursor', cursor);
        return nextSearch;
      }),
    [setSearch]
  );
  const first = useCallback(
    () =>
      setSearch((current) => {
        const nextSearch = new URLSearchParams(current);
        nextSearch.delete('cursor');
        return nextSearch;
      }),
    [setSearch]
  );
  const resetCreate = createMutation.reset;
  const resetRevoke = revokeMutation.reset;
  const openCreate = useCallback(
    (kind: InvitationCreateKind) => {
      createIdentity.current = undefined;
      resetCreate();
      setCreateKind(kind);
    },
    [resetCreate]
  );
  const closeCreate = useCallback(() => {
    if (!createMutation.isPending) {
      createIdentity.current = undefined;
      setCreateKind(undefined);
    }
  }, [createMutation.isPending]);
  const openChoice = useCallback(() => {
    if (!createMutation.isPending) {
      createIdentity.current = undefined;
      resetCreate();
      setCreateKind('choice');
    }
  }, [createMutation.isPending, resetCreate]);
  const verify = useCallback(() => {
    if (createMutation.isPending) return;
    createIdentity.current = undefined;
    resetCreate();
    setCreateKind(undefined);
    requestStepup();
  }, [createMutation.isPending, requestStepup, resetCreate]);
  const openRevoke = useCallback(
    (invitation: Invitation) => {
      revokeIdentity.current = undefined;
      resetRevoke();
      setRevoking(invitation);
    },
    [resetRevoke]
  );
  const closeRevoke = useCallback(() => {
    if (!revokeMutation.isPending) {
      revokeIdentity.current = undefined;
      setRevoking(undefined);
    }
  }, [revokeMutation.isPending]);
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const mutateCreate = createMutation.mutateAsync;
  const mutateRevoke = revokeMutation.mutateAsync;
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh,
        updateFilter,
        next,
        first,
        openCreate,
        openChoice,
        verify,
        closeCreate,
        create: (draft: InvitationDraft) =>
          mutateCreate(draft).then(
            () => undefined,
            () => undefined
          ),
        openRevoke,
        closeRevoke,
        revoke: (reason: string) =>
          mutateRevoke(reason).then(
            () => undefined,
            () => undefined
          ),
        discardReceipt: () => setReceipt(undefined),
      }),
    [closeCreate, closeRevoke, first, mutateCreate, mutateRevoke, next, openChoice, openCreate, openRevoke, refresh, updateFilter, verify]
  );
  return Object.freeze({
    filter,
    page: query.data,
    cursor: filter.cursor,
    createKind,
    receipt,
    revoking,
    storefronts,
    departments,
    organization,
    canIssue,
    canRevoke,
    assurance: context.session.assurance.level,
    memberships: memberships.data?.items ?? [],
    membershipsReady: memberships.isSuccess,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }),
    error: safeQueryError(query.error),
    membershipError: context.session.assurance.level >= 3 ? safeQueryError(memberships.error) : undefined,
    fetching: query.isFetching,
    createBusy: createMutation.isPending,
    createError: safeQueryError(createMutation.error),
    revokeBusy: revokeMutation.isPending,
    revokeError: safeQueryError(revokeMutation.error),
    boundary: Object.freeze({
      title: context.session.assurance.level < 2 ? '需要重新验证身份' : storefronts.length === 0 ? '当前范围没有可邀请商城' : '一次性安全回执',
      message:
        context.session.assurance.level < 2
          ? '在“新建邀请”中完成一次身份验证，即可安全选择新员工注册或现有成员访问。'
          : storefronts.length === 0
            ? '切换到包含已授权商城的集团或商城范围后再创建注册邀请。'
            : '创建失败会保留表单并复用同一请求编号；成功回执关闭后，邀请码无法恢复。',
    }),
    actions,
  });
}

export type InvitationViewModel = ReturnType<typeof useInvitationViewModel>;
