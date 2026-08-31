import { Button } from '@shop/design';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../../shared/api/QueryState';
import type { DataColumn } from '../../../shared/ui/DataTable';
import { formatDate } from '../../../shared/ui/Format';
import { PagedResource } from '../../../shared/ui/PagedResource';
import { pageCursor } from '../../../shared/url/PageCursor';
import { memberKey, readMembers } from './MemberQuery';
import { executeMemberChange, type MemberChange } from './MemberCommand';
import { MemberDialog } from './MemberDialog';
import type { Member } from './MemberSchema';
import './Member.css';

const baseColumns: readonly DataColumn<Member>[] = [
  { key: 'name', label: '成员', render: (row) => row.display_name },
  { key: 'employee', label: '员工号', render: (row) => row.employee_no ?? '—' },
  { key: 'profile', label: '档案状态', render: (row) => row.status },
  { key: 'membership', label: '成员状态', render: (row) => row.membership_status },
  { key: 'joined', label: '加入时间', render: (row) => formatDate(row.joined_at) },
  { key: 'version', label: '权限版本', render: (row) => `第 ${row.access_version} 版` },
];

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [editing, setEditing] = useState<Member>();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: memberKey(context, cursor), queryFn: ({ signal }) => readMembers(context, cursor, signal) });
  const data = query.data;
  const error = safeQueryError(query.error);
  const state = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0, stale: query.isStale });
  const canManage = context.session.permissions.includes('member.manage') && context.session.capabilities.includes('identity.members.manage') && context.session.csrf !== undefined;
  const mutation = useMutation({
    mutationFn: (change: MemberChange) => executeMemberChange(context, change),
    onSuccess: async () => {
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['console', context.scope.kind, context.scope.id] });
    },
  });
  const mutationError = safeQueryError(mutation.error);
  const columns = useMemo<readonly DataColumn<Member>[]>(
    () => [
      ...baseColumns,
      {
        key: 'actions',
        label: '操作',
        render: (row) => (
          <div className="memberactions">
            <Button onPress={() => setEditing(row)} isDisabled={!canManage}>
              编辑成员
            </Button>
          </div>
        ),
      },
    ],
    [canManage]
  );
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
        boundary={{
          title: canManage ? '成员资料与状态可维护' : '当前账号只有查看权限',
          message: canManage ? '变更要求二次验证、跨站请求保护、防重复提交、目标权限版本、事务提交和权威回读；成员历史不会被物理删除。' : '权限和能力同时满足后才会开放编辑按钮，前端显示状态不参与服务端授权。',
        }}
        retry={() => {
          void query.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
      <MemberDialog
        member={editing}
        assurance={context.session.assurance.level}
        busy={mutation.isPending}
        {...(mutationError === undefined ? {} : { error: mutationError })}
        onClose={() => {
          if (!mutation.isPending) setEditing(undefined);
        }}
        onSubmit={(change) => mutation.mutate(change)}
      />
    </>
  );
}
