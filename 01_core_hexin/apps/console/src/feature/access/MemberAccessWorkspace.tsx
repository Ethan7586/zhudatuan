import { Empty, ResourceState, type ResourceCondition } from '@shop/design';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { MemberInvitationDialog } from '../member/MemberInvitationDialog';
import { memberInvitationAvailable } from '../member/MemberInvitationCommand';
import { belongsToMemberPartition, memberKey, readMembers } from '../member/MemberQuery';
import { MemberRegistrationResetDialog } from '../member/MemberRegistrationResetDialog';
import { isManagementRole } from './ManagementRole';
import type { Member } from '../member/MemberSchema';
import '../storefront-member/storefront-member.css';
import { ACCESS_QUERY_STALE_TIME_MS, accessKey, readAccess } from './AccessQuery';
import { offboardAdministrator, roleCommandAvailable, saveAccessRoleAssignment, verifyAccessRoleAssignment } from './AccessRoleCommand';
import type { AccessMembership, AccessRole } from './AccessSchema';
import { invitationRecordsAvailable, invitationRecordsKey, readInvitationRecords } from './InvitationRecordsQuery';
import type { InvitationRecord } from './InvitationRecordsSchema';
import './member-access-discord.css';

export type MemberAccessPrimary = 'access' | 'members';
type MemberDirectoryFilter = 'all' | 'senior' | 'administrator' | 'incomplete';
type MemberDetailTab = 'profile' | 'roles' | 'invitations';
type MemberIconName = 'chevron' | 'close' | 'expand' | 'member' | 'mobile' | 'refresh' | 'search' | 'shield';
type MemberRole = AccessMembership['roles'][number];

interface MemberAccessRow {
  readonly id: string;
  readonly member?: Member;
  readonly access?: AccessMembership;
  readonly administrator: boolean;
  readonly managementRoles: readonly MemberRole[];
}

