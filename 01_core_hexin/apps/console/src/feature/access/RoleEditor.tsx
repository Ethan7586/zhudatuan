import { ApiError } from '@shop/sdk';
import { Badge, Button, Form, Surface } from '@shop/design';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { scopeDisplayName, scopeKindLabel } from '../../entity/session/ScopePresentation';
import { safeQueryError } from '../../shared/api/QueryState';
import { PERMISSION_GROUPS, riskLabel } from './AccessRoleCatalog';
import { accessAuditAvailable, accessAuditKey, readAccessAudit } from './AccessAuditQuery';
import { roleCommandAvailable, saveAccessRole, verifyAccessRoleSave } from './AccessRoleCommand';
import type { AccessMembership, AccessRole } from './AccessSchema';
import { RoleScopeMembers } from './RoleScopeMembers';

export interface RoleEditorRecord {
  readonly id: string;
  readonly name: string;
  readonly status: 'active' | 'disabled';
  readonly version?: number;
  readonly permissions: readonly string[];
  readonly member_count: number;
  readonly governance: boolean;
  readonly editable: boolean;
  readonly members: AccessRole['members'];
  readonly scopes: AccessRole['scopes'];
  readonly persisted: boolean;
}

type RoleDetailTab = 'overview' | 'permissions' | 'members' | 'history';

