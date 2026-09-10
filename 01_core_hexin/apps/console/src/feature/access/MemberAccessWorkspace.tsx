import { Empty, ResourceState, type ResourceCondition } from '@shop/design';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopeDisplayName } from '../../entity/session/ScopePresentation';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { MemberInvitationDialog } from '../member/MemberInvitationDialog';
import { memberInvitationAvailable } from '../member/MemberInvitationCommand';
import { memberKey, readMembers } from '../member/MemberQuery';
import { MemberRegistrationResetDialog } from '../member/MemberRegistrationResetDialog';
import type { Member } from '../member/MemberSchema';
import '../storefront-member/storefront-member.css';
import { ACCESS_QUERY_STALE_TIME_MS, accessKey, readAccess } from './AccessQuery';
import type { AccessMembership } from './AccessSchema';

export type MemberAccessPrimary = 'access' | 'members';
type MemberDirectoryFilter = 'all' | 'assigned' | 'unassigned';
type MemberDetailTab = 'profile' | 'roles' | 'scopes';
type MemberIconName = 'close' | 'expand' | 'member' | 'mobile' | 'refresh' | 'search' | 'shield';

interface MemberAccessRow {
  readonly id: string;
  readonly member?: Member;
  readonly access?: AccessMembership;
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
  const accessQuery = useQuery({
    queryKey: accessKey(context, accessCursor),
    queryFn: ({ signal }) => readAccess(context, accessCursor, signal),
    enabled: canReadAccess,
    placeholderData: keepPreviousData,
    staleTime: ACCESS_QUERY_STALE_TIME_MS,
  });
  const memberQuery = useQuery({
    queryKey: memberKey(context, memberCursor),
    queryFn: ({ signal }) => readMembers(context, memberCursor, signal),
    enabled: canReadMembers,
    placeholderData: keepPreviousData,
  });
  const accessItems = accessQuery.data?.items ?? [];
  const memberItems = memberQuery.data?.items ?? [];
  const rows = useMemo(() => mergeRows(memberItems, accessItems), [accessItems, memberItems]);
  const normalizedFilter = filter.trim().toLocaleLowerCase('zh-CN');
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (directoryFilter === 'assigned' && (row.access?.roles.length ?? 0) === 0) return false;
    if (directoryFilter === 'unassigned' && (row.access?.roles.length ?? 0) > 0) return false;
    return normalizedFilter === '' || rowSearchText(row).includes(normalizedFilter);
  }), [directoryFilter, normalizedFilter, rows]);
  const selected = rows.find((row) => row.id === selectedId);
  const detailOpen = selected !== undefined;
  const hasSourceData = memberQuery.data !== undefined || accessQuery.data !== undefined;
  const primaryError = safeQueryError(primary === 'access' ? accessQuery.error : memberQuery.error);
  const secondaryError = safeQueryError(primary === 'access' ? memberQuery.error : accessQuery.error);
  const fatalError = hasSourceData ? undefined : primaryError ?? secondaryError;
  const supplementalError = hasSourceData ? primaryError ?? secondaryError : undefined;
  const fetching = memberQuery.isFetching || accessQuery.isFetching;
  const condition = resourceState(hasSourceData ? { items: rows } : undefined, fetching, fatalError);
  const invitationEnabled = memberInvitationAvailable(context);
  const resetAvailable = context.session.permissions.includes('identity.registration.reset')
    && context.session.capabilities.includes('identity.members.reset')
    && context.session.csrf !== undefined;
  const activeCount = rows.filter((row) => rowStatus(row) === 'active').length;
  const assignedCount = rows.filter((row) => (row.access?.roles.length ?? 0) > 0).length;
  const loginBoundCount = rows.filter((row) => row.member?.login_identity_bound === true).length;
  const total = Math.max(rows.length, memberQuery.data?.count ?? 0, accessQuery.data?.count ?? 0);
  const nextCursor = primary === 'access' ? accessQuery.data?.nextCursor : memberQuery.data?.nextCursor;
  const currentScope = scopeDisplayName(context.scope);

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
      <section className="storefrontmembersworkspace" aria-labelledby="memberaccessworkspacetitle">
        <header className="storefrontmemberhero">
          <div>
            <h1 id="memberaccessworkspacetitle">成员</h1>
            <p>查看当前管理范围内的全部成员、身份与授权状态</p>
            <ManagementTabs current="members" onNavigate={(path) => void navigate(path)} context={context} />
          </div>
          <div className="storefrontmemberherometa">
            <span>当前范围 <strong>{currentScope}</strong></span>
            <em>管理名单</em>
          </div>
        </header>

        <MemberOverview total={total} active={activeCount} assigned={assignedCount} loginBound={loginBoundCount} />

        <div className="storefrontmemberstage" data-detail-open={detailOpen}>
          <section className="storefrontmemberpanel" aria-labelledby="memberdirectorytitle">
            <header className="storefrontmemberpanelheading">
              <div><h2 id="memberdirectorytitle">成员目录</h2><span>{total}</span></div>
              <div className="storefrontmemberpanelactions">
                {invitationEnabled ? <IconButton label="生成管理员邀请码" icon="shield" onPress={() => setInvitationOpen(true)} /> : null}
                <IconButton label={fetching ? '正在刷新成员名单' : '刷新成员名单'} icon="refresh" loading={fetching} onPress={refresh} />
                {detailOpen ? <IconButton label="全屏查看成员目录" icon="expand" onPress={closeDetail} /> : null}
              </div>
            </header>

            <form className="storefrontmembersearch" role="search" onSubmit={submitSearch}>
              <label htmlFor="memberaccessfilter">搜索成员</label>
              <MemberIcon name="search" />
              <input id="memberaccessfilter" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="搜索姓名、员工号或管理身份" />
              <button type="submit">搜索</button>
            </form>

            <div className="storefrontmemberfilters" aria-label="成员筛选">
              <FilterButton active={directoryFilter === 'all'} onPress={() => { setDirectoryFilter('all'); closeDetail(); }}>全部成员</FilterButton>
              <FilterButton active={directoryFilter === 'assigned'} onPress={() => { setDirectoryFilter('assigned'); closeDetail(); }}>已有管理身份</FilterButton>
              <FilterButton active={directoryFilter === 'unassigned'} onPress={() => { setDirectoryFilter('unassigned'); closeDetail(); }}>未分配身份</FilterButton>
            </div>

            {supplementalError === undefined ? null : <div className="storefrontmemberdetailerror" role="status"><p>部分补充资料暂不可用：{supplementalError}</p></div>}

            <div className="storefrontmemberresource">
              {hasSourceData && visibleRows.length === 0 && fatalError === undefined ? (
                <Empty
                  title={rows.length === 0 && filter === '' && directoryFilter === 'all' ? '暂无成员' : '未找到匹配成员'}
                  description={rows.length === 0 ? '当前范围暂未返回成员资料。' : '请调整姓名、员工号、管理身份或筛选条件。'}
                />
              ) : (
                <ResourceState condition={condition} {...(fatalError === undefined ? {} : { error: fatalError })} retry={refresh} resourceLabel="成员名单">
                  <MemberDirectory rows={visibleRows} selectedId={selectedId} onSelect={(row) => setSelectedId(row.id)} />
                </ResourceState>
              )}
            </div>

            <footer className="storefrontmemberpagination">
              <span>当前页 {visibleRows.length} 位 · 共 {total} 位成员</span>
              <button type="button" disabled={nextCursor === undefined || fetching} onClick={() => {
                if (nextCursor === undefined) return;
                closeDetail();
                setSearch(pageCursor(search, nextCursor), { preventScrollReset: true });
              }}>{fetching ? '加载中…' : '下一页'}</button>
            </footer>
          </section>

          <MemberDetail row={selected} open={detailOpen} context={context} resetAvailable={resetAvailable} onClose={closeDetail} onReset={setResetTarget} />
        </div>
      </section>

      <MemberInvitationDialog context={context} open={invitationOpen} onClose={() => setInvitationOpen(false)} />
      <MemberRegistrationResetDialog context={context} target={resetTarget} onClose={() => setResetTarget(undefined)} onReset={() => void memberQuery.refetch()} onInvite={() => setInvitationOpen(true)} />
    </>
  );
}

