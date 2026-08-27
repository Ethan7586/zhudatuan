<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { Button } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
=======
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { Button } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { scopePath } from '../../shared/url/ScopePath';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { scopePath } from '../../shared/url/ScopePath';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { accessKey, readAccess } from './AccessQuery';
import type { AccessMembership } from './AccessSchema';

const columns: readonly DataColumn<AccessMembership>[] = [
  { key: 'membership', label: '成员关系', render: (row) => row.id },
  { key: 'status', label: '状态', render: (row) => row.status },
  { key: 'roles', label: '角色', render: (row) => row.roles.map(({ name }) => name).join('、') || '未分配' },
  { key: 'scopes', label: '授权范围', render: (row) => `${row.scopes.length} 项` },
  { key: 'denies', label: '显式拒绝', render: (row) => row.scopes.filter(({ effect }) => effect === 'deny').length },
  { key: 'version', label: 'Access Version', render: (row) => row.access_version },
];

export function Component() {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const context = useConsoleContext(); const navigate = useNavigate(); const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
=======
  const context = useConsoleContext(); const [search, setSearch] = useSearchParams(); const cursor = search.get('cursor') ?? undefined;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const context = useConsoleContext(); const navigate = useNavigate(); const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const context = useConsoleContext(); const [search, setSearch] = useSearchParams(); const cursor = search.get('cursor') ?? undefined;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const query = useQuery({ queryKey: accessKey(context, cursor), queryFn: ({ signal }) => readAccess(context, cursor, signal) });
  const data = query.data; const error = safeQueryError(query.error);
  const state = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: data !== undefined, empty: data?.items.length === 0, stale: query.isStale });
  return <PagedResource title="权限中心" eyebrow="SMART WING ACCESS" description="成员角色、显式拒绝、Scope Grant 和 Access Version 来自 access.center.read。"
    condition={state} {...(error === undefined ? {} : { error })} rows={data?.items ?? []} columns={columns} rowKey={(row) => row.id}
    count={data?.count ?? 0} {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    actions={<Button tone="primary" onPress={() => { void navigate(scopePath(context.scope, 'settings/members')); }}>成员管理与邀请码</Button>}
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    actions={<Button tone="primary" onPress={() => { void navigate(scopePath(context.scope, 'settings/members')); }}>成员管理与邀请码</Button>}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    boundary={{ title: '授权变更保持关闭', message: '角色与 Scope 变更缺 Preview、Step-up、expectedVersion 和重读回执时不执行。' }}
    retry={() => { void query.refetch(); }} next={(next) => setSearch(pageCursor(search, next))} />;
}