export function RoleEditor({ context, role, members, onEdit, onRefresh, onSaved, onNotice, onDeleted }: Readonly<{
  context: ConsoleContext;
  role: RoleEditorRecord;
  members: readonly AccessMembership[];
  onEdit: () => void;
  onRefresh: () => Promise<Readonly<{ roles: readonly AccessRole[]; items: readonly AccessMembership[] }>>;
  onSaved: (role: AccessRole, affected: readonly Readonly<{ membership: string; access_version: number }>[]) => void;
  onNotice: (notice: string) => void;
  onDeleted: () => void;
}>) {
  const [name, setName] = useState(role.name);
  const [permissions, setPermissions] = useState<readonly string[]>(role.permissions);
  const [permissionFilter, setPermissionFilter] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<ReadonlySet<string>>(() => new Set());
  const [tab, setTab] = useState<RoleDetailTab>(role.persisted ? 'overview' : 'permissions');
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const canWrite = role.editable && roleCommandAvailable(context);
  const normalizedName = name.trim();
  const dirty = normalizedName !== role.name || !samePermissions(permissions, role.permissions);
  const visibleGroups = useMemo(() => {
    const filter = permissionFilter.trim().toLocaleLowerCase('zh-CN');
    if (filter === '') return PERMISSION_GROUPS;
    return PERMISSION_GROUPS.map((group) => ({ ...group, permissions: group.permissions.filter(({ code }) => code.toLocaleLowerCase('zh-CN').includes(filter)) }))
      .filter(({ permissions: items }) => items.length > 0);
  }, [permissionFilter]);
  const filteringPermissions = permissionFilter.trim() !== '';
  const auditReadable = accessAuditAvailable(context);
  const auditQuery = useQuery({
    queryKey: accessAuditKey(context),
    queryFn: ({ signal }) => readAccessAudit(context, signal),
    enabled: tab === 'history' && role.persisted && auditReadable,
    staleTime: 30_000,
  });
  const roleAudit = useMemo(() => auditQuery.data?.filter((record) => record.resource_id === role.id) ?? [], [auditQuery.data, role.id]);
  const mutation = useMutation({
    mutationFn: async () => {
      const draft = { id: role.id, name: normalizedName, permissions, ...(role.version === undefined ? {} : { version: role.version }) };
      const receipt = await saveAccessRole(context, draft);
      const reread = await onRefresh();
      return { saved: verifyAccessRoleSave(draft, receipt, reread.roles, members, reread.items),
        affected: receipt.affected_memberships };
    },
    onSuccess: ({ saved, affected }) => onSaved(saved, affected),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canWrite && normalizedName.length > 0 && dirty && !mutation.isPending) mutation.mutate();
  };
  const togglePermission = (code: string, checked: boolean) => {
    onEdit();
    setPermissions((current) => checked ? [...current, code] : current.filter((permission) => permission !== code));
  };
  const error = commandError(mutation.error);

  return <Form className="roleeditor roleeditorv16" label="角色详情" onSubmit={submit}>
    <header className="roleprofileheader">
      <span className="roleprofileavatar" aria-hidden="true">{normalizedName.slice(0, 1) || '新'}</span>
      <div><div><h2>{normalizedName || '新建自定义角色'}</h2><Badge tone={role.governance ? 'info' : 'neutral'}>{role.governance ? '治理身份' : '自定义角色'}</Badge><Badge tone={role.status === 'active' ? 'success' : 'warning'}>{role.status === 'active' ? '已启用' : '已停用'}</Badge></div>
        <p>{role.governance ? '平台治理身份，按既定治理范围生效。' : '通过角色模板统一配置职责、权限和管理范围。'}</p>
        <span>{permissions.length} 项权限　·　{role.member_count} 位管理员　·　{role.scopes.length} 个范围</span>
      </div>
      {tab === 'overview' && canWrite ? <Button onPress={() => setTab('permissions')}>编辑角色</Button> : null}
    </header>
    <nav className="roledetailtabs" aria-label="角色详情">
      <RoleTab active={tab === 'overview'} onPress={() => setTab('overview')}>角色概览</RoleTab>
      <RoleTab active={tab === 'permissions'} count={permissions.length} onPress={() => setTab('permissions')}>权限</RoleTab>
      <RoleTab active={tab === 'members'} count={role.member_count} onPress={() => setTab('members')}>成员与范围</RoleTab>
      <RoleTab active={tab === 'history'} onPress={() => setTab('history')}>变更记录</RoleTab>
    </nav>
    <main className="roleeditorbody">
      {tab === 'overview' ? <RoleOverview role={role} permissions={permissions} onPermissions={() => setTab('permissions')} onMembers={() => setTab('members')} /> : null}
      {tab === 'permissions' ? <div className="rolepermissionsview">
        <label className="roleeditorname">角色名称
          <span><i aria-hidden="true">{normalizedName.slice(0, 1) || '新'}</i><input value={name} disabled={!canWrite || mutation.isPending} onChange={(event) => { onEdit(); setName(event.target.value); }} placeholder="例如：财务管理员" required /><small>说明管理员承担的职责</small></span>
        </label>
        {!role.editable ? <p className="roleeditorreadonly" role="status">Owner 与治理身份只读展示，不提供普通角色编辑入口。</p> : canWrite ? null : <p className="roleeditorreadonly" role="status">当前会话没有角色写入能力，编辑保持只读。</p>}
        <section className="rolepermissionoverview" aria-label="选择功能权限">
          <header><div><h3 id="permissionoverviewtitle">权限目录</h3><p>已选择 {permissions.length} / {PERMISSION_GROUPS.reduce((count, group) => count + group.permissions.length, 0)}；分类默认折叠，按需加载。</p></div>
            <label>筛选权限<input value={permissionFilter} onChange={(event) => setPermissionFilter(event.target.value)} placeholder="输入权限代码" /></label>
          </header>
          <div className="rolecategorygrid">{PERMISSION_GROUPS.map((group) => {
            const selected = group.permissions.filter(({ code }) => permissionSet.has(code)).length;
            const expanded = expandedCategories.has(group.category);
            return <button key={group.category} type="button" aria-controls={`permission-${group.category}`} aria-expanded={expanded} onClick={() => {
              setExpandedCategories((current) => current.has(group.category) ? current : new Set(current).add(group.category));
              requestAnimationFrame(() => {
                const category = document.getElementById(`permission-${group.category}`);
                if (typeof category?.scrollIntoView === 'function') category.scrollIntoView({ block: 'start' });
              });
            }}><span>{group.label}</span><strong>{selected}</strong><small>/ {group.permissions.length} 项已选择</small></button>;
          })}</div>
        </section>
        <section className="rolepermissiondirectory" aria-label="完整权限目录">{visibleGroups.length === 0 ? <p className="rolepermissionempty">没有匹配的权限代码。</p> : visibleGroups.map((group) => {
          const selected = group.permissions.filter(({ code }) => permissionSet.has(code)).length;
          const expanded = filteringPermissions || expandedCategories.has(group.category);
          return <details key={group.category} id={`permission-${group.category}`} open={expanded} onToggle={(event) => {
            if (filteringPermissions) return;
            const open = event.currentTarget.open;
            setExpandedCategories((current) => { const next = new Set(current); if (open) next.add(group.category); else next.delete(group.category); return next; });
          }}><summary><span>{group.label}</span><Badge tone={selected === 0 ? 'neutral' : 'info'}>{selected} / {group.permissions.length}</Badge></summary>{expanded ? <div className="rolepermissionitems">{group.permissions.map((permission) => <label key={permission.code}><input type="checkbox" checked={permissionSet.has(permission.code)} disabled={!canWrite || mutation.isPending} onChange={(event) => togglePermission(permission.code, event.target.checked)} /><span><code>{permission.code}</code><small>{riskLabel(permission.risk)} · {permission.scopes.map(scopeKindLabel).join('、')}</small></span></label>)}</div> : null}</details>;
        })}</section>
      </div> : null}
      {tab === 'members' ? <div className="rolemembersview">{role.persisted && role.version !== undefined ? <RoleScopeMembers context={context} role={{ ...role, version: role.version, permissions: [...role.permissions] }} members={members} onRefresh={onRefresh} onNotice={onNotice} onDeleted={onDeleted} /> : <Surface depth="flat" padding="default" radius="large"><p>先保存角色，再分配管理员与管理范围。</p></Surface>}</div> : null}
      {tab === 'history' ? <RoleHistory readable={auditReadable} pending={auditQuery.isPending} error={auditQuery.error} records={roleAudit} onRetry={() => void auditQuery.refetch()} /> : null}
    </main>
    {error === undefined ? null : <div className="roleeditorerror" data-kind={error.kind} role="alert"><strong>{error.title}</strong><p>{error.detail}</p>{error.kind === 'conflict' ? <Button onPress={() => void onRefresh()}>重新读取最新版本</Button> : null}</div>}
    {dirty ? <footer className="roleeditorsticky"><div><i /><span><strong>当前有未保存修改</strong><small>保存后将影响 {role.member_count} 位管理员</small></span></div><div><Button onPress={() => { setName(role.name); setPermissions(role.permissions); }}>撤销修改</Button><Button type="submit" tone="primary" isPending={mutation.isPending} isDisabled={!canWrite || normalizedName.length === 0}>{mutation.isPending ? '正在保存…' : '保存修改'}</Button></div></footer> : null}
  </Form>;
}

