import { ApiError } from '@shop/sdk';
import { Badge, Button, Form, Surface } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { scopeDisplayName, scopeKindLabel } from '../../entity/session/ScopePresentation';
import { safeQueryError } from '../../shared/api/QueryState';
import { PERMISSION_GROUPS, riskLabel } from './AccessRoleCatalog';
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

  return <Form className="roleeditor" label="编辑身份" onSubmit={submit}>
    <main className="roleeditormain">
      <header className="roleeditorheader">
        <div><p>IDENTITY PROFILE</p><h2>{role.persisted ? '编辑身份' : '新建自定义身份'}</h2><span>{role.governance ? '治理身份只读展示，不作为普通自定义身份编辑。' : '名称自由输入；权限始终由下方权威目录独立选择。'}</span></div>
        <Badge tone={role.persisted ? 'neutral' : 'warning'}>{role.persisted ? `版本 v${role.version}` : '未保存草稿'}</Badge>
      </header>

      <label className="roleeditorname">身份名称
        <span><i aria-hidden="true">{normalizedName.slice(0, 1) || '新'}</i><input value={name} disabled={!canWrite || mutation.isPending} onChange={(event) => { onEdit(); setName(event.target.value); }} placeholder="例如：财务" required /><small>可随时改名</small></span>
      </label>

      {!role.editable ? <p className="roleeditorreadonly" role="status">Owner 与治理身份不作为普通可编辑身份，也没有删除入口。</p> : canWrite ? null : <p className="roleeditorreadonly" role="status">当前会话没有 access.role.manage 与 access.roles.manage 的完整写入能力，编辑保持只读。</p>}

      <section className="rolepermissionoverview" aria-labelledby="permissionoverviewtitle">
        <header><div><h3 id="permissionoverviewtitle">选择功能权限</h3><p>已选择 {permissions.length} / {PERMISSION_GROUPS.reduce((count, group) => count + group.permissions.length, 0)}</p></div>
          <label>筛选权限<input value={permissionFilter} onChange={(event) => setPermissionFilter(event.target.value)} placeholder="输入权限代码" /></label>
        </header>
        <div className="rolecategorygrid">
          {PERMISSION_GROUPS.map((group) => {
            const selected = group.permissions.filter(({ code }) => permissionSet.has(code)).length;
            const expanded = expandedCategories.has(group.category);
            return <button key={group.category} type="button" aria-controls={`permission-${group.category}`} aria-expanded={expanded} onClick={() => {
              setExpandedCategories((current) => current.has(group.category) ? current : new Set(current).add(group.category));
              requestAnimationFrame(() => {
                const target = document.getElementById(`permission-${group.category}`);
                if (typeof target?.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' });
              });
            }}>
              <span>{group.label}</span><strong>{selected}</strong><small>/ {group.permissions.length} 项已选择</small>
            </button>;
          })}
        </div>
      </section>

      <section className="rolepermissiondirectory" aria-label="完整权限目录">
        {visibleGroups.length === 0 ? <p className="rolepermissionempty">没有匹配的权限代码。</p> : visibleGroups.map((group) => {
          const selected = group.permissions.filter(({ code }) => permissionSet.has(code)).length;
          const expanded = filteringPermissions || expandedCategories.has(group.category);
          return <details key={group.category} id={`permission-${group.category}`} open={expanded} onToggle={(event) => {
            if (filteringPermissions) return;
            const open = event.currentTarget.open;
            setExpandedCategories((current) => {
              if (open === current.has(group.category)) return current;
              const next = new Set(current);
              if (open) next.add(group.category);
              else next.delete(group.category);
              return next;
            });
          }}>
            <summary><span>{group.label}</span><Badge tone={selected === 0 ? 'neutral' : 'info'}>{selected} / {group.permissions.length}</Badge></summary>
            {expanded ? <div className="rolepermissionitems">
              {group.permissions.map((permission) => <label key={permission.code}>
                <input type="checkbox" checked={permissionSet.has(permission.code)} disabled={!canWrite || mutation.isPending}
                  onChange={(event) => togglePermission(permission.code, event.target.checked)} />
                <span><code>{permission.code}</code><small>{riskLabel(permission.risk)} · {permission.scopes.map(scopeKindLabel).join('、')}</small></span>
              </label>)}
            </div> : null}
          </details>;
        })}
      </section>
    </main>

    <aside className="roleeditorrail" aria-label="范围、成员与保存状态">
      {role.persisted && role.version !== undefined ? <RoleScopeMembers context={context} role={{ ...role, version: role.version,
        permissions: [...role.permissions] }} members={members}
        onRefresh={onRefresh} onNotice={onNotice} onDeleted={onDeleted} /> : <>
        <Surface depth="flat" padding="default" radius="large"><p>管理范围</p><strong>{scopeKindLabel(context.scope.kind)} · {scopeDisplayName(context.scope)}</strong><span>先保存身份，再直接指定或继承明确范围。</span><Badge tone="warning">待保存</Badge></Surface>
        <Surface depth="flat" padding="default" radius="large"><p>已分配成员</p><strong>保存后可分配</strong><span>草稿不会创建临时成员关系。</span><Badge tone="neutral">0 位</Badge></Surface>
      </>}
      {error === undefined ? null : <div className="roleeditorerror" data-kind={error.kind} role="alert"><strong>{error.title}</strong><p>{error.detail}</p>{error.kind === 'conflict' ? <Button onPress={() => void onRefresh()}>重新读取最新版本</Button> : null}</div>}
      <div className="roleeditorsave">
        <Button type="submit" tone="primary" size="large" isPending={mutation.isPending} isDisabled={!canWrite || !dirty || normalizedName.length === 0}>
          {mutation.isPending ? '正在保存并重读核对…' : '保存身份'}
        </Button>
        <small>{dirty ? '尚未保存；页面不会把当前草稿视为持久化结果。' : '名称与权限均与正式读取结果一致。'}</small>
      </div>
    </aside>
  </Form>;
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
