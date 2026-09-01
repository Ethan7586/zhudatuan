import { Button } from '@shop/design';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../../shared/api/QueryState';
import { PagedResource } from '../../../shared/ui/PagedResource';
import type { Invitation } from './AccessSchema';
import { accessKey, createInvitation, invitationKey, readAccess, readInvitations, revokeInvitation, type CreateInvitationInput, type InvitationFilters } from './AccessQuery';
import { InvitationCodeDialog } from './InvitationCodeDialog';
import { InvitationCreateDialog } from './InvitationCreateDialog';
import { InvitationRevokeDialog } from './InvitationRevokeDialog';
import { invitationColumns } from './InvitationTable';

export function InvitationPanel({ tabs }: Readonly<{ tabs: ReactNode }>) {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const target = search.get('target') === 'storefront' ? 'storefront' : 'console';
  const status = statusFilter(search.get('status'));
  const kind = kindFilter(search.get('kind'));
  const cursor = search.get('cursor') ?? undefined;
  const filter: InvitationFilters = { target, status, kind, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({ queryKey: invitationKey(context, filter), queryFn: ({ signal }) => readInvitations(context, filter, signal) });
  const members = useQuery({ queryKey: accessKey(context), queryFn: ({ signal }) => readAccess(context, undefined, signal) });
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState<string>();
  const [revoking, setRevoking] = useState<Invitation>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const action = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      action.current?.abort();
    },
    []
  );
  const canIssue = allowed(context, 'identity.invitation.issue', 'identity.invitations.create') && context.session.assurance.level >= 3;
  const canRevoke = allowed(context, 'identity.invitation.revoke', 'identity.invitations.revoke') && context.session.assurance.level >= 3;
  const update = (values: Readonly<Record<string, string | null>>) => {
    const next = new URLSearchParams(search);
    next.set('view', 'invitations');
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    if (!Object.hasOwn(values, 'cursor')) next.delete('cursor');
    setSearch(next);
  };
  const submitCreate = async (input: CreateInvitationInput) =>
    run(async (signal) => {
      const result = await createInvitation(context, input, signal);
      setCreateOpen(false);
      setCreatedCode(result.code);
      await refresh();
    });
  const submitRevoke = async (reason: string) => {
    if (revoking === undefined) return;
    await run(async (signal) => {
      await revokeInvitation(context, revoking.id, revoking.version, reason, signal);
      setRevoking(undefined);
      await refresh();
    });
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['console', 'identity.invitations.read'] });
  const run = async (task: (signal: AbortSignal) => Promise<void>) => {
    setBusy(true);
    setActionError(undefined);
    action.current?.abort();
    const controller = new AbortController();
    action.current = controller;
    try {
      await task(controller.signal);
    } catch (cause) {
      setActionError(safeQueryError(cause instanceof Error ? cause : new Error('REQUEST_FAILED')) ?? '操作失败，请重试。');
    } finally {
      if (action.current === controller) action.current = null;
      setBusy(false);
    }
  };
  const data = query.data;
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 });
  return (
    <>
      <PagedResource
        title="权限中心"
        eyebrow="SMART WING ACCESS"
        description="邀请证明与授权严格分离；列表不会返回邀请码、Token Hash、Recipient 明文或 PreAuth。"
        condition={condition}
        {...(error === undefined ? {} : { error })}
        rows={data?.items ?? []}
        columns={invitationColumns(canRevoke, (value) => {
          setActionError(undefined);
          setRevoking(value);
        })}
        rowKey={(row) => row.id}
        count={data?.count ?? 0}
        {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
        actions={
          <>
            {tabs}
            <form className="filterform">
              <label>
                Target
                <select value={target} onChange={(event) => update({ target: event.target.value })}>
                  <option value="console">console</option>
                  <option value="storefront">storefront</option>
                </select>
              </label>
              <label>
                类型
                <select value={kind ?? ''} onChange={(event) => update({ kind: event.target.value || null })}>
                  <option value="">全部</option>
                  <option value="signin">登录</option>
                  <option value="enrollment">入驻</option>
                  <option value="campaign">活动</option>
                </select>
              </label>
              <label>
                状态
                <select value={status ?? ''} onChange={(event) => update({ status: event.target.value || null })}>
                  <option value="">全部</option>
                  <option value="active">生效中</option>
                  <option value="exhausted">已用尽</option>
                  <option value="revoked">已撤销</option>
                  <option value="expired">已过期</option>
                </select>
              </label>
            </form>
            <Button
              tone="primary"
              onPress={() => {
                setActionError(undefined);
                setCreateOpen(true);
              }}
              isDisabled={!canIssue}
            >
              签发邀请
            </Button>
          </>
        }
        boundary={{ title: canIssue ? '一次性凭据安全边界' : '签发需要高强度二次验证与授权', message: canIssue ? '邀请码只在签发成功后显示一次；关闭后永久丢弃。' : '请重新完成二次验证，并确认当前成员关系同时拥有业务权限和功能能力。' }}
        retry={() => void query.refetch()}
        next={(next) => update({ cursor: next })}
      />
      <InvitationCreateDialog
        open={createOpen}
        memberships={members.data?.items ?? []}
        scope={context.scope.id}
        scopeKind={context.scope.kind}
        busy={busy}
        {...(actionError === undefined ? {} : { error: actionError })}
        onClose={() => {
          if (!busy) setCreateOpen(false);
        }}
        onSubmit={submitCreate}
      />
      <InvitationCodeDialog code={createdCode} onClose={() => setCreatedCode(undefined)} />
      <InvitationRevokeDialog
        invitation={revoking}
        busy={busy}
        {...(actionError === undefined ? {} : { error: actionError })}
        onClose={() => {
          if (!busy) setRevoking(undefined);
        }}
        onSubmit={submitRevoke}
      />
    </>
  );
}

function allowed(context: ReturnType<typeof useConsoleContext>, permission: string, capability: string): boolean {
  return context.session.permissions.includes(permission) && context.session.capabilities.includes(capability);
}
function statusFilter(value: string | null): InvitationFilters['status'] {
  return value === 'active' || value === 'exhausted' || value === 'revoked' || value === 'expired' ? value : null;
}
function kindFilter(value: string | null): InvitationFilters['kind'] {
  return value === 'signin' || value === 'enrollment' || value === 'campaign' ? value : null;
}