function ManagementTabs({ current, context, onNavigate }: Readonly<{
  current: 'members' | 'roles' | 'invitations';
  context: ConsoleContext;
  onNavigate: (path: string) => void;
}>) {
  const tabs = [
    { id: 'members', label: '成员', path: scopePath(context.scope, 'settings/members') },
    { id: 'roles', label: '身份与权限', path: scopePath(context.scope, 'settings/access') },
    { id: 'invitations', label: '邀请记录', path: `${scopePath(context.scope, 'settings/access')}?section=invitations` },
  ] as const;
  return <nav className="storefrontmemberdetailtabs" aria-label="管理与权限工作台">
    {tabs.map((tab) => <button key={tab.id} type="button" aria-selected={current === tab.id} onClick={() => onNavigate(tab.path)}>{tab.label}</button>)}
  </nav>;
}

function MemberOverview({ total, active, assigned, loginBound }: Readonly<{ total: number; active: number; assigned: number; loginBound: number }>) {
  return <div className="storefrontmemberoverview" aria-label="当前成员概览">
    <OverviewItem icon="member" label="成员总数" value={total} />
    <OverviewItem icon="member" label="本页有效" value={active} />
    <OverviewItem icon="shield" label="本页已有管理身份" value={assigned} tone="purple" />
    <OverviewItem icon="mobile" label="本页登录已绑定" value={loginBound} tone="success" />
  </div>;
}

