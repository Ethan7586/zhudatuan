import { Button, Dialog } from '@shop/design';
import { accountLabel, membershipStatusLabel, roleDescription, roleKindLabel } from '../AccessText';
import { permissionText, scopeText } from '../PermissionText';
import type { AccessMembership, AccessRole } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { PermissionSummary } from './PermissionSummary';

export function MemberDetails({ member, currentMembership, model, onClose }: Readonly<{ member: AccessMembership; currentMembership: string; model: AccessViewModel; onClose: () => void }>) {
  const roles = roleChoices(member, model.page?.roles ?? []);
  const assigned = new Set(member.roles.map((role) => role.id));
  const permissions = effectivePermissions(member);
  const scopeGroups = [...new Set(member.scopes.map((scope) => scope.kind))].map((kind) => ({ kind, count: member.scopes.filter((scope) => scope.kind === kind).length }));
  return (
    <Dialog open title={`${member.displayName}的授权详情`} eyebrow="成员 → 岗位角色 → 功能权限 → 项目范围" onClose={onClose}>
      <div className="memberdetails">
        <section className="memberidentity">
          <span>
            <strong>{member.displayName}</strong>
            <small>{accountLabel(member)}</small>
          </span>
          <b data-status={member.status}>{membershipStatusLabel(member.status)}</b>
        </section>

        <section className="memberdetailsection" aria-labelledby="memberroleslabel">
          <header>
            <div><span>1 · 工作职责</span><h2 id="memberroleslabel">岗位角色</h2></div>
            <p>岗位角色决定成员通常可以做什么。</p>
          </header>
          <div className="memberrolelist">
            {roles.map((role) => {
              const hasRole = assigned.has(role.id);
              const changeable = model.capabilities.role && role.kind === 'custom' && member.status === 'active';
              return (
                <article key={role.id} data-assigned={hasRole || undefined}>
                  <span><strong>{role.name}</strong><small>{roleKindLabel(role.kind)} · {roleDescription(role)}</small></span>
                  <b>{hasRole ? '已分配' : '未分配'}</b>
                  {changeable ? <Button onPress={() => changeRole(model, member, role, hasRole, onClose)}>{hasRole ? '撤销岗位' : '分配岗位'}</Button> : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="memberdetailsection" aria-labelledby="memberpermissionslabel">
          <header>
            <div><span>2 · 可执行操作</span><h2 id="memberpermissionslabel">功能权限</h2></div>
            <p>来自岗位角色和个人例外；明确拒绝始终优先。</p>
          </header>
          <PermissionSummary allows={permissions.allows} denies={permissions.denies} owner={member.roles.some((role) => role.kind === 'owner')} />
        </section>

        <div className="memberdetailgrid">
          <section className="memberdetailsection" aria-labelledby="memberscopeslabel">
            <header><div><span>3 · 数据边界</span><h2 id="memberscopeslabel">可管理项目</h2></div></header>
            {scopeGroups.length ? <ul className="memberfacts">{scopeGroups.map((group) => <li key={group.kind}><strong>{scopeText(group.kind)}</strong><span>{group.count} 个</span></li>)}</ul> : <p className="memberempty">没有额外项目范围</p>}
          </section>
          <section className="memberdetailsection" aria-labelledby="memberoverrideslabel">
            <header><div><span>特殊情况</span><h2 id="memberoverrideslabel">个人权限例外</h2></div></header>
            {member.overrides.length ? <ul className="memberfacts">{member.overrides.map((override) => <li key={`${override.permission}:${override.effect}`}><strong>{permissionText(override.permission)}</strong><span>{override.effect === 'allow' ? '额外允许' : '明确拒绝'}</span></li>)}</ul> : <p className="memberempty">没有个人例外，按岗位权限执行</p>}
          </section>
        </div>

        <footer>
          <Button onPress={onClose}>关闭</Button>
          {model.capabilities.scope && member.status === 'active' ? <Button onPress={() => openScope(model, member, onClose)}>设置可管理项目</Button> : null}
          {model.capabilities.override && member.id !== currentMembership && member.status === 'active' ? <Button tone="primary" onPress={() => openOverride(model, member, onClose)}>设置个人例外</Button> : null}
        </footer>
      </div>
    </Dialog>
  );
}

function roleChoices(member: AccessMembership, roles: readonly AccessRole[]): readonly AccessRole[] {
  return [...member.roles, ...roles.filter((role) => !member.roles.some((assigned) => assigned.id === role.id))].sort((left, right) => Number(member.roles.some((role) => role.id === right.id)) - Number(member.roles.some((role) => role.id === left.id)) || left.name.localeCompare(right.name, 'zh-CN'));
}

function effectivePermissions(member: AccessMembership): Readonly<{ allows: readonly string[]; denies: readonly string[] }> {
  const denies = new Set([...member.roles.flatMap((role) => role.denies), ...member.overrides.filter((item) => item.effect === 'deny').map((item) => item.permission)]);
  const allows = [...new Set([...member.roles.flatMap((role) => role.allows), ...member.overrides.filter((item) => item.effect === 'allow').map((item) => item.permission)])].filter((permission) => !denies.has(permission));
  return Object.freeze({ allows: Object.freeze(allows), denies: Object.freeze([...denies]) });
}

function changeRole(model: AccessViewModel, member: AccessMembership, role: AccessRole, assigned: boolean, close: () => void): void {
  close();
  if (assigned) model.actions.roleRevoke(role, member); else model.actions.roleAssign(role, member);
}

function openScope(model: AccessViewModel, member: AccessMembership, close: () => void): void {
  close();
  model.actions.scope(member);
}

function openOverride(model: AccessViewModel, member: AccessMembership, close: () => void): void {
  close();
  model.actions.override(member);
}
