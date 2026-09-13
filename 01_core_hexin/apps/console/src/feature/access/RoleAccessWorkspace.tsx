import { Badge, Button, MasterDetail, MasterItem, Surface, WorkspaceHero } from '@shop/design';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { safeQueryError } from '../../shared/api/QueryState';
import { scopePath } from '../../shared/url/ScopePath';
import { MemberInvitationDialog } from '../member/MemberInvitationDialog';
import { memberInvitationAvailable } from '../member/MemberInvitationCommand';
import { ACCESS_QUERY_STALE_TIME_MS, accessKey, readAccess } from './AccessQuery';
import type { AccessRole } from './AccessSchema';
import { roleCommandAvailable } from './AccessRoleCommand';
import { invitationRecordsAvailable, invitationRecordsKey, readInvitationRecords } from './InvitationRecordsQuery';
import { isManagementRole } from './ManagementRole';
import type { InvitationRecord } from './InvitationRecordsSchema';
import { RoleEditor, type RoleEditorRecord } from './RoleEditor';
import './role-access-workspace.css';

export function RoleAccessWorkspace() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const requestedRoleId = search.get('role') ?? undefined;
  const requestedView = search.get('view') === 'members' ? 'members' : 'permissions';
  const [selectedId, setSelectedId] = useState<string>();
  const [draftId, setDraftId] = useState<string>();
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState<string>();
  const [invitationOpen, setInvitationOpen] = useState(false);
  const section = search.get('section') === 'invitations' ? 'invitations' : 'roles';
  const canRead = context.session.permissions.includes('access.center.read');
  const canWrite = roleCommandAvailable(context);
  const invitationEnabled = memberInvitationAvailable(context);
  const invitationRecordsEnabled = invitationRecordsAvailable(context);
  const query = useQuery({
    queryKey: accessKey(context),
    queryFn: ({ signal }) => readAccess(context, undefined, signal),
    enabled: canRead,
    staleTime: ACCESS_QUERY_STALE_TIME_MS,
  });
  const invitationRecordsQuery = useInfiniteQuery({
    queryKey: invitationRecordsKey(context),
    queryFn: ({ signal, pageParam }) => readInvitationRecords(context, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    enabled: section === 'invitations' && invitationRecordsEnabled,
    staleTime: 15_000,
  });
  const invitationPages = invitationRecordsQuery.data?.pages;
  const invitationRecords = useMemo(() => invitationPages?.flatMap((page) => page.items) ?? [], [invitationPages]);
  const roles = query.data?.roles.filter(isManagementRole) ?? [];
  const normalizedFilter = filter.trim().toLocaleLowerCase('zh-CN');
  const visibleRoles = useMemo(() => roles.filter((role) => normalizedFilter === '' || `${role.name} ${role.id} ${role.permissions.join(' ')}`.toLocaleLowerCase('zh-CN').includes(normalizedFilter)), [normalizedFilter, roles]);
  const defaultRole = visibleRoles.find(({ governance }) => !governance) ?? visibleRoles[0];
  const selectedRole = roles.find(({ id }) => id === (selectedId ?? requestedRoleId)) ?? defaultRole;
  const editorRecord = draftId === undefined ? (selectedRole === undefined ? undefined : toEditorRecord(selectedRole)) : newRoleDraft(draftId);
  const createRole = () => {
    const id = `role:${crypto.randomUUID()}`;
    setDraftId(id);
    setSelectedId(undefined);
    setNotice(undefined);
  };

  const refresh = async () => {
    setNotice(undefined);
    const result = await query.refetch();
    if (result.data === undefined) throw result.error ?? new Error('ACCESS_ROLE_REREAD_FAILED');
    return result.data;
  };

  return (
    <section className="roleaccessworkspace" aria-label="自定义身份与权限工作台">
      <WorkspaceHero
        className="roleaccesshero"
        title={section === 'invitations' ? '邀请管理' : '角色模板'}
        description={section === 'invitations' ? '管理当前范围内的管理员邀请与使用状态。' : '统一定义管理员职责、权限和管理范围。'}
        actions={
          <>
            <Button onPress={() => void navigate(scopePath(context.scope, 'settings/members'))}>返回管理员</Button>
            {section === 'roles' && canWrite ? (
              <Button tone="primary" onPress={createRole}>
                新建角色
              </Button>
            ) : null}
            {section === 'invitations' && invitationEnabled ? (
              <Button tone="primary" onPress={() => setInvitationOpen(true)}>
                邀请新成员
              </Button>
            ) : null}
          </>
        }
      />

      {section === 'invitations' ? (
        <InvitationRecordsPanel
          available={invitationEnabled}
          readable={invitationRecordsEnabled}
          records={invitationRecords}
          pending={invitationRecordsQuery.isPending}
          fetchingMore={invitationRecordsQuery.isFetchingNextPage}
          hasMore={invitationRecordsQuery.hasNextPage}
          error={invitationRecordsQuery.error}
          onInvite={() => setInvitationOpen(true)}
          onRetry={() => void invitationRecordsQuery.refetch()}
          onMore={() => void invitationRecordsQuery.fetchNextPage()}
        />
      ) : !canRead ? (
        <WorkspaceState tone="denied" title="无权读取身份目录" detail="当前会话没有 access.center.read 权限。" />
      ) : query.isPending && query.data === undefined ? (
        <WorkspaceState title="正在加载身份与权限目录…" detail="正在读取正式 access.center.read 契约。" />
      ) : query.error !== null && query.data === undefined ? (
        <WorkspaceState tone="danger" title={queryErrorTitle(query.error)} detail={safeQueryError(query.error) ?? 'REQUEST_FAILED'} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {notice === undefined ? null : (
            <p className="roleaccessnotice" role="status">
              {notice}
            </p>
          )}
          <MasterDetail
            className="roleaccessmasterdetail"
            masterLabel="身份列表"
            detailLabel="身份名称、功能权限、范围与成员"
            master={
              <RoleDirectory
                roles={visibleRoles}
                total={roles.length}
                selectedId={editorRecord?.id}
                draftId={draftId}
                filter={filter}
                onFilter={setFilter}
                onSelect={(id) => {
                  setDraftId(undefined);
                  setSelectedId(id);
                  setNotice(undefined);
                }}
              />
            }
            detail={
              editorRecord === undefined ? (
                <WorkspaceState title={roles.length === 0 ? '暂无自定义身份' : '没有匹配的身份'} detail={canWrite ? '可从左侧新建一个名称自由、权限为空的自定义身份。' : '当前会话只能读取身份目录。'} />
              ) : (
                <RoleEditor
                  key={`${editorRecord.id}:${editorRecord.version ?? 'draft'}`}
                  context={context}
                  role={editorRecord}
                  initialTab={requestedView}
                  members={query.data?.items ?? []}
                  onRefresh={refresh}
                  onEdit={() => setNotice(undefined)}
                  onNotice={setNotice}
                  onDeleted={() => {
                    setDraftId(undefined);
                    setSelectedId(undefined);
                  }}
                  onSaved={(saved, affected) => {
                    setDraftId(undefined);
                    setSelectedId(saved.id);
                    const versions = [...new Set(affected.map(({ access_version: version }) => `v${version}`))].join('、');
                    setNotice(
                      `“${saved.name}”已保存，并已通过正式接口重读核对名称、权限与版本 v${saved.version}${
                        affected.length === 0 ? '；当前无受影响成员。' : `；同时核对 ${affected.length} 位成员的身份、有效权限、范围与 Access Version ${versions}。`
                      }`
                    );
                  }}
                />
              )
            }
          />
        </>
      )}
      <MemberInvitationDialog
        context={context}
        open={invitationOpen}
        onClose={() => {
          setInvitationOpen(false);
          if (section === 'invitations' && invitationRecordsEnabled) void invitationRecordsQuery.refetch();
        }}
      />
    </section>
  );
}