function OverviewItem({ icon, label, value, tone = 'blue' }: Readonly<{ icon: MemberIconName; label: string; value: number; tone?: 'blue' | 'purple' | 'success' }>) {
  return <article className="storefrontmemberoverviewitem" data-tone={tone}><MemberIcon name={icon} /><div><span>{label}</span><strong>{value}</strong></div></article>;
}

function MemberDirectory({ rows, selectedId, onSelect }: Readonly<{ rows: readonly MemberAccessRow[]; selectedId: string | undefined; onSelect: (row: MemberAccessRow) => void }>) {
  return <div className="storefrontmemberdirectory" role="table" aria-label="成员管理">
    <div className="storefrontmemberlisthead" role="row">
      <span role="columnheader">成员</span><span role="columnheader">登录状态</span><span role="columnheader">管理身份</span>
      <span className="storefrontmemberidentitycol" role="columnheader">身份端</span>
      <span className="storefrontmemberstatuscol" role="columnheader">当前状态</span><span role="columnheader">加入时间</span>
    </div>
    <div role="rowgroup">
      {rows.map((row) => {
        const roleCount = row.access?.roles.length ?? 0;
        return <button className="storefrontmemberrow" data-selected={selectedId === row.id} key={row.id} type="button" role="row" aria-label={`查看成员 ${rowName(row)}`} aria-expanded={selectedId === row.id} onClick={() => onSelect(row)}>
          <span className="storefrontmemberperson" role="cell"><i>{rowName(row).slice(0, 1)}</i><strong>{rowName(row)}</strong><small>{row.member?.employee_no ?? '未设置员工号'}</small></span>
          <BindingState bound={row.member?.login_identity_bound} trueLabel="已绑定" falseLabel="未绑定" unknownLabel="待补充" />
          <BindingState bound={roleCount > 0} trueLabel={`${roleCount} 个身份`} falseLabel="未分配" />
          <span className="storefrontmemberidentity storefrontmemberidentitycol" role="cell">{clientLabel(row.member?.client)}</span>
          <span className="storefrontmemberstatuscol" role="cell"><StatusState status={rowStatus(row)} /></span>
          <time role="cell" dateTime={row.member?.joined_at ?? undefined}>{formatDate(row.member?.joined_at ?? null)}</time>
        </button>;
      })}
    </div>
  </div>;
}