export function MemberAccessWorkspace({ primary }: { readonly primary: MemberAccessPrimary }) {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState<MemberDirectoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member>();
  const cursor = search.get('cursor') ?? undefined;
  const canReadAccess = primary === 'access' || hasOperation(context, 'access.center.read');
  const canReadMembers = primary === 'members' || hasOperation(context, 'member.members.read');
  const accessCursor = primary === 'access' ? cursor : undefined;
  const memberCursor = primary === 'members' ? cursor : undefined;
  const memberQuery = useQuery({
    queryKey: memberKey(context, memberCursor),
    queryFn: ({ signal }) => readMembers(context, memberCursor, signal),
    enabled: canReadMembers,
    placeholderData: (previousData, previousQuery) =>
      belongsToMemberPartition(previousQuery?.queryKey, context) ? previousData : undefined,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const accessQuery = useQuery({
    queryKey: accessKey(context, accessCursor),
    queryFn: ({ signal }) => readAccess(context, accessCursor, signal),
    enabled: canReadAccess,
    placeholderData: keepPreviousData,
    staleTime: ACCESS_QUERY_STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const rows = useMemo(
    () => mergeRows(memberQuery.data?.items ?? [], accessQuery.data?.items ?? []),
    [accessQuery.data?.items, memberQuery.data?.items],
  );
  const invitationWritable = memberInvitationAvailable(context);
  const normalizedFilter = filter.trim().toLocaleLowerCase('zh-CN');
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (directoryFilter === 'senior' && !isSeniorAdministrator(row)) return false;
        if (directoryFilter === 'administrator' && isSeniorAdministrator(row)) return false;
        if (directoryFilter === 'incomplete' && row.member?.login_identity_bound === true) return false;
        return normalizedFilter === '' || rowSearchText(row).includes(normalizedFilter);
      }),
    [directoryFilter, normalizedFilter, rows]
  );
  const selected = rows.find((row) => row.id === selectedId);
  const detailOpen = selected !== undefined;
  const hasSourceData = memberQuery.data !== undefined || accessQuery.data !== undefined;
  const fatalError = hasSourceData ? undefined : safeQueryError(memberQuery.error) ?? safeQueryError(accessQuery.error);
  const memberRefreshError = memberQuery.data === undefined ? undefined : safeQueryError(memberQuery.error);
  const supplementalError = hasSourceData ? safeQueryError(accessQuery.error) : undefined;
  const fetching = memberQuery.isFetching || accessQuery.isFetching;
  const condition = resourceState(hasSourceData ? { items: rows } : undefined, fetching, fatalError);
  const resetAvailable = context.session.permissions.includes('identity.registration.reset') && context.session.capabilities.includes('identity.members.reset') && context.session.csrf !== undefined;
  const total = rows.length;
  const nextCursor = memberQuery.data?.nextCursor;

  useEffect(() => {
    if (!detailOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(undefined);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailOpen]);

  const refresh = () => {
    if (canReadAccess) void accessQuery.refetch();
    if (canReadMembers) void memberQuery.refetch();
  };
  const closeDetail = () => setSelectedId(undefined);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilter(draft.trim().slice(0, 100));
    closeDetail();
  };

  return (
    <>
      <section className="storefrontmembersworkspace memberaccessworkspace" aria-label="管理与权限">
        <div className="storefrontmemberstage" data-detail-open={detailOpen}>
          <section className="storefrontmemberpanel" aria-labelledby="memberdirectorytitle">
            <header className="storefrontmemberpanelheading">
              <div>
                <h2 id="memberdirectorytitle">管理员目录</h2>
                <span>{total}</span>
                <small>点击管理员查看资料、身份与权限及邀请记录</small>
              </div>
              <div className="storefrontmemberpanelactions memberaccessdirectoryactions">
                <button type="button" onClick={() => void navigate(scopePath(context.scope, 'settings/access'))}>
                  角色模板
                </button>
                {invitationWritable ? (
                  <button type="button" data-tone="primary" onClick={() => setInvitationOpen(true)}>
                    邀请管理员
                  </button>
                ) : null}
                <IconButton label={fetching ? '正在刷新成员名单' : '刷新成员名单'} icon="refresh" loading={fetching} onPress={refresh} />
                {detailOpen ? <IconButton label="全屏查看成员目录" icon="expand" onPress={closeDetail} /> : null}
              </div>
            </header>

            <form className="storefrontmembersearch" role="search" onSubmit={submitSearch}>
              <label htmlFor="memberaccessfilter">搜索管理员</label>
              <MemberIcon name="search" />
              <input id="memberaccessfilter" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="搜索姓名、角色或管理范围" />
              <button type="submit">搜索</button>
            </form>

            <div className="storefrontmemberfilters" aria-label="管理员筛选">
              <FilterButton
                active={directoryFilter === 'all'}
                onPress={() => {
                  setDirectoryFilter('all');
                  closeDetail();
                }}
              >
                {`全部管理员（${rows.length}）`}
              </FilterButton>
              <FilterButton
                active={directoryFilter === 'senior'}
                onPress={() => {
                  setDirectoryFilter('senior');
                  closeDetail();
                }}
              >
                Owner / 高级管理员
              </FilterButton>
              <FilterButton
                active={directoryFilter === 'administrator'}
                onPress={() => {
                  setDirectoryFilter('administrator');
                  closeDetail();
                }}
              >
                管理员
              </FilterButton>
              <FilterButton
                active={directoryFilter === 'incomplete'}
                onPress={() => {
                  setDirectoryFilter('incomplete');
                  closeDetail();
                }}
              >
                待补充
              </FilterButton>
            </div>

            {supplementalError === undefined ? null : (
              <div className="storefrontmemberdetailerror" role="status">
                <p>部分补充资料暂不可用：{supplementalError}</p>
              </div>
            )}

            <div className="storefrontmemberresource">
              {hasSourceData && visibleRows.length === 0 && fatalError === undefined ? (
                <Empty
                  title={rows.length === 0 && filter === '' && directoryFilter === 'all' ? '暂无管理员' : '未找到匹配管理员'}
                  description={rows.length === 0 ? '当前范围暂未返回管理员资料。' : '请调整姓名、角色、管理范围或筛选条件。'}
                />
              ) : (
                <ResourceState condition={condition} {...(fatalError === undefined ? {} : { error: fatalError })} retry={refresh} resourceLabel="管理员名单">
                  <MemberDirectory rows={visibleRows} selectedId={selectedId} onSelect={(row) => setSelectedId(row.id)} />
                </ResourceState>
              )}
            </div>

            <footer className="storefrontmemberpagination">
              <span>
                {memberRefreshError === undefined
                  ? `当前页 ${visibleRows.length} 位 · 共 ${total} 位管理员`
                  : '刷新失败，已保留已有会员名单'}
              </span>
              <button
                type="button"
                disabled={nextCursor === undefined || fetching}
                onClick={() => {
                  if (nextCursor === undefined) return;
                  closeDetail();
                  setSearch(pageCursor(search, nextCursor), { preventScrollReset: true });
                }}
              >
                {fetching ? '加载中…' : '下一页'}
              </button>
            </footer>
          </section>

          <MemberDetail
            row={selected}
            roleCatalog={accessQuery.data?.roles ?? []}
            open={detailOpen}
            context={context}
            resetAvailable={resetAvailable}
            onClose={closeDetail}
            onReset={setResetTarget}
            onRefresh={async () => {
              const [refreshedMembers, refreshedAccess] = await Promise.all([memberQuery.refetch(), accessQuery.refetch()]);
              if (refreshedMembers.data === undefined || refreshedAccess.data === undefined) throw new Error('ADMINISTRATOR_REREAD_FAILED');
              return { members: refreshedMembers.data.items, access: refreshedAccess.data.items, roles: refreshedAccess.data.roles };
            }}
            onRemoved={closeDetail}
            onManage={(roleId, view) => {
              const path = scopePath(context.scope, 'settings/access');
              const params = new URLSearchParams();
              if (roleId !== undefined) params.set('role', roleId);
              if (view !== undefined) params.set('view', view);
              void navigate(params.size === 0 ? path : `${path}?${params.toString()}`);
            }}
          />
        </div>
      </section>

      <MemberInvitationDialog context={context} open={invitationOpen} onClose={() => setInvitationOpen(false)} />
      <MemberRegistrationResetDialog context={context} target={resetTarget} onClose={() => setResetTarget(undefined)} onReset={() => void memberQuery.refetch()} onInvite={() => setInvitationOpen(true)} />
    </>
  );
}

function MemberDirectory({ rows, selectedId, onSelect }: Readonly<{ rows: readonly MemberAccessRow[]; selectedId: string | undefined; onSelect: (row: MemberAccessRow) => void }>) {
  return (
    <div className="storefrontmemberdirectory" role="table" aria-label="管理员目录">
      <div className="storefrontmemberlisthead" role="row">
        <span role="columnheader">管理员</span>
        <span role="columnheader">登录状态</span>
        <span role="columnheader">管理角色</span>
        <span className="memberaccessscopecol" role="columnheader">
          可管理范围
        </span>
        <span className="storefrontmemberstatuscol" role="columnheader">
          当前状态
        </span>
        <span role="columnheader">加入时间</span>
        <span aria-hidden="true" />
      </div>
      <div role="rowgroup">
        {rows.map((row) => {
          return (
            <button className="storefrontmemberrow" data-selected={selectedId === row.id} key={row.id} type="button" role="row" aria-label={`查看管理员 ${rowName(row)}`} aria-expanded={selectedId === row.id} onClick={() => onSelect(row)}>
              <span className="storefrontmemberperson" role="cell">
                <i>{rowName(row).slice(0, 1)}</i>
                <strong>{rowName(row)}</strong>
                <small>{row.member?.mobile ?? row.member?.mobile_masked ?? '管理员身份'}</small>
              </span>
              <BindingState bound={row.member?.login_identity_bound} trueLabel="已绑定" falseLabel="未绑定" unknownLabel="待补充" />
              <span className="memberaccessrole" data-administrator={isAdministrator(row)} role="cell">
                {administratorLabel(row)}
              </span>
              <span className="memberaccessscopecol" role="cell">
                {managementScopeLabel(row)}
              </span>
              <span className="storefrontmemberstatuscol" role="cell">
                <StatusState status={rowStatus(row)} />
              </span>
              <time role="cell" dateTime={row.member?.joined_at ?? undefined}>
                {formatDate(row.member?.joined_at ?? null)}
              </time>
              <span className="memberaccesschevron" aria-hidden="true">
                <MemberIcon name="chevron" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MemberDetail({
  row,
  roleCatalog,
  open,
  context,
  resetAvailable,
  onClose,
  onReset,
  onRefresh,
  onRemoved,
  onManage,
}: Readonly<{
  row: MemberAccessRow | undefined;
  roleCatalog: readonly AccessRole[];
  open: boolean;
  context: ConsoleContext;
  resetAvailable: boolean;
  onClose: () => void;
  onReset: (member: Member) => void;
  onRefresh: () => Promise<Readonly<{ members: readonly Member[]; access: readonly AccessMembership[]; roles: readonly AccessRole[] }>>;
  onRemoved: () => void;
  onManage: (roleId?: string, view?: 'permissions' | 'members') => void;
}>) {
  const detailRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<MemberDetailTab>('profile');
  const [offboardArmed, setOffboardArmed] = useState(false);
  useEffect(() => {
    if (open) detailRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    setTab('profile');
    setOffboardArmed(false);
  }, [row?.id]);
  const administrator = row === undefined ? false : isAdministrator(row);
  const roles = row?.managementRoles ?? [];
  const scopes = row?.access?.scopes ?? [];
  const allowScopes = scopes.filter((scope) => scope.effect === 'allow');
  const denyScopes = scopes.filter((scope) => scope.effect === 'deny');
  const invitationReadable = invitationRecordsAvailable(context);
  const invitationQuery = useInfiniteQuery({
    queryKey: invitationRecordsKey(context),
    queryFn: ({ signal, pageParam }) => readInvitationRecords(context, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    enabled: open && administrator && tab === 'invitations' && invitationReadable,
    staleTime: ACCESS_QUERY_STALE_TIME_MS,
  });
  const invitationRecords = useMemo(
    () => invitationQuery.data?.pages.flatMap((page) => page.items).filter((record) => record.created_by === row?.id || record.created_by === row?.access?.id) ?? [],
    [invitationQuery.data?.pages, row?.access?.id, row?.id]
  );
  const version = row?.access?.access_version ?? row?.member?.access_version;
  const canReset = resetAvailable && row?.member?.reset_allowed === true;
  const seniorAssignment = roles.find((role) => /高级|senior/i.test(`${role.role} ${role.name}`));
  const seniorRole = roleCatalog.find((role) => role.governance_level === 'senior_administrator');
  const seniorScope = seniorRole === undefined ? undefined : seniorAdministratorScope(context, seniorRole);
  const canManageAdministrator = row !== undefined && context.session.governance?.level === 'owner'
    && roleCommandAvailable(context) && !isOwner(row) && !isSelf(row, context);
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      if (row?.access === undefined || seniorRole === undefined || seniorScope === undefined) {
        throw new Error('SENIOR_ADMINISTRATOR_ASSIGNMENT_NOT_AVAILABLE');
      }
      const draft = { action: 'assign' as const, role: seniorRole.id, membership: row.access.id,
        scope: seniorScope, scopeSource: 'direct' as const, accessVersion: row.access.access_version };
      const receipt = await saveAccessRoleAssignment(context, draft);
      const reread = await onRefresh();
      verifyAccessRoleAssignment(draft, receipt, row.access, reread.roles, reread.access);
      return receipt;
    },
  });
  const demoteMutation = useMutation({
    mutationFn: async () => {
      if (row?.access === undefined || seniorAssignment === undefined) throw new Error('SENIOR_ADMINISTRATOR_ASSIGNMENT_NOT_FOUND');
      const draft = { action: 'revoke' as const, role: seniorAssignment.role, membership: row.access.id,
        scope: seniorAssignment.scope, scopeSource: seniorAssignment.scope_source === 'inherited' ? 'inherited' as const : 'direct' as const,
        accessVersion: row.access.access_version };
      const receipt = await saveAccessRoleAssignment(context, draft);
      const reread = await onRefresh();
      verifyAccessRoleAssignment(draft, receipt, row.access, reread.roles, reread.access);
      return receipt;
    },
  });
  const offboardMutation = useMutation({
    mutationFn: async () => {
      if (row?.access === undefined) throw new Error('ADMINISTRATOR_ACCESS_RECORD_NOT_FOUND');
      const receipt = await offboardAdministrator(context, row.access.id, row.access.access_version);
      const reread = await onRefresh();
      if (reread.members.some((member) => member.membership_id === row.id)
        || reread.access.some((membership) => membership.id === row.id)) throw new Error('ADMINISTRATOR_OFFBOARD_VERIFICATION_FAILED');
      return receipt;
    },
    onSuccess: onRemoved,
  });
  const actionPending = upgradeMutation.isPending || demoteMutation.isPending || offboardMutation.isPending;
  const actionError = safeQueryError(upgradeMutation.error ?? demoteMutation.error ?? offboardMutation.error);
  return (
    <aside ref={detailRef} className="storefrontmemberdetail" aria-hidden={!open} aria-label={administrator ? '管理员详情' : '成员详情'} tabIndex={-1}>
      <header className="storefrontmemberpanelheading">
        <div>
          <h2>{administrator ? '管理员详情' : '成员详情'}</h2>
          <span data-tone="purple">{administrator ? '管理身份' : '普通会员'}</span>
        </div>
        <IconButton label="关闭成员详情" icon="close" onPress={onClose} tabIndex={open ? 0 : -1} />
      </header>
      {row === undefined ? null : (
        <div className="storefrontmemberdetailbody">
          <section className="storefrontmemberidentitycard">
            <i>{rowName(row).slice(0, 1)}</i>
            <div>
              <h3>{rowName(row)}</h3>
              <p>{memberAccountLabel(row)}</p>
            </div>
            <StatusState status={rowStatus(row)} />
          </section>
          <div className="storefrontmembertags" aria-label="成员标签">
            <span>{administrator ? administratorLabel(row) : '普通会员'}</span>
            <span data-tone={rowStatus(row) === 'active' ? 'success' : 'muted'}>{statusLabel(rowStatus(row))}</span>
            {row.member?.login_identity_bound ? <span data-tone="success">登录已绑定</span> : null}
            {isOwner(row) ? <span data-tone="purple">Owner</span> : null}
            {isSelf(row, context) ? <span data-tone="purple">本人</span> : null}
          </div>
          {administrator ? (
            <>
              <nav className="storefrontmemberdetailtabs" aria-label="管理员档案">
                <DetailTab selected={tab === 'profile'} onPress={() => setTab('profile')}>
                  基本资料
                </DetailTab>
                <DetailTab selected={tab === 'roles'} onPress={() => setTab('roles')}>
                  身份与权限
                </DetailTab>
                <DetailTab selected={tab === 'invitations'} onPress={() => setTab('invitations')}>
                  邀请记录
                </DetailTab>
              </nav>
              <div className="storefrontmembertabcontent" key={tab}>
                {tab === 'profile' ? <ProfileTab row={row} version={version} /> : null}
                {tab === 'roles' ? <RolesTab row={row} roles={roles} scopes={allowScopes} denyCount={denyScopes.length} onManage={onManage} /> : null}
                {tab === 'invitations' ? (
                  <MemberInvitationRecordsTab
                    readable={invitationReadable}
                    records={invitationRecords}
                    pending={invitationQuery.isPending}
                    error={invitationQuery.error}
                    fetchingMore={invitationQuery.isFetchingNextPage}
                    hasMore={invitationQuery.hasNextPage}
                    onRetry={() => void invitationQuery.refetch()}
                    onMore={() => void invitationQuery.fetchNextPage()}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <>
              <ProfileTab row={row} version={version} />
              <section className="memberaccessordinary">
                <strong>非管理员</strong>
                <p>该成员当前没有管理员身份，不会获得后台管理能力。</p>
                <button type="button" onClick={() => onManage()}>
                  授予管理权限
                </button>
              </section>
            </>
          )}
          {canReset && row.member !== undefined ? (
            <footer className="storefrontmemberdetailpagination">
              <button type="button" onClick={() => onReset(row.member as Member)}>
                重置注册身份
              </button>
            </footer>
          ) : null}
          {canManageAdministrator ? (
            <footer className="memberaccessdetailactions" aria-label="管理员级别与状态">
              {seniorAssignment === undefined && seniorRole !== undefined && seniorScope !== undefined ? (
                <button type="button" disabled={actionPending} onClick={() => {
                  setOffboardArmed(false);
                  demoteMutation.reset();
                  offboardMutation.reset();
                  upgradeMutation.mutate();
                }}>{upgradeMutation.isPending ? '正在升级并核对…' : '升级为高级管理员'}</button>
              ) : null}
              {seniorAssignment === undefined ? null : (
                <button type="button" disabled={actionPending} onClick={() => {
                  setOffboardArmed(false);
                  upgradeMutation.reset();
                  offboardMutation.reset();
                  demoteMutation.mutate();
                }}>{demoteMutation.isPending ? '正在降级并核对…' : '降级为普通管理员'}</button>
              )}
              <button type="button" data-tone="danger" disabled={actionPending} onClick={() => {
                upgradeMutation.reset();
                demoteMutation.reset();
                offboardMutation.reset();
                if (offboardArmed) offboardMutation.mutate();
                else setOffboardArmed(true);
              }}>{offboardMutation.isPending ? '正在移除并核对…' : offboardArmed ? '确认移除管理员' : '删除管理员'}</button>
            </footer>
          ) : null}
          {offboardArmed && !offboardMutation.isPending ? <div className="storefrontmemberemptyline">只移除管理身份；商城 L 等级、订单与会员关系不会改变。再次点击确认。</div> : null}
          {actionError === undefined ? null : <div className="storefrontmemberdetailerror" role="alert"><p>{actionError}</p></div>}
          {row.member?.reset_block_reason === null || row.member?.reset_block_reason === undefined ? null : <div className="storefrontmemberemptyline">注册重置限制：{row.member.reset_block_reason}</div>}
          <p className="storefrontmembernotice">成员与授权关系来自当前范围真实数据，管理操作按当前权限开放</p>
        </div>
      )}
    </aside>
  );
}

function ProfileTab({ row, version }: Readonly<{ row: MemberAccessRow; version: string | number | undefined }>) {
  return (
    <section className="storefrontmemberdetailsection">
      <header>
        <h3>基本资料</h3>
        <span>真实成员档案</span>
      </header>
      <dl className="storefrontmemberfacts">
        <Fact label="管理员手机号" value={row.member?.mobile ?? row.member?.mobile_masked ?? '未绑定'} />
        <Fact label="员工号" value={row.member?.employee_no ?? '未设置'} />
        <Fact label="身份端" value={clientLabel(row.member?.client)} />
        <Fact label="登录身份" value={row.member === undefined ? '待补充' : row.member.login_identity_bound ? '已绑定' : '未绑定'} tone={row.member?.login_identity_bound ? 'success' : 'muted'} />
        <Fact label="档案状态" value={row.member?.status ?? '待补充'} />
        <Fact label="成员状态" value={statusLabel(rowStatus(row))} tone={rowStatus(row) === 'active' ? 'success' : 'muted'} />
        <Fact label="权限版本" value={version === undefined ? '待补充' : `v${version}`} />
        <Fact label="治理邀请人" value={row.member?.governance_parent_name ?? (isOwner(row) ? '治理根节点' : '未记录')} />
        <Fact label="加入时间" value={formatDate(row.member?.joined_at ?? null)} />
      </dl>
    </section>
  );
}

type MemberScope = NonNullable<MemberAccessRow['access']>['scopes'][number];

function RolesTab({ row, roles, scopes, denyCount, onManage }: Readonly<{ row: MemberAccessRow; roles: readonly MemberRole[]; scopes: readonly MemberScope[]; denyCount: number; onManage: (roleId?: string, view?: 'permissions' | 'members') => void }>) {
  const primaryRoleId = roles[0]?.role;
  return (
    <>
      <section className="storefrontmemberorderoverview">
        <div>
          <span>管理身份</span>
          <strong>{roles.length}</strong>
        </div>
        <div>
          <span>当前有效权限</span>
          <strong>{row.access?.effective_permissions.length ?? 0}</strong>
        </div>
      </section>
      <section className="storefrontmemberdetailsection">
        <header>
          <h3>已分配身份</h3>
          <span>{denyCount > 0 ? `${denyCount} 项明确禁止` : '无明确禁止'}</span>
        </header>
        {roles.length === 0 ? (
          <div className="storefrontmemberemptyline">该成员尚未分配管理身份</div>
        ) : (
          <div className="storefrontmemberrelationlist">
            {roles.map((role) => (
              <article key={`${role.role}:${role.scope.kind}:${role.scope.id}`}>
                <i>{role.name.slice(0, 1)}</i>
                <div>
                  <strong>{role.name}</strong>
                  <span>{scopeKindLabel(role.scope.kind)}范围</span>
                </div>
                <time>{role.expires === null ? '长期有效' : formatDate(role.expires)}</time>
                <span>{role.scope_source === 'inherited' ? '继承' : '直接'}</span>
              </article>
            ))}
          </div>
        )}
      </section>
      <ScopesTab scopes={scopes} denyCount={denyCount} />
      <footer className="memberaccessdetailactions">
        <button type="button" onClick={() => onManage(primaryRoleId, 'permissions')}>
          查看角色权限
        </button>
        <button type="button" data-tone="primary" onClick={() => onManage(primaryRoleId, 'members')}>
          选择与调度角色
        </button>
      </footer>
    </>
  );
}

function MemberInvitationRecordsTab({
  readable,
  records,
  pending,
  error,
  fetchingMore,
  hasMore,
  onRetry,
  onMore,
}: Readonly<{
  readable: boolean;
  records: readonly InvitationRecord[];
  pending: boolean;
  error: Error | null;
  fetchingMore: boolean;
  hasMore: boolean;
  onRetry: () => void;
  onMore: () => void;
}>) {
  if (!readable) return <div className="storefrontmemberemptyline">当前身份无权读取该管理员的邀请记录</div>;
  if (pending) return <div className="storefrontmemberdetailloading">正在读取邀请记录…</div>;
  if (error !== null)
    return (
      <div className="storefrontmemberdetailerror">
        <p>{safeQueryError(error) ?? 'REQUEST_FAILED'}</p>
        <button type="button" onClick={onRetry}>
          重试
        </button>
      </div>
    );
  if (records.length === 0)
    return (
      <div className="storefrontmemberemptyline">
        当前已读取记录中没有该管理员发出的邀请
        {hasMore ? (
          <>
            <br />
            <button type="button" disabled={fetchingMore} onClick={onMore}>
              {fetchingMore ? '加载中…' : '继续查找更早记录'}
            </button>
          </>
        ) : null}
      </div>
    );
  return (
    <section className="storefrontmemberdetailsection">
      <header>
        <h3>邀请记录</h3>
        <span>{records.length} 条</span>
      </header>
      <div className="storefrontmemberrelationlist">
        {records.map((record) => (
          <article key={record.id}>
            <i>{(record.invitee_name ?? record.label).slice(0, 1)}</i>
            <div>
              <strong>{record.invitee_name ?? record.label}</strong>
              <span>{record.destination_masked ?? record.scope_name}</span>
            </div>
            <time>{formatDate(record.created_at)}</time>
            <span>{invitationStatusLabel(record.status)}</span>
          </article>
        ))}
      </div>
      {hasMore ? (
        <footer className="storefrontmemberdetailpagination">
          <button type="button" disabled={fetchingMore} onClick={onMore}>
            {fetchingMore ? '加载中…' : '加载更多'}
          </button>
        </footer>
      ) : null}
    </section>
  );
}

function ScopesTab({ scopes, denyCount }: Readonly<{ scopes: readonly MemberScope[]; denyCount: number }>) {
  return (
    <section className="storefrontmemberdetailsection">
      <header>
        <h3>当前管理范围</h3>
        <span>{denyCount > 0 ? `${denyCount} 项明确禁止优先` : '按身份授权生效'}</span>
      </header>
      {scopes.length === 0 ? (
        <div className="storefrontmemberemptyline">当前没有返回允许范围</div>
      ) : (
        <div className="storefrontmemberrelationlist">
          {scopes.map((scope) => (
            <article key={scope.id}>
              <i>{scopeKindLabel(scope.kind).slice(0, 1)}</i>
              <div>
                <strong>{scopeKindLabel(scope.kind)}</strong>
                <span>当前授权范围</span>
              </div>
              <time>{scope.expires === null ? '长期有效' : formatDate(scope.expires)}</time>
              <span>允许</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailTab({ selected, children, onPress }: Readonly<{ selected: boolean; children: string; onPress: () => void }>) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onPress}>
      {children}
    </button>
  );
}
function Fact({ label, value, tone }: Readonly<{ label: string; value: string; tone?: 'muted' | 'success' }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-tone={tone}>
        {tone !== undefined ? <i /> : null}
        {value}
      </dd>
    </div>
  );
}
function BindingState({ bound, trueLabel, falseLabel, unknownLabel = falseLabel }: Readonly<{ bound: boolean | undefined; trueLabel: string; falseLabel: string; unknownLabel?: string }>) {
  const label = bound === undefined ? unknownLabel : bound ? trueLabel : falseLabel;
  return (
    <span className="storefrontmemberbinding" data-bound={bound === true} role="cell" aria-label={label}>
      <i />
      {label}
    </span>
  );
}
function StatusState({ status }: Readonly<{ status: string }>) {
  return (
    <span className="storefrontmemberstatus" data-status={status}>
      <i />
      {statusLabel(status)}
    </span>
  );
}
function FilterButton({ active, children, onPress }: Readonly<{ active: boolean; children: string; onPress: () => void }>) {
  return (
    <button type="button" aria-pressed={active} onClick={onPress}>
      {children}
    </button>
  );
}
function IconButton({ label, icon, loading = false, onPress, tabIndex = 0 }: Readonly<{ label: string; icon: MemberIconName; loading?: boolean; onPress: () => void; tabIndex?: number }>) {
  return (
    <button className="storefrontmembericonbutton" data-loading={loading} type="button" aria-label={label} title={label} tabIndex={tabIndex} onClick={onPress}>
      <span>
        <MemberIcon name={icon} />
      </span>
    </button>
  );
}

const iconPaths: Readonly<Record<MemberIconName, readonly string[]>> = Object.freeze({
  chevron: ['m9 18 6-6-6-6'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  expand: ['M9 4H4v5', 'M15 4h5v5', 'M20 15v5h-5', 'M4 15v5h5'],
  member: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M4 22a8 8 0 0 1 16 0'],
  mobile: ['M7 2h10v20H7z', 'M10 18h4'],
  refresh: ['M20 11a8 8 0 1 0-2.34 5.66', 'M20 4v7h-7'],
  search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z', 'm17 17 4 4'],
  shield: ['M12 3 5 6v5c0 4.5 2.8 7.7 7 10 4.2-2.3 7-5.5 7-10V6l-7-3Z', 'M9 12l2 2 4-5'],
});
function MemberIcon({ name }: Readonly<{ name: MemberIconName }>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function mergeRows(members: readonly Member[], access: readonly AccessMembership[]): readonly MemberAccessRow[] {
  const accessById = new Map(access.map((membership) => [membership.id, membership]));
  return members.filter((member) => member.client === 'operator').map((member) => {
    const id = member.membership_id;
    const membership = accessById.get(id);
    const managementRoles = membership === undefined ? [] : managementRolesOf(membership);
    return { id, administrator: true, managementRoles, member, ...(membership === undefined ? {} : { access: membership }) };
  });
}
function seniorAdministratorScope(context: ConsoleContext, role: AccessRole): ConsoleScope | undefined {
  const organization = context.session.governance?.organization;
  return [context.scope, ...context.scopes, ...role.scopes.map(({ scope }) => scope)]
    .find((scope) => scope.kind === 'tenant' && scope.id === organization);
}
function managementRolesOf(membership: AccessMembership): readonly MemberRole[] {
  return membership.roles.filter(isManagementRole);
}
function hasOperation(context: ConsoleContext, operation: string): boolean {
  return context.session.capabilities.includes(operation) || context.session.permissions.includes(operation);
}
function rowSearchText(row: MemberAccessRow): string {
  return [rowName(row), row.member?.mobile, row.member?.mobile_masked, row.member?.employee_no,
    clientLabel(row.member?.client), ...row.managementRoles.map((role) => role.name)]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('zh-CN');
}
function rowName(row: MemberAccessRow): string {
  return row.member?.display_name ?? row.access?.display_name ?? '未命名成员';
}
function rowStatus(row: MemberAccessRow): string {
  return row.member?.membership_status ?? row.access?.status ?? row.member?.status ?? 'unknown';
}
function isAdministrator(row: MemberAccessRow): boolean {
  return row.administrator;
}
function isOwner(row: MemberAccessRow): boolean {
  return row.managementRoles.some((role) => /owner/i.test(`${role.role} ${role.name}`));
}
function isSeniorAdministrator(row: MemberAccessRow): boolean {
  return row.managementRoles.some((role) => /owner|高级|senior/i.test(`${role.role} ${role.name}`));
}
function isSelf(row: MemberAccessRow, context: ConsoleContext): boolean {
  return row.id === context.session.membership || row.member?.membership_id === context.session.membership;
}
function administratorLabel(row: MemberAccessRow): string {
  if (!isAdministrator(row)) return '非管理员';
  if (isOwner(row)) return 'Owner';
  return row.managementRoles[0]?.name ?? '管理员';
}
function managementScopeLabel(row: MemberAccessRow): string {
  if (!isAdministrator(row)) return '—';
  const scope = row.managementRoles[0]?.scope;
  if (scope === undefined) return '待配置';
  const name = scope.name ?? scopeKindLabel(scope.kind);
  return row.managementRoles.length > 1 ? `${name} 等 ${row.managementRoles.length} 个` : name;
}
function memberAccountLabel(row: MemberAccessRow): string {
  if (row.member?.employee_no !== null && row.member?.employee_no !== undefined) return row.member.employee_no;
  if (row.member?.login_identity_bound === true) return '登录已绑定';
  if (row.member?.login_identity_bound === false) return '登录未绑定';
  return '账号待补充';
}
function clientLabel(client?: Member['client']): string {
  return client === 'operator' ? '管理端' : client === 'storefront' ? '消费者' : client === 'store' ? '门店端' : client === 'supplier' ? '供应商端' : '成员';
}
function scopeKindLabel(kind: string): string {
  return ({ platform: '平台', tenant: '商户', distributor: '分销', enterprise: '集团', mall: '商城', supplier: '供应商', brand: '品牌', store: '门店', department: '部门', self: '本人' } as Record<string, string>)[kind] ?? '当前范围';
}
function invitationStatusLabel(status: InvitationRecord['status']): string {
  return ({ active: '未使用', used: '已使用', expired: '已过期', revoked: '已作废' } as const)[status];
}
function statusLabel(status: string): string {
  return ({ active: '有效', invited: '待激活', suspended: '已暂停', offboarded: '已移除', expired: '已过期', left: '已离开', unknown: '待补充' } as Record<string, string>)[status] ?? status;
}
function resourceState(data: unknown, fetching: boolean, error?: string): ResourceCondition {
  if (error !== undefined) return data === undefined ? 'failure' : 'stale';
  if (data === undefined) return 'loading';
  const page = data as Readonly<{ items: readonly unknown[] }>;
  if (page.items.length === 0) return 'empty';
  return fetching ? 'refreshing' : 'ready';
}