function RoleDirectory({
  roles,
  total,
  selectedId,
  draftId,
  filter,
  onFilter,
  onSelect,
}: Readonly<{
  roles: readonly AccessRole[];
  total: number;
  selectedId?: string | undefined;
  draftId?: string | undefined;
  filter: string;
  onFilter: (value: string) => void;
  onSelect: (id: string) => void;
}>) {
  return (
    <div className="roledirectory">
      <header>
        <div>
          <h2>角色列表</h2>
          <p>共 {total} 个角色模板</p>
        </div>
      </header>
      <label className="roledirectorysearch">
        搜索角色
        <input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="搜索角色或权限" />
      </label>
      <div className="roledirectorylist">
        {draftId === undefined ? null : <MasterItem selected title="未保存的新角色" description="名称与权限均为本地草稿" meta="0 项权限" trailing={<Badge tone="warning">草稿</Badge>} />}
        {roles.map((role) => (
          <RoleItem key={role.id} role={role} selected={role.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function RoleItem({ role, selected, onSelect }: Readonly<{ role: AccessRole; selected: boolean; onSelect: (id: string) => void }>) {
  return (
    <MasterItem
      selected={selected}
      title={role.name}
      description={
        <span className="rolestatusline">
          <i />
          {role.status === 'active' ? '已启用' : '已停用'}
        </span>
      }
      meta={`${role.member_count} 位管理员`}
      leading={<RoleAvatar role={role} />}
      trailing={
        <span className="roleitemchevron" aria-hidden="true">
          ›
        </span>
      }
      onClick={() => onSelect(role.id)}
    />
  );
}

function RoleAvatar({ role }: Readonly<{ role: AccessRole }>) {
  const kind = /owner/i.test(role.name) ? 'owner' : /高级|senior/i.test(role.name) ? 'senior' : /财务|finance/i.test(role.name) ? 'finance' : /客服|support/i.test(role.name) ? 'support' : 'default';
  const paths =
    kind === 'owner'
      ? ['M5 9l3 3 4-7 4 7 3-3-1 9H6L5 9Z']
      : kind === 'senior'
        ? ['M12 3l2 3 4-.5.5 4L21 12l-2.5 2.5.5 4-4-.5-3 3-3-3-4 .5.5-4L3 12l2.5-2.5.5-4 4 .5 2-3Z']
        : kind === 'finance'
          ? ['M4 7h16v12H4z', 'M8 7V5h8v2', 'M8 12h8']
          : kind === 'support'
            ? ['M4 13v-2a8 8 0 0 1 16 0v2', 'M4 13v4h4v-5H4', 'M20 13v4h-4v-5h4', 'M16 18c-1 2-3 2-5 2']
            : ['M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7l7-4Z'];
  return (
    <span className="roleavatar" data-kind={kind} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}

function InvitationRecordsPanel({
  available,
  readable,
  records,
  pending,
  fetchingMore,
  hasMore,
  error,
  onInvite,
  onRetry,
  onMore,
}: Readonly<{
  available: boolean;
  readable: boolean;
  records: readonly InvitationRecord[];
  pending: boolean;
  fetchingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  onInvite: () => void;
  onRetry: () => void;
  onMore: () => void;
}>) {
  return (
    <Surface className="invitationrecordspanel" depth="low" padding="spacious" role="region" aria-labelledby="invitationrecordstitle">
      <header className="invitationrecordsheader">
        <div>
          <p>INVITATION RECORDS</p>
          <h2 id="invitationrecordstitle">邀请记录</h2>
          <span>查看当前管理范围内真实生成的管理员邀请。</span>
        </div>
        {available ? (
          <Button tone="primary" onPress={onInvite}>
            生成管理员邀请码
          </Button>
        ) : null}
      </header>
      {!readable ? (
        <InvitationRecordsState title="无权读取邀请记录" detail="当前身份没有邀请管理权限。" />
      ) : pending ? (
        <InvitationRecordsState title="正在加载邀请记录…" detail="正在读取正式 member.invitations.read 契约。" />
      ) : error !== null ? (
        <InvitationRecordsState title="邀请记录读取失败" detail={safeQueryError(error) ?? 'REQUEST_FAILED'} action="重试" onAction={onRetry} />
      ) : records.length === 0 ? (
        <InvitationRecordsState title="还没有邀请记录" detail="生成第一条管理员邀请后，记录会自动出现在这里。" />
      ) : (
        <>
          <div className="invitationrecordstablewrap">
            <table className="invitationrecordstable" aria-label={`邀请记录，共 ${records.length} 条`}>
              <thead>
                <tr>
                  <th scope="col">被邀请人</th>
                  <th scope="col">邀请人</th>
                  <th scope="col">管理员级别</th>
                  <th scope="col">状态</th>
                  <th scope="col">创建时间</th>
                  <th scope="col">接受时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <InvitationRecordRow key={record.id} record={record} />
                ))}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <Button onPress={onMore} isPending={fetchingMore}>
              加载更多
            </Button>
          ) : (
            <p className="invitationrecordsend">已显示全部记录</p>
          )}
        </>
      )}
    </Surface>
  );
}

function InvitationRecordRow({ record }: Readonly<{ record: InvitationRecord }>) {
  return (
    <tr>
      <td className="invitationrecordstarget">
        <strong>{invitationTarget(record)}</strong>
      </td>
      <td>{record.created_by_name ?? '历史记录，创建人不可还原'}</td>
      <td>{record.governance_level === 'senior_administrator' ? '高级管理员' : '普通管理员'}</td>
      <td>
        <Badge tone={invitationStatusTone(record.status)}>{invitationStatusLabel(record.status)}</Badge>
      </td>
      <td>{formatInvitationDate(record.created_at)}</td>
      <td>{record.accepted_at === null ? '—' : formatInvitationDate(record.accepted_at)}</td>
    </tr>
  );
}

function InvitationRecordsState({
  title,
  detail,
  action,
  onAction,
}: Readonly<{
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}>) {
  return (
    <div className="invitationrecordsstate" role="status">
      <strong>{title}</strong>
      <span>{detail}</span>
      {action === undefined || onAction === undefined ? null : <Button onPress={onAction}>{action}</Button>}
    </div>
  );
}

function invitationStatusLabel(status: InvitationRecord['status']): string {
  return { active: '未使用', used: '已使用', expired: '已过期', revoked: '已作废' }[status];
}

function invitationStatusTone(status: InvitationRecord['status']): 'success' | 'info' | 'warning' | 'danger' {
  return { active: 'success', used: 'info', expired: 'warning', revoked: 'danger' }[status] as 'success' | 'info' | 'warning' | 'danger';
}

function invitationTarget(record: InvitationRecord): string {
  if (record.invitee_name !== null && record.destination_masked !== null) return `${record.invitee_name} · ${record.destination_masked}`;
  return record.invitee_name ?? record.destination_masked ?? record.label;
}

function formatInvitationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
}

function WorkspaceState({
  title,
  detail,
  tone = 'default',
  onRetry,
}: Readonly<{
  title: string;
  detail: string;
  tone?: 'default' | 'danger' | 'denied';
  onRetry?: () => void;
}>) {
  return (
    <Surface className="roleaccessstate" data-tone={tone} depth="low" padding="spacious" role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <p>{detail}</p>
      {onRetry === undefined ? null : <Button onPress={onRetry}>重试</Button>}
    </Surface>
  );
}

function queryErrorTitle(error: Error): string {
  const status = Reflect.get(error, 'status');
  if (status === 403) return '无权读取身份目录';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return '网络不可用';
  return '身份目录读取失败';
}

function toEditorRecord(role: AccessRole): RoleEditorRecord {
  return { ...role, governance_level: role.governance_level ?? null, persisted: true };
}

function newRoleDraft(id: string): RoleEditorRecord {
  return { id, name: '', status: 'active', permissions: [], member_count: 0, governance: false,
    governance_level: null, editable: true, members: [], scopes: [], persisted: false };
}