function MemberDetail({ row, open, context, resetAvailable, onClose, onReset }: Readonly<{
  row: MemberAccessRow | undefined;
  open: boolean;
  context: ConsoleContext;
  resetAvailable: boolean;
  onClose: () => void;
  onReset: (member: Member) => void;
}>) {
  const detailRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<MemberDetailTab>('profile');
  useEffect(() => { if (open) detailRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => setTab('profile'), [row?.id]);
  const roles = row?.access?.roles ?? [];
  const scopes = row?.access?.scopes ?? [];
  const allowScopes = scopes.filter((scope) => scope.effect === 'allow');
  const denyScopes = scopes.filter((scope) => scope.effect === 'deny');
  const version = row?.access?.access_version ?? row?.member?.access_version;
  const canReset = resetAvailable && row?.member?.reset_allowed === true;
  return <aside ref={detailRef} className="storefrontmemberdetail" aria-hidden={!open} aria-label="成员详情" tabIndex={-1}>
    <header className="storefrontmemberpanelheading"><div><h2>成员详情</h2><span data-tone="purple">管理与权限</span></div><IconButton label="关闭成员详情" icon="close" onPress={onClose} tabIndex={open ? 0 : -1} /></header>
    {row === undefined ? null : <div className="storefrontmemberdetailbody">
      <section className="storefrontmemberidentitycard"><i>{rowName(row).slice(0, 1)}</i><div><h3>{rowName(row)}</h3><p>{row.member?.employee_no ?? '未设置员工号'}</p></div><StatusState status={rowStatus(row)} /></section>
      <div className="storefrontmembertags" aria-label="成员标签">
        <span>{clientLabel(row.member?.client)}</span>
        <span data-tone={rowStatus(row) === 'active' ? 'success' : 'muted'}>{statusLabel(rowStatus(row))}</span>
        {row.member?.login_identity_bound ? <span data-tone="success">登录已绑定</span> : null}
        {isOwner(row) ? <span data-tone="purple">Owner</span> : null}
        {isSelf(row, context) ? <span data-tone="purple">本人</span> : null}
        {roles.map((role) => <span key={role.role} data-tone="purple">{role.name}</span>)}
      </div>
      <nav className="storefrontmemberdetailtabs" aria-label="成员档案">
        <DetailTab selected={tab === 'profile'} onPress={() => setTab('profile')}>基本资料</DetailTab>
        <DetailTab selected={tab === 'roles'} onPress={() => setTab('roles')}>身份与权限</DetailTab>
        <DetailTab selected={tab === 'scopes'} onPress={() => setTab('scopes')}>管理范围</DetailTab>
      </nav>
      <div className="storefrontmembertabcontent" key={tab}>
        {tab === 'profile' ? <ProfileTab row={row} version={version} /> : null}
        {tab === 'roles' ? <RolesTab row={row} roles={roles} denyCount={denyScopes.length} /> : null}
        {tab === 'scopes' ? <ScopesTab scopes={allowScopes} denyCount={denyScopes.length} /> : null}
      </div>
      {canReset && row.member !== undefined ? <footer className="storefrontmemberdetailpagination"><button type="button" onClick={() => onReset(row.member as Member)}>重置注册身份</button></footer> : null}
      {row.member?.reset_block_reason === null || row.member?.reset_block_reason === undefined ? null : <div className="storefrontmemberemptyline">注册重置限制：{row.member.reset_block_reason}</div>}
      <p className="storefrontmembernotice">成员与授权关系来自当前范围真实数据，管理操作按当前权限开放</p>
    </div>}
  </aside>;
}

function ProfileTab({ row, version }: Readonly<{ row: MemberAccessRow; version: string | number | undefined }>) {
  return <section className="storefrontmemberdetailsection"><header><h3>基本资料</h3><span>真实成员档案</span></header><dl className="storefrontmemberfacts">
    <Fact label="员工号" value={row.member?.employee_no ?? '未设置'} /><Fact label="身份端" value={clientLabel(row.member?.client)} />
    <Fact label="登录身份" value={row.member === undefined ? '待补充' : row.member.login_identity_bound ? '已绑定' : '未绑定'} tone={row.member?.login_identity_bound ? 'success' : 'muted'} />
    <Fact label="档案状态" value={row.member?.status ?? '待补充'} /><Fact label="成员状态" value={statusLabel(rowStatus(row))} tone={rowStatus(row) === 'active' ? 'success' : 'muted'} />
    <Fact label="权限版本" value={version === undefined ? '待补充' : `v${version}`} /><Fact label="治理邀请人" value={row.member?.governance_parent_name ?? (isOwner(row) ? '治理根节点' : '未记录')} />
    <Fact label="加入时间" value={formatDate(row.member?.joined_at ?? null)} />
  </dl></section>;
}

type MemberRole = NonNullable<MemberAccessRow['access']>['roles'][number];
type MemberScope = NonNullable<MemberAccessRow['access']>['scopes'][number];

function RolesTab({ row, roles, denyCount }: Readonly<{ row: MemberAccessRow; roles: readonly MemberRole[]; denyCount: number }>) {
  return <><section className="storefrontmemberorderoverview"><div><span>管理身份</span><strong>{roles.length}</strong></div><div><span>当前有效权限</span><strong>{row.access?.effective_permissions.length ?? 0}</strong></div></section>
    <section className="storefrontmemberdetailsection"><header><h3>已分配身份</h3><span>{denyCount > 0 ? `${denyCount} 项明确禁止` : '无明确禁止'}</span></header>
      {roles.length === 0 ? <div className="storefrontmemberemptyline">该成员尚未分配管理身份</div> : <div className="storefrontmemberrelationlist">{roles.map((role) => <article key={`${role.role}:${role.scope.kind}:${role.scope.id}`}><i>{role.name.slice(0, 1)}</i><div><strong>{role.name}</strong><span>{scopeKindLabel(role.scope.kind)}范围</span></div><time>{role.expires === null ? '长期有效' : formatDate(role.expires)}</time><span>{role.scope_source === 'inherited' ? '继承' : '直接'}</span></article>)}</div>}
    </section></>;
}

function ScopesTab({ scopes, denyCount }: Readonly<{ scopes: readonly MemberScope[]; denyCount: number }>) {
  return <section className="storefrontmemberdetailsection"><header><h3>当前管理范围</h3><span>{denyCount > 0 ? `${denyCount} 项明确禁止优先` : '按身份授权生效'}</span></header>
    {scopes.length === 0 ? <div className="storefrontmemberemptyline">当前没有返回允许范围</div> : <div className="storefrontmemberrelationlist">{scopes.map((scope) => <article key={scope.id}><i>{scopeKindLabel(scope.kind).slice(0, 1)}</i><div><strong>{scopeKindLabel(scope.kind)}</strong><span>当前授权范围</span></div><time>{scope.expires === null ? '长期有效' : formatDate(scope.expires)}</time><span>允许</span></article>)}</div>}
  </section>;
}

function DetailTab({ selected, children, onPress }: Readonly<{ selected: boolean; children: string; onPress: () => void }>) {
  return <button type="button" role="tab" aria-selected={selected} onClick={onPress}>{children}</button>;
}
function Fact({ label, value, tone }: Readonly<{ label: string; value: string; tone?: 'muted' | 'success' }>) {
  return <div><dt>{label}</dt><dd data-tone={tone}>{tone !== undefined ? <i /> : null}{value}</dd></div>;
}
function BindingState({ bound, trueLabel, falseLabel, unknownLabel = falseLabel }: Readonly<{ bound: boolean | undefined; trueLabel: string; falseLabel: string; unknownLabel?: string }>) {
  const label = bound === undefined ? unknownLabel : bound ? trueLabel : falseLabel;
  return <span className="storefrontmemberbinding" data-bound={bound === true} role="cell" aria-label={label}><i />{label}</span>;
}
function StatusState({ status }: Readonly<{ status: string }>) {
  return <span className="storefrontmemberstatus" data-status={status}><i />{statusLabel(status)}</span>;
}
function FilterButton({ active, children, onPress }: Readonly<{ active: boolean; children: string; onPress: () => void }>) {
  return <button type="button" aria-pressed={active} onClick={onPress}>{children}</button>;
}
function IconButton({ label, icon, loading = false, onPress, tabIndex = 0 }: Readonly<{ label: string; icon: MemberIconName; loading?: boolean; onPress: () => void; tabIndex?: number }>) {
  return <button className="storefrontmembericonbutton" data-loading={loading} type="button" aria-label={label} title={label} tabIndex={tabIndex} onClick={onPress}><span><MemberIcon name={icon} /></span></button>;
}

const iconPaths: Readonly<Record<MemberIconName, readonly string[]>> = Object.freeze({
  close: ['M6 6l12 12', 'M18 6 6 18'], expand: ['M9 4H4v5', 'M15 4h5v5', 'M20 15v5h-5', 'M4 15v5h5'],
  member: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M4 22a8 8 0 0 1 16 0'], mobile: ['M7 2h10v20H7z', 'M10 18h4'],
  refresh: ['M20 11a8 8 0 1 0-2.34 5.66', 'M20 4v7h-7'], search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z', 'm17 17 4 4'],
  shield: ['M12 3 5 6v5c0 4.5 2.8 7.7 7 10 4.2-2.3 7-5.5 7-10V6l-7-3Z', 'M9 12l2 2 4-5'],
});
function MemberIcon({ name }: Readonly<{ name: MemberIconName }>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name].map((path) => <path key={path} d={path} />)}</svg>;
}

