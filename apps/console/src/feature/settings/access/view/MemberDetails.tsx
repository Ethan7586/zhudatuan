import { Button, Dialog } from '@shop/design';
import { useState } from 'react';
import { accountLabel, membershipStatusLabel, roleDescription, roleKindLabel, roleName } from '../AccessText';
import { permissionText, scopeText } from '../PermissionText';
import type { AccessMembership, AccessRole } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { PermissionSummary } from './PermissionSummary';
import { TechnicalDetails } from './TechnicalDetails';

export function MemberDetails({ member, currentMembership, model, onClose }: Readonly<{ member: AccessMembership; currentMembership: string; model: AccessViewModel; onClose: () => void }>) {
  const availableRoles = roleChoices(member, model.page?.roles ?? []);
  const [roleId, setRoleId] = useState(availableRoles[0]?.id ?? '');
  const selectedRole = availableRoles.find((role) => role.id === roleId);
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
          <TechnicalDetails facts={[{ label: '成员标识', value: <code>{member.id}</code> }, ...(member.employeeNo ? [{ label: '员工编号', value: member.employeeNo }] : []), { label: '授权版本', value: `第 ${member.accessVersion} 版` }]} />
        </section>

        <section className="memberdetailsection" aria-labelledby="memberroleslabel">
          <header>
            <div>
              <span>1 · 工作职责</span>
              <h2 id="memberroleslabel">岗位角色</h2>
            </div>
            <p>优先通过岗位一次授予完整职责，便于后续统一调整。</p>
          </header>
          {member.roles.length ? (
            <ul className="memberroles">
              {member.roles.map((role) => (
                <li key={role.id}>
                  <span>
                    <strong>{roleName(role)}</strong>
                    <small>
                      {roleKindLabel(role.kind)} · {roleDescription(role)}
                    </small>
                  </span>
                  {model.capabilities.role && role.kind === 'custom' && member.status === 'active' ? <Button onPress={() => changeRole(model, member, role, true, onClose)}>撤销岗位</Button> : <b>已分配</b>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="memberempty">尚未分配岗位角色</p>
          )}
          {model.capabilities.role && member.status === 'active' ? (
            <details className="memberroleassign">
              <summary>分配岗位角色</summary>
              {availableRoles.length ? (
                <div>
                  <label>
                    选择岗位
                    <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {roleName(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>{selectedRole ? roleDescription(selectedRole) : '请选择一个可用岗位。'}</p>
                  <Button tone="primary" onPress={() => selectedRole && changeRole(model, member, selectedRole, false, onClose)} isDisabled={!selectedRole}>
                    确认分配
                  </Button>
                </div>
              ) : (
                <p>没有可分配的启用岗位，可先到“岗位角色”新建或启用岗位。</p>
              )}
            </details>
          ) : null}
        </section>

        <section className="memberdetailsection" aria-labelledby="memberpermissionslabel">
          <header>
            <div>
              <span>2 · 可执行操作</span>
              <h2 id="memberpermissionslabel">最终功能权限</h2>
            </div>
            <p>系统合并岗位与个人例外；明确拒绝始终优先。</p>
          </header>
          <PermissionSummary allows={permissions.allows} denies={permissions.denies} owner={member.roles.some((role) => role.kind === 'owner')} />
        </section>

        <div className="memberdetailgrid">
          <section className="memberdetailsection" aria-labelledby="memberscopeslabel">
            <header>
              <div>
                <span>3 · 数据边界</span>
                <h2 id="memberscopeslabel">可管理项目</h2>
              </div>
            </header>
            {scopeGroups.length ? (
              <ul className="memberfacts">
                {scopeGroups.map((group) => (
                  <li key={group.kind}>
                    <strong>{scopeText(group.kind)}</strong>
                    <span>{group.count} 个</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="memberempty">没有额外项目范围</p>
            )}
          </section>
          <section className="memberdetailsection" aria-labelledby="memberoverrideslabel">
            <header>
              <div>
                <span>特殊情况</span>
                <h2 id="memberoverrideslabel">个人权限例外</h2>
              </div>
            </header>
            {member.overrides.length ? (
              <ul className="memberfacts">
                {member.overrides.map((override) => (
                  <li key={`${override.permission}:${override.effect}`}>
                    <strong>{permissionText(override.permission)}</strong>
                    <span>{override.effect === 'allow' ? '额外允许' : '明确拒绝'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="memberempty">没有个人例外，按岗位权限执行</p>
            )}
          </section>
        </div>

        <footer>
          <Button onPress={onClose}>关闭</Button>
          {model.capabilities.scope && member.status === 'active' ? (
            <Button tone={model.task === 'scopes' ? 'primary' : 'default'} onPress={() => openScope(model, member, onClose)}>
              设置可管理项目
            </Button>
          ) : null}
          {model.capabilities.override && member.id !== currentMembership && member.status === 'active' ? <Button onPress={() => openOverride(model, member, onClose)}>设置个人例外</Button> : null}
        </footer>
      </div>
    </Dialog>
  );
}

function roleChoices(member: AccessMembership, roles: readonly AccessRole[]): readonly AccessRole[] {
  return roles.filter((role) => role.kind === 'custom' && role.status === 'active' && !member.roles.some((assigned) => assigned.id === role.id)).sort((left, right) => roleName(left).localeCompare(roleName(right), 'zh-CN'));
}

function effectivePermissions(member: AccessMembership): Readonly<{ allows: readonly string[]; denies: readonly string[] }> {
  const denies = new Set([...member.roles.flatMap((role) => role.denies), ...member.overrides.filter((item) => item.effect === 'deny').map((item) => item.permission)]);
  const allows = [...new Set([...member.roles.flatMap((role) => role.allows), ...member.overrides.filter((item) => item.effect === 'allow').map((item) => item.permission)])].filter((permission) => !denies.has(permission));
  return Object.freeze({ allows: Object.freeze(allows), denies: Object.freeze([...denies]) });
}

function changeRole(model: AccessViewModel, member: AccessMembership, role: AccessRole, assigned: boolean, close: () => void): void {
  close();
  if (assigned) model.actions.roleRevoke(role, member);
  else model.actions.roleAssign(role, member);
}

function openScope(model: AccessViewModel, member: AccessMembership, close: () => void): void {
  close();
  model.actions.scope(member);
}

function openOverride(model: AccessViewModel, member: AccessMembership, close: () => void): void {
  close();
  model.actions.override(member);
}