function RoleTab({ active, count, children, onPress }: Readonly<{ active: boolean; count?: number; children: string; onPress: () => void }>) {
  return <button type="button" aria-selected={active} onClick={onPress}>{children}{count === undefined ? null : <span>{count}</span>}</button>;
}

function RoleOverview({ role, permissions, onPermissions, onMembers }: Readonly<{ role: RoleEditorRecord; permissions: readonly string[]; onPermissions: () => void; onMembers: () => void }>) {
  const selectedGroups = PERMISSION_GROUPS.map((group) => ({ ...group, selected: group.permissions.filter(({ code }) => permissions.includes(code)).length })).filter(({ selected }) => selected > 0);
  return <div className="roleoverviewv16"><section><header><h3>职责边界</h3><p>先确认这个角色可以做什么、不能做什么。</p></header><div className="roledutygrid"><article><strong>✓ 可以做</strong><p>处理已授权功能，并查看当前管理范围内的数据。</p></article><article><strong>× 不能做</strong><p>访问范围外商城、修改系统级安全设置或查看消费者私人数据。</p></article></div><header className="roleoverviewheading"><div><h3>权限摘要</h3><p>已选择 {permissions.length} 项权限，分布在 {selectedGroups.length} 个分类中。</p></div><button type="button" onClick={onPermissions}>管理权限 →</button></header><div className="rolesummarylist">{selectedGroups.length === 0 ? <p>当前角色没有配置权限。</p> : selectedGroups.slice(0, 6).map((group) => <button type="button" key={group.category} onClick={onPermissions}><span>{group.label.slice(0, 1)}</span><div><strong>{group.label}</strong><small>已选择 {group.selected} 项功能权限</small></div><em>{group.selected} / {group.permissions.length}</em><b>›</b></button>)}</div></section><aside><div><header><h3>影响对象</h3><button type="button" onClick={onMembers}>查看全部</button></header><strong>{role.member_count} 位管理员正在使用</strong><p>保存角色后，这些管理员的权限会同步更新。</p></div><div><header><h3>管理范围</h3><button type="button" onClick={onMembers}>调整范围</button></header>{role.scopes.length === 0 ? <p>当前没有已分配范围。</p> : role.scopes.slice(0, 4).map(({ scope, member_count: count }) => <article key={`${scope.kind}:${scope.id}`}><span>{scopeKindLabel(scope.kind).slice(0, 1)}</span><div><strong>{scopeDisplayName(scope)}</strong><small>{count} 位管理员</small></div></article>)}</div></aside></div>;
}

