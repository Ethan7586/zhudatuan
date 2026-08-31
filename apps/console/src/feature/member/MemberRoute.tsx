import { Button } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { memberKey, readMembers } from './MemberQuery';
import { MemberInvitationDialog } from './MemberInvitationDialog';
import { MemberRegistrationResetDialog } from './MemberRegistrationResetDialog';
import type { Member } from './MemberSchema';

const baseColumns: readonly DataColumn<Member>[] = [
  { key: 'name', label: '成员', render: (row) => row.display_name },
  { key: 'employee', label: '员工号', render: (row) => row.employee_no ?? '—' },
  { key: 'client', label: '身份端', render: (row) => row.client === 'operator' ? '后台' : row.client === 'storefront' ? '购物端' : row.client },
  { key: 'profile', label: '档案状态', render: (row) => row.status },
  { key: 'membership', label: '成员状态', render: (row) => row.membership_status },
  { key: 'joined', label: '加入时间', render: (row) => formatDate(row.joined_at) },
  { key: 'version', label: 'Access Version', render: (row) => row.access_version },
];

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member>();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: memberKey(context, cursor), queryFn: ({ signal }) => readMembers(context, cursor, signal) });
  const data = query.data;
  const error = safeQueryError(query.error);
  const state = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: data !== undefined,
    empty: data?.items.length === 0,
    stale: query.isStale,
  });
  const inviteContext = memberInvitationContext(context);
  const invitationAvailable = context.session.permissions.includes('identity.invitation.manage') && context.session.capabilities.includes('identity.invitations.create') && context.session.csrf !== undefined;
  const resetAvailable = context.session.permissions.includes('identity.registration.reset') && context.session.capabilities.includes('identity.members.reset') && context.session.csrf !== undefined;
  const columns = useMemo<readonly DataColumn<Member>[]>(() => resetAvailable ? [
    ...baseColumns,
    { key: 'actions', label: '操作', render: (row) => row.reset_allowed ? (
      <Button tone="danger" onPress={() => setResetTarget(row)}>重置注册身份</Button>
    ) : '—' },
  ] : baseColumns, [resetAvailable]);

  return (
    <>
      <PagedResource
        title="成员管理"
        eyebrow="SMART WING MEMBER"
        description="成员档案与组织成员关系均来自 member.members.read。"
        condition={state}
        {...(error === undefined ? {} : { error })}
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.membership_id}
        count={data?.count ?? 0}
        {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
        actions={
          invitationAvailable ? (
            <Button tone="primary" onPress={() => setInvitationOpen(true)}>
              生成管理员邀请码
            </Button>
          ) : null
        }
        boundary={{ title: '成员资料不会被物理删除', message: 'Owner 可重置符合条件的注册身份并释放登录手机号；订单、卡券、财务记录与安全审计继续保留。批量导入、停用与角色调整仍保持关闭。' }}
        retry={() => {
          void query.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
      <MemberInvitationDialog context={inviteContext} open={invitationOpen} onClose={() => setInvitationOpen(false)} />
      <MemberRegistrationResetDialog
        context={context}
        target={resetTarget}
        onClose={() => setResetTarget(undefined)}
        onReset={() => { void query.refetch(); }}
        onInvite={() => setInvitationOpen(true)}
      />
    </>
  );
}

function memberInvitationContext(context: ConsoleContext): ConsoleContext {
  return context;
}
