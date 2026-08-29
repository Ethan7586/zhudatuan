import { Button } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { MemberInvitationDialog } from './MemberInvitationDialog';
import { ordinaryAdminInvitationScope } from './MemberInvitationCommand';
import { memberKey, readMembers } from './MemberQuery';
import type { Member } from './MemberSchema';

const columns: readonly DataColumn<Member>[] = [
  { key: 'name', label: '成员', render: (row) => row.display_name },
  { key: 'employee', label: '员工号', render: (row) => row.employee_no ?? '—' },
  { key: 'profile', label: '档案状态', render: (row) => row.status },
  { key: 'membership', label: '成员状态', render: (row) => row.membership_status },
  { key: 'joined', label: '加入时间', render: (row) => formatDate(row.joined_at) },
  { key: 'version', label: 'Access Version', render: (row) => row.access_version },
];

export function Component() {
  const context = useConsoleContext(); const [search, setSearch] = useSearchParams(); const cursor = search.get('cursor') ?? undefined;
  const [invitationOpen, setInvitationOpen] = useState(false);
  const query = useQuery({ queryKey: memberKey(context, cursor), queryFn: ({ signal }) => readMembers(context, cursor, signal) });
  const data = query.data; const error = safeQueryError(query.error);
  const canCreateInvitation = context.session.permissions.includes('identity.invitation.manage')
    && context.session.capabilities.includes('identity.invitations.create')
    && ordinaryAdminInvitationScope(context) !== undefined;
  const state = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: data !== undefined, empty: data?.items.length === 0, stale: query.isStale });
  return <>
    <PagedResource title="成员管理" eyebrow="SMART WING MEMBER" description="成员档案与组织成员关系均来自 member.members.read。"
      condition={state} {...(error === undefined ? {} : { error })} rows={data?.items ?? []} columns={columns} rowKey={(row) => row.id}
      count={data?.count ?? 0} {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
      {...(canCreateInvitation ? { actions: <Button tone="primary" onPress={() => setInvitationOpen(true)}>生成普通管理员邀请码</Button> } : {})}
      boundary={{ title: '批量与删除保持关闭', message: '批量导入、批量变更和成员删除仍需完整校验、错误报告与审计回读，当前不开放。' }}
      retry={() => { void query.refetch(); }} next={(next) => setSearch(pageCursor(search, next))} />
    {canCreateInvitation ? <MemberInvitationDialog open={invitationOpen} context={context} onClose={() => setInvitationOpen(false)} /> : null}
  </>;
}