function mergeRows(members: readonly Member[], access: readonly AccessMembership[]): readonly MemberAccessRow[] {
  const memberById = new Map(members.map((member) => [member.membership_id, member]));
  const accessById = new Map(access.map((membership) => [membership.id, membership]));
  return [...new Set([...memberById.keys(), ...accessById.keys()])].map((id) => {
    const member = memberById.get(id);
    const membership = accessById.get(id);
    return { id, ...(member === undefined ? {} : { member }), ...(membership === undefined ? {} : { access: membership }) };
  });
}
function hasOperation(context: ConsoleContext, operation: string): boolean {
  return context.session.capabilities.includes(operation) || context.session.permissions.includes(operation);
}
function rowSearchText(row: MemberAccessRow): string {
  return [rowName(row), row.member?.employee_no, clientLabel(row.member?.client), ...(row.access?.roles.map((role) => role.name) ?? [])].filter((value): value is string => typeof value === 'string').join(' ').toLocaleLowerCase('zh-CN');
}
function rowName(row: MemberAccessRow): string { return row.member?.display_name ?? row.access?.display_name ?? '未命名成员'; }
function rowStatus(row: MemberAccessRow): string { return row.member?.membership_status ?? row.access?.status ?? row.member?.status ?? 'unknown'; }
function isOwner(row: MemberAccessRow): boolean { return (row.access?.roles ?? []).some((role) => /owner/i.test(`${role.role} ${role.name}`)); }
function isSelf(row: MemberAccessRow, context: ConsoleContext): boolean { return row.id === context.session.membership || row.member?.membership_id === context.session.membership; }
function clientLabel(client?: Member['client']): string { return client === 'operator' ? '管理端' : client === 'storefront' ? '消费者' : client === 'store' ? '门店端' : client === 'supplier' ? '供应商端' : '成员'; }
function scopeKindLabel(kind: string): string { return ({ platform: '平台', tenant: '商户', distributor: '分销', enterprise: '集团', mall: '商城', supplier: '供应商', brand: '品牌', store: '门店', department: '部门', self: '本人' } as Record<string, string>)[kind] ?? '当前范围'; }
function statusLabel(status: string): string { return ({ active: '有效', invited: '待激活', suspended: '已暂停', offboarded: '已移除', expired: '已过期', left: '已离开', unknown: '待补充' } as Record<string, string>)[status] ?? status; }
function resourceState(data: unknown, fetching: boolean, error?: string): ResourceCondition {
  if (error !== undefined) return data === undefined ? 'failure' : 'stale';
  if (data === undefined) return 'loading';
  const page = data as Readonly<{ items: readonly unknown[] }>;
  if (page.items.length === 0) return 'empty';
  return fetching ? 'refreshing' : 'ready';
}