function RoleHistory({ readable, pending, error, records, onRetry }: Readonly<{ readable: boolean; pending: boolean; error: Error | null; records: readonly { id: string; actor_id: string | null; action: string; occurred_at: string }[]; onRetry: () => void }>) {
  if (!readable) return <div className="rolehistorystate">当前身份无权读取审计记录。</div>;
  if (pending) return <div className="rolehistorystate">正在读取真实变更记录…</div>;
  if (error !== null) return <div className="rolehistorystate" role="alert"><strong>变更记录读取失败</strong><p>{safeQueryError(error) ?? 'REQUEST_FAILED'}</p><Button onPress={onRetry}>重试</Button></div>;
  if (records.length === 0) return <div className="rolehistorystate">当前审计范围内没有这个角色的变更记录。</div>;
  return <section className="rolehistoryv16"><header><h3>变更记录</h3><p>来自系统的权威审计记录。</p></header>{records.map((record) => <article key={record.id}><span>记</span><div><strong>{accessActionLabel(record.action)}</strong><p>{record.actor_id === null ? '系统操作' : '管理员操作'} · {formatAuditDate(record.occurred_at)}</p></div></article>)}</section>;
}

function accessActionLabel(action: string): string {
  if (action.includes('delete')) return '删除角色模板';
  if (action.includes('assign')) return '调整成员与管理范围';
  if (action.includes('manage')) return '更新角色名称或权限';
  return action;
}

function formatAuditDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(date);
}

function samePermissions(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((permission) => rightSet.has(permission));
}

function commandError(error: Error | null): Readonly<{ kind: 'conflict' | 'network' | 'verification' | 'failure'; title: string; detail: string }> | undefined {
  if (error === null) return undefined;
  if (error instanceof ApiError && (error.status === 409 || error.status === 412 || error.code === 'VERSION_CONFLICT')) return { kind: 'conflict', title: '版本冲突', detail: '身份已被其他操作更新；当前草稿未保存，请重读最新版本后再决定。' };
  if (error.message === 'ACCESS_ROLE_SAVE_VERIFICATION_FAILED') return { kind: 'verification', title: '保存回读核对失败', detail: '正式写入后的名称、权限或版本未能通过重读核对，当前状态不视为保存成功。' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'network', title: '网络错误', detail: '网络不可用，当前草稿仍未保存。' };
  return { kind: 'failure', title: '保存失败', detail: `${safeQueryError(error) ?? 'REQUEST_FAILED'}；当前草稿未保存。` };
}
