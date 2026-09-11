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
type CapabilityPackId = 'finance' | 'orders' | 'members' | 'system';

const CAPABILITY_PACKS: readonly Readonly<{ id: CapabilityPackId; label: string; description: string; categories: readonly string[] }>[] = Object.freeze([
  { id: 'finance', label: '财务查看', description: '经营数据、账单与结算相关信息。', categories: ['reporting', 'finance', 'invoice', 'payment'] },
  { id: 'orders', label: '订单与售后', description: '商品、订单、履约和售后处理。', categories: ['catalog', 'pricing', 'inventory', 'marketing', 'cart', 'checkout', 'order', 'fulfillment', 'verification', 'voucher', 'benefit'] },
  { id: 'members', label: '会员管理', description: '管理员、会员、渠道与服务协作。', categories: ['identity', 'member', 'qualification', 'channel', 'referral', 'support', 'notification', 'experience', 'partner'] },
  { id: 'system', label: '系统设置', description: '组织、权限、运行与治理配置。', categories: ['runtime', 'organization', 'access', 'capability', 'risk', 'observability', 'audit', 'extension'] },
]);

export function RoleEditor({
  context,
  role,
  members,
  onEdit,
  onRefresh,
  onSaved,
  onNotice,
  onDeleted,
}: Readonly<{
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
  const [activePack, setActivePack] = useState<CapabilityPackId>();
  const [tab, setTab] = useState<RoleDetailTab>('permissions');
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const canWrite = role.editable && roleCommandAvailable(context);
  const normalizedName = name.trim();
  const dirty = normalizedName !== role.name || !samePermissions(permissions, role.permissions);
  const visibleGroups = useMemo(() => {
    const filter = permissionFilter.trim().toLocaleLowerCase('zh-CN');
    if (filter !== '') return PERMISSION_GROUPS.map((group) => ({ ...group, permissions: group.permissions.filter(({ code }) => code.toLocaleLowerCase('zh-CN').includes(filter)) })).filter(({ permissions: items }) => items.length > 0);
    if (activePack === undefined) return [];
    const categories = CAPABILITY_PACKS.find(({ id }) => id === activePack)?.categories ?? [];
    return PERMISSION_GROUPS.filter(({ category }) => categories.includes(category));
  }, [activePack, permissionFilter]);
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
      return { saved: verifyAccessRoleSave(draft, receipt, reread.roles, members, reread.items), affected: receipt.affected_memberships };
    },
    onSuccess: ({ saved, affected }) => onSaved(saved, affected),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canWrite && normalizedName.length > 0 && dirty && !mutation.isPending) mutation.mutate();
  };
  const togglePermission = (code: string, checked: boolean) => {
    onEdit();
    setPermissions((current) => (checked ? [...current, code] : current.filter((permission) => permission !== code)));
  };
  const error = commandError(mutation.error);

  return (
    <Form className="roleeditor roleeditorv17" label="角色详情" onSubmit={submit}>
      <header className="roleprofileheader">
        <RoleProfileIcon name={normalizedName} />
        <div>
          <div>
            <h2>{normalizedName || '新建自定义角色'}</h2>
            <Badge tone={role.status === 'active' ? 'success' : 'warning'}>{role.status === 'active' ? '已启用' : '已停用'}</Badge>
          </div>
          <p>{role.governance ? '平台治理身份，按既定治理范围生效。' : '通过角色模板统一配置职责、权限和管理范围。'}</p>
        </div>
      </header>
      <nav className="roledetailtabs" aria-label="角色详情">
        <RoleTab active={tab === 'overview'} onPress={() => setTab('overview')}>
          角色概览
        </RoleTab>
        <RoleTab active={tab === 'permissions'} onPress={() => setTab('permissions')}>
          权限配置
        </RoleTab>
        <RoleTab active={tab === 'members'} count={role.member_count} onPress={() => setTab('members')}>
          成员与范围
        </RoleTab>
        <RoleTab active={tab === 'history'} onPress={() => setTab('history')}>
          变更记录
        </RoleTab>
      </nav>
      <div className="roleeditorlayout">
        <main className="roleeditorbody">
          {tab === 'overview' ? <RoleOverview role={role} permissions={permissions} onPermissions={() => setTab('permissions')} onMembers={() => setTab('members')} /> : null}
          {tab === 'permissions' ? (
            <div className="rolepermissionsview">
              <label className="roleeditorname">
                角色名称
                <span>
                  <i aria-hidden="true">{normalizedName.slice(0, 1) || '新'}</i>
                  <input
                    value={name}
                    disabled={!canWrite || mutation.isPending}
                    onChange={(event) => {
                      onEdit();
                      setName(event.target.value);
                    }}
                    placeholder="例如：财务管理员"
                    required
                  />
                  <small>说明管理员承担的职责</small>
                </span>
              </label>
              {!role.editable ? (
                <p className="roleeditorreadonly" role="status">
                  Owner 与治理身份只读展示，不提供普通角色编辑入口。
                </p>
              ) : canWrite ? null : (
                <p className="roleeditorreadonly" role="status">
                  当前会话没有角色写入能力，编辑保持只读。
                </p>
              )}
              <section className="rolepermissionoverview" aria-label="选择功能权限">
                <header>
                  <div>
                    <h3 id="permissionoverviewtitle">选择这个角色需要的能力</h3>
                    <p>先按职责选择能力包，需要时再展开细调。</p>
                  </div>
                  <label>
                    筛选权限
                    <input value={permissionFilter} onChange={(event) => setPermissionFilter(event.target.value)} placeholder="输入权限代码" />
                  </label>
                </header>
                <div className="rolecategorygrid">
                  {CAPABILITY_PACKS.map((pack) => {
                    const groups = PERMISSION_GROUPS.filter(({ category }) => pack.categories.includes(category));
                    const allPermissions = groups.flatMap(({ permissions: items }) => items);
                    const selected = allPermissions.filter(({ code }) => permissionSet.has(code)).length;
                    const expanded = activePack === pack.id && !filteringPermissions;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        aria-controls="rolepermissiondetails"
                        aria-expanded={expanded}
                        data-selected={selected > 0}
                        onClick={() => {
                          setPermissionFilter('');
                          setActivePack((current) => (current === pack.id ? undefined : pack.id));
                          requestAnimationFrame(() => document.getElementById('rolepermissiondetails')?.scrollIntoView({ block: 'nearest' }));
                        }}
                      >
                        <CapabilityIcon kind={pack.id} />
                        <span>
                          <strong>{pack.label}</strong>
                          <small>{pack.description}</small>
                        </span>
                        <i aria-hidden="true">{selected > 0 ? '✓' : ''}</i>
                        <em>
                          {selected} / {allPermissions.length} 项权限
                        </em>
                        <b aria-hidden="true">›</b>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section id="rolepermissiondetails" className="rolepermissiondirectory" aria-label="完整权限目录">
                {visibleGroups.length === 0 ? (
                  <p className="rolepermissionempty">选择一个能力包查看具体权限，或输入权限代码搜索。</p>
                ) : (
                  visibleGroups.map((group) => {
                    const selected = group.permissions.filter(({ code }) => permissionSet.has(code)).length;
                    return (
                      <section key={group.category} id={`permission-${group.category}`}>
                        <header>
                          <span>{group.label}</span>
                          <Badge tone={selected === 0 ? 'neutral' : 'info'}>
                            {selected} / {group.permissions.length}
                          </Badge>
                        </header>
                        <div className="rolepermissionitems">
                          {group.permissions.map((permission) => (
                            <label key={permission.code}>
                              <input type="checkbox" checked={permissionSet.has(permission.code)} disabled={!canWrite || mutation.isPending} onChange={(event) => togglePermission(permission.code, event.target.checked)} />
                              <span>
                                <code>{permission.code}</code>
                                <small>
                                  {riskLabel(permission.risk)} · {permission.scopes.map(scopeKindLabel).join('、')}
                                </small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </section>
                    );
                  })
                )}
              </section>
            </div>
          ) : null}
          {tab === 'members' ? (
            <div className="rolemembersview">
              {role.persisted && role.version !== undefined ? (
                <RoleScopeMembers context={context} role={{ ...role, version: role.version, permissions: [...role.permissions] }} members={members} onRefresh={onRefresh} onNotice={onNotice} onDeleted={onDeleted} />
              ) : (
                <Surface depth="flat" padding="default" radius="large">
                  <p>先保存角色，再分配管理员与管理范围。</p>
                </Surface>
              )}
            </div>
          ) : null}
          {tab === 'history' ? <RoleHistory readable={auditReadable} pending={auditQuery.isPending} error={auditQuery.error} records={roleAudit} onRetry={() => void auditQuery.refetch()} /> : null}
        </main>
        <RoleImpactPreview role={role} permissions={permissions} />
      </div>
      {error === undefined ? null : (
        <div className="roleeditorerror" data-kind={error.kind} role="alert">
          <strong>{error.title}</strong>
          <p>{error.detail}</p>
          {error.kind === 'conflict' ? <Button onPress={() => void onRefresh()}>重新读取最新版本</Button> : null}
        </div>
      )}
      <footer className="roleeditorsticky" data-dirty={dirty}>
        <div>
          <i />
          <span>
            <strong>{dirty ? '当前有未保存修改' : '当前没有未保存修改'}</strong>
            <small>{dirty ? `保存后将影响 ${role.member_count} 位管理员` : `${permissions.length} 项权限已与服务器同步`}</small>
          </span>
        </div>
        <div>
          <Button
            isDisabled={!dirty || mutation.isPending}
            onPress={() => {
              setName(role.name);
              setPermissions(role.permissions);
            }}
          >
            撤销修改
          </Button>
          <Button type="submit" tone="primary" isPending={mutation.isPending} isDisabled={!dirty || !canWrite || normalizedName.length === 0}>
            {mutation.isPending ? '正在保存…' : '保存修改'}
          </Button>
        </div>
      </footer>
    </Form>
  );
}

function CapabilityIcon({ kind }: Readonly<{ kind: CapabilityPackId }>) {
  const paths =
    kind === 'finance'
      ? ['M4 7h16v12H4z', 'M8 7V5h8v2', 'M8 12h8']
      : kind === 'orders'
        ? ['M3 5h2l2 10h10l2-7H6', 'M9 20h.01', 'M17 20h.01']
        : kind === 'members'
          ? ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87']
          : ['M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7l7-4Z', 'M9 12l2 2 4-5'];
  return (
    <span className="rolecapabilityicon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}

function RoleProfileIcon({ name }: Readonly<{ name: string }>) {
  return (
    <span className="roleprofileavatar" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16v12H4z" />
        <path d="M8 7V5h8v2" />
        <path d="M8 12h8" />
      </svg>
      <b>{name.length === 0 ? '新' : ''}</b>
    </span>
  );
}

function RoleImpactPreview({ role, permissions }: Readonly<{ role: RoleEditorRecord; permissions: readonly string[] }>) {
  const selectedPacks = CAPABILITY_PACKS.map((pack) => ({
    ...pack,
    selected: PERMISSION_GROUPS.filter(({ category }) => pack.categories.includes(category))
      .flatMap(({ permissions: items }) => items)
      .filter(({ code }) => permissions.includes(code)).length,
  })).filter(({ selected }) => selected > 0);
  return (
    <aside className="roleimpactpreview" aria-label="权限影响预览">
      <header>
        <h3>权限影响预览</h3>
        <p>保存前检查</p>
      </header>
      <section>
        <h4>这个角色可以</h4>
        {selectedPacks.length === 0 ? (
          <p>尚未选择任何能力。</p>
        ) : (
          <ul>
            {selectedPacks.slice(0, 3).map((pack) => (
              <li key={pack.id}>
                <i>✓</i>
                <span>
                  {pack.label}（{pack.selected} 项）
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section data-tone="danger">
        <h4>这个角色不能</h4>
        <ul>
          <li>
            <i>×</i>
            <span>访问授权范围外的数据</span>
          </li>
          <li>
            <i>×</i>
            <span>因角色名称自动获得额外权限</span>
          </li>
        </ul>
      </section>
      <section>
        <h4>影响对象</h4>
        <div className="roleimpactmetric">
          <CapabilityIcon kind="members" />
          <strong>{role.member_count} 位管理员</strong>
        </div>
      </section>
      <section>
        <h4>管理范围</h4>
        {role.scopes.length === 0 ? (
          <p>尚未分配管理范围</p>
        ) : (
          role.scopes.slice(0, 3).map(({ scope }) => (
            <div className="roleimpactmetric" key={`${scope.kind}:${scope.id}`}>
              <CapabilityIcon kind="system" />
              <strong>{scopeDisplayName(scope)}</strong>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}

function RoleTab({ active, count, children, onPress }: Readonly<{ active: boolean; count?: number; children: string; onPress: () => void }>) {
  return (
    <button type="button" aria-selected={active} onClick={onPress}>
      {children}
      {count === undefined ? null : <span>{count}</span>}
    </button>
  );
}

function RoleOverview({ role, permissions, onPermissions, onMembers }: Readonly<{ role: RoleEditorRecord; permissions: readonly string[]; onPermissions: () => void; onMembers: () => void }>) {
  const selectedGroups = PERMISSION_GROUPS.map((group) => ({ ...group, selected: group.permissions.filter(({ code }) => permissions.includes(code)).length })).filter(({ selected }) => selected > 0);
  return (
    <div className="roleoverviewv16">
      <section>
        <header>
          <h3>职责边界</h3>
          <p>先确认这个角色可以做什么、不能做什么。</p>
        </header>
        <div className="roledutygrid">
          <article>
            <strong>✓ 可以做</strong>
            <p>处理已授权功能，并查看当前管理范围内的数据。</p>
          </article>
          <article>
            <strong>× 不能做</strong>
            <p>访问范围外商城、修改系统级安全设置或查看消费者私人数据。</p>
          </article>
        </div>
        <header className="roleoverviewheading">
          <div>
            <h3>权限摘要</h3>
            <p>
              已选择 {permissions.length} 项权限，分布在 {selectedGroups.length} 个分类中。
            </p>
          </div>
          <button type="button" onClick={onPermissions}>
            管理权限 →
          </button>
        </header>
        <div className="rolesummarylist">
          {selectedGroups.length === 0 ? (
            <p>当前角色没有配置权限。</p>
          ) : (
            selectedGroups.slice(0, 6).map((group) => (
              <button type="button" key={group.category} onClick={onPermissions}>
                <span>{group.label.slice(0, 1)}</span>
                <div>
                  <strong>{group.label}</strong>
                  <small>已选择 {group.selected} 项功能权限</small>
                </div>
                <em>
                  {group.selected} / {group.permissions.length}
                </em>
                <b>›</b>
              </button>
            ))
          )}
        </div>
      </section>
      <aside>
        <div>
          <header>
            <h3>影响对象</h3>
            <button type="button" onClick={onMembers}>
              查看全部
            </button>
          </header>
          <strong>{role.member_count} 位管理员正在使用</strong>
          <p>保存角色后，这些管理员的权限会同步更新。</p>
        </div>
        <div>
          <header>
            <h3>管理范围</h3>
            <button type="button" onClick={onMembers}>
              调整范围
            </button>
          </header>
          {role.scopes.length === 0 ? (
            <p>当前没有已分配范围。</p>
          ) : (
            role.scopes.slice(0, 4).map(({ scope, member_count: count }) => (
              <article key={`${scope.kind}:${scope.id}`}>
                <span>{scopeKindLabel(scope.kind).slice(0, 1)}</span>
                <div>
                  <strong>{scopeDisplayName(scope)}</strong>
                  <small>{count} 位管理员</small>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function RoleHistory({
  readable,
  pending,
  error,
  records,
  onRetry,
}: Readonly<{ readable: boolean; pending: boolean; error: Error | null; records: readonly { id: string; actor_id: string | null; action: string; occurred_at: string }[]; onRetry: () => void }>) {
  if (!readable) return <div className="rolehistorystate">当前身份无权读取审计记录。</div>;
  if (pending) return <div className="rolehistorystate">正在读取真实变更记录…</div>;
  if (error !== null)
    return (
      <div className="rolehistorystate" role="alert">
        <strong>变更记录读取失败</strong>
        <p>{safeQueryError(error) ?? 'REQUEST_FAILED'}</p>
        <Button onPress={onRetry}>重试</Button>
      </div>
    );
  if (records.length === 0) return <div className="rolehistorystate">当前审计范围内没有这个角色的变更记录。</div>;
  return (
    <section className="rolehistoryv16">
      <header>
        <h3>变更记录</h3>
        <p>来自系统的权威审计记录。</p>
      </header>
      {records.map((record) => (
        <article key={record.id}>
          <span>记</span>
          <div>
            <strong>{accessActionLabel(record.action)}</strong>
            <p>
              {record.actor_id === null ? '系统操作' : '管理员操作'} · {formatAuditDate(record.occurred_at)}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
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
  if (error instanceof ApiError && (error.status === 409 || error.status === 412 || error.code === 'VERSION_CONFLICT'))
    return { kind: 'conflict', title: '版本冲突', detail: '身份已被其他操作更新；当前草稿未保存，请重读最新版本后再决定。' };
  if (error.message === 'ACCESS_ROLE_SAVE_VERIFICATION_FAILED') return { kind: 'verification', title: '保存回读核对失败', detail: '正式写入后的名称、权限或版本未能通过重读核对，当前状态不视为保存成功。' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'network', title: '网络错误', detail: '网络不可用，当前草稿仍未保存。' };
  return { kind: 'failure', title: '保存失败', detail: `${safeQueryError(error) ?? 'REQUEST_FAILED'}；当前草稿未保存。` };
}
