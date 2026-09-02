import { Button } from '@shop/design';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../../shared/presentation/QueryState';
import { PagedResource } from '../../../shared/ui/PagedResource';
import { CreateInvitation } from '../application/CreateInvitation';
import { invitationKey, ReadInvitations } from '../application/ReadInvitations';
import { RevokeInvitation } from '../application/RevokeInvitation';
import { InvitationGateway } from '../infrastructure/InvitationGateway';
import type { Invitation, InvitationFilter, InvitationReceipt } from '../model/Invitation';
import type { InvitationDraft } from '../model/InvitationDraft';
import { invitationTargets } from '../model/InvitationTarget';
import { CampaignInvitationDialog } from './CampaignInvitationDialog';
import { EmployeeInvitationDialog } from './EmployeeInvitationDialog';
import { InvitationReceiptDialog } from './InvitationReceiptDialog';
import { InvitationRevokeDialog } from './InvitationRevokeDialog';
import { invitationColumns } from './InvitationTable';
import { SigninInvitationDialog } from './SigninInvitationDialog';
import './Invitation.css';

const gateway = new InvitationGateway();
const reader = new ReadInvitations(gateway);
const creator = new CreateInvitation(gateway);
const revoker = new RevokeInvitation(gateway);
type CreateKind = 'employee' | 'campaign' | 'signin';

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const selectedTarget = target(search.get('target'));
  const selectedKind = kind(search.get('kind'));
  const selectedStatus = status(search.get('status'));
  const filter: InvitationFilter = {
    ...(selectedTarget === undefined ? {} : { target: selectedTarget }),
    ...(selectedKind === undefined ? {} : { kind: selectedKind }),
    ...(selectedStatus === undefined ? {} : { status: selectedStatus }),
    ...(search.get('cursor') ? { cursor: search.get('cursor')! } : {}),
  };
  const query = useQuery({ queryKey: invitationKey(context, filter), queryFn: ({ signal }) => reader.execute(context, filter, signal) });
  const memberships = useQuery({ queryKey: ['console', context.scope.id, context.session.accessVersion, 'invitation.memberships'], queryFn: ({ signal }) => gateway.memberships(context, signal) });
  const [createKind, setCreateKind] = useState<CreateKind>();
  const [receipt, setReceipt] = useState<InvitationReceipt>();
  const [revoking, setRevoking] = useState<Invitation>();
  const canIssue = allowed(context, 'identity.invitation.issue', 'identity.invitations.create');
  const canRevoke = allowed(context, 'identity.invitation.revoke', 'identity.invitations.revoke') && context.session.assurance.level >= 3;
  const createMutation = useMutation({
    mutationFn: (draft: InvitationDraft) => creator.execute(context, draft),
    onSuccess: async (value) => {
      setCreateKind(undefined);
      setReceipt(value);
      await queryClient.invalidateQueries({ queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'identity.invitations.read'] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!revoking) throw new Error('INVITATION_SELECTION_REQUIRED');
      return revoker.execute(context, revoking, reason);
    },
    onSuccess: async () => {
      setRevoking(undefined);
      await queryClient.invalidateQueries({ queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'identity.invitations.read'] });
    },
  });
  const departments = useMemo(() => (context.scopes as readonly Readonly<{ id: string; kind: string; name?: string; path?: readonly Readonly<{ id: string }>[] }>[]).filter((scope) => scope.kind === 'department' && (scope.path?.some((entry) => entry.id === context.scope.id) ?? true)).map((scope) => ({ id: scope.id, name: scope.name ?? scope.id })), [context.scope.id, context.scopes]);
  const storefronts = useMemo(() => invitationTargets(context.scope, context.scopes), [context.scope, context.scopes]);
  const updateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value === '') next.delete(name); else next.set(name, value);
    next.delete('cursor');
    setSearch(next);
  };
  const openCreate = (next: CreateKind) => {
    if (next === 'employee' && context.session.assurance.level < 2) return;
    if (next !== 'employee' && context.session.assurance.level < 3) return;
    createMutation.reset();
    setCreateKind(next);
  };
  const error = safeQueryError(query.error);
  const createError = safeQueryError(createMutation.error);
  const revokeError = safeQueryError(revokeMutation.error);
  return (
    <>
      <PagedResource
        title="员工邀请"
        eyebrow="SMART WING · INVITATION"
        description="创建员工注册、共享注册和指定成员登录邀请。邀请码只在创建成功后显示一次。"
        condition={queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 })}
        {...(error === undefined ? {} : { error })}
        rows={query.data?.items ?? []}
        columns={invitationColumns(canRevoke, setRevoking)}
        rowKey={(row) => row.id}
        count={query.data?.count ?? 0}
        {...(query.data?.nextCursor === undefined ? {} : { nextCursor: query.data.nextCursor })}
        actions={<div className="invitationtoolbar">
          <label>位置<select value={filter.target ?? ''} onChange={(event) => updateFilter('target', event.target.value)}><option value="">全部</option><option value="storefront">员工商城</option><option value="console">管理控制台</option></select></label>
          <label>类型<select value={filter.kind ?? ''} onChange={(event) => updateFilter('kind', event.target.value)}><option value="">全部</option><option value="enrollment">员工注册</option><option value="campaign">共享注册</option><option value="signin">登录邀请</option></select></label>
          <label>状态<select value={filter.status ?? ''} onChange={(event) => updateFilter('status', event.target.value)}><option value="">全部</option><option value="active">生效中</option><option value="exhausted">已用尽</option><option value="revoked">已撤销</option><option value="expired">已过期</option></select></label>
          <Button tone="primary" onPress={() => openCreate('employee')} isDisabled={!canIssue || storefronts.length === 0 || context.session.assurance.level < 2}>邀请员工</Button>
          <Button onPress={() => openCreate('signin')} isDisabled={!canIssue || context.session.assurance.level < 3}>登录邀请</Button>
          <Button onPress={() => openCreate('campaign')} isDisabled={!canIssue || storefronts.length === 0 || context.session.assurance.level < 3}>共享邀请</Button>
        </div>}
        boundary={{ title: context.session.assurance.level < 2 ? '需要重新验证身份' : storefronts.length === 0 ? '当前范围没有可邀请商城' : '一次性安全回执', message: context.session.assurance.level < 2 ? '员工邀请至少需要双因素验证；登录和共享邀请需要更高强度验证。' : storefronts.length === 0 ? '切换到包含已授权商城的集团或商城范围后再创建注册邀请。' : '创建失败会保留表单；成功回执关闭后，邀请码无法恢复。' }}
        retry={() => void query.refetch()}
        next={(cursor) => updateFilter('cursor', cursor)}
      />
      <EmployeeInvitationDialog open={createKind === 'employee'} targets={storefronts} departments={departments} busy={createMutation.isPending} {...(createError ? { error: createError } : {})} onClose={() => !createMutation.isPending && setCreateKind(undefined)} onSubmit={(draft) => createMutation.mutateAsync(draft).then(() => undefined)} />
      <CampaignInvitationDialog open={createKind === 'campaign'} targets={storefronts} busy={createMutation.isPending} {...(createError ? { error: createError } : {})} onClose={() => !createMutation.isPending && setCreateKind(undefined)} onSubmit={(draft) => createMutation.mutateAsync(draft).then(() => undefined)} />
      <SigninInvitationDialog open={createKind === 'signin'} memberships={memberships.data?.items ?? []} busy={createMutation.isPending} {...(createError ? { error: createError } : {})} onClose={() => !createMutation.isPending && setCreateKind(undefined)} onSubmit={(draft) => createMutation.mutateAsync(draft).then(() => undefined)} />
      <InvitationReceiptDialog {...(receipt === undefined ? {} : { receipt })} organization={receipt === undefined ? context.scope.name ?? context.scope.id : storefronts.find(({ id }) => id === receipt.organizationId)?.name ?? receipt.organizationId} onDiscard={() => setReceipt(undefined)} />
      <InvitationRevokeDialog {...(revoking === undefined ? {} : { invitation: revoking })} busy={revokeMutation.isPending} {...(revokeError ? { error: revokeError } : {})} onClose={() => { if (!revokeMutation.isPending) setRevoking(undefined); }} onSubmit={(reason) => revokeMutation.mutateAsync(reason).then(() => undefined)} />
    </>
  );
}

function allowed(context: ReturnType<typeof useConsoleContext>, permission: string, capability: string): boolean {
  return context.session.permissions.includes(permission) && context.session.capabilities.includes(capability) && context.session.csrf !== undefined;
}
function target(value: string | null): InvitationFilter['target'] { return value === 'console' || value === 'storefront' ? value : undefined; }
function kind(value: string | null): InvitationFilter['kind'] { return value === 'signin' || value === 'enrollment' || value === 'campaign' ? value : undefined; }
function status(value: string | null): InvitationFilter['status'] { return value === 'draft' || value === 'active' || value === 'exhausted' || value === 'revoked' || value === 'expired' ? value : undefined; }
