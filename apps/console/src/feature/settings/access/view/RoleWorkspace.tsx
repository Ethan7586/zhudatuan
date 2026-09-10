import { Button } from '@shop/design';
import { useState } from 'react';
import { roleDescription, roleKindLabel, roleName } from '../AccessText';
import type { AccessRole } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { PermissionSummary } from './PermissionSummary';
import { TechnicalDetails } from './TechnicalDetails';

export function RoleWorkspace({ model }: Readonly<{ model: AccessViewModel }>) {
  const roles = model.page?.roles ?? [];
  return (
    <section className="roleworkspace" aria-labelledby="roleworkspacetitle">
      <header>
        <div>
          <span>岗位角色</span>
          <h2 id="roleworkspacetitle">一处配置，多人复用</h2>
          <p>先按工作职责配置岗位，再把岗位分配给成员。个人例外只处理少数特殊情况。</p>
        </div>
        {model.capabilities.role ? (
          <Button tone="primary" onPress={model.actions.createRole}>
            新建岗位角色
          </Button>
        ) : null}
      </header>
      <aside className="rolerelation" aria-label="岗位授权关系">
        <span>
          <b>岗位角色</b>
          <small>定义日常职责</small>
        </span>
        <i aria-hidden="true">→</i>
        <span>
          <b>功能权限</b>
          <small>决定可以做什么</small>
        </span>
        <i aria-hidden="true">→</i>
        <span>
          <b>成员</b>
          <small>多人复用同一岗位</small>
        </span>
      </aside>
      {roles.length === 0 ? (
        <div className="roleempty" role="status">
          <strong>还没有岗位角色</strong>
          <span>从最接近的岗位模板开始，不需要理解权限代码。</span>
          {model.capabilities.role ? (
            <Button tone="primary" onPress={model.actions.createRole}>
              新建第一个岗位
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="rolecards">
          {roles.map((role) => (
            <RoleCard key={role.id} model={model} role={role} />
          ))}
        </div>
      )}
    </section>
  );
}

function RoleCard({ model, role }: Readonly<{ model: AccessViewModel; role: AccessRole }>) {
  const available = model.page?.items.filter((member) => member.status === 'active' && !role.members.some((assignment) => assignment.membership === member.id)) ?? [];
  const [memberId, setMemberId] = useState(available[0]?.id ?? '');
  const selected = available.find((member) => member.id === memberId);
  const changeable = model.capabilities.role && role.kind === 'custom';
  return (
    <article className="rolecard">
      <header>
        <div>
          <span>{roleKindLabel(role.kind)}</span>
          <h3>{roleName(role)}</h3>
          <p>{roleDescription(role)}</p>
        </div>
        <b className={role.status === 'active' ? 'active' : 'disabled'}>{role.status === 'active' ? '使用中' : '已停用'}</b>
      </header>
      <div className="rolemetrics">
        <span>
          <strong>{role.affectedPeople}</strong> 位成员
        </span>
        <span>
          <strong>{role.allows.length + role.denies.length}</strong> 项权限规则
        </span>
        <span>
          <strong>{role.affectedScopes}</strong> 个生效范围
        </span>
      </div>
      <PermissionSummary allows={role.allows} denies={role.denies} owner={role.kind === 'owner'} />
      <section className="rolepeople" aria-label={`${roleName(role)}的成员`}>
        <header>
          <strong>已分配成员</strong>
          <span>{role.members.length} 位</span>
        </header>
        {role.members.length ? (
          <ul className="rolemembers">
            {role.members.map((member) => (
              <li key={member.membership}>
                <strong>{member.displayName}</strong>
                {changeable ? (
                  <Button tone="quiet" onPress={() => revokeRole(model, role, member.membership)}>
                    撤销岗位
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="roleemptyline">尚未分配成员</p>
        )}
      </section>
      {changeable ? (
        <details className="roleassignment">
          <summary>分配成员到此岗位</summary>
          {available.length ? (
            <div>
              <label>
                选择成员
                <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                  {available.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <Button tone="primary" onPress={() => selected && model.actions.roleAssign(role, selected)} isDisabled={!selected || role.status !== 'active'}>
                确认分配
              </Button>
            </div>
          ) : (
            <p>所有可用成员都已分配到此岗位。</p>
          )}
        </details>
      ) : (
        <p className="rolereadonly">{role.kind === 'owner' ? '最高管理员只能通过“所有权交接”变更。' : '系统岗位由账号用途自动维护，无需手动调整。'}</p>
      )}
      <TechnicalDetails
        facts={[
          { label: '岗位标识', value: <code>{role.id}</code> },
          { label: '岗位版本', value: `第 ${role.version} 版` },
        ]}
      />
      {changeable ? (
        <footer>
          <Button tone="primary" onPress={() => model.actions.role(role)}>
            调整岗位权限
          </Button>
          <Button onPress={() => model.actions.roleStatus(role)}>{role.status === 'active' ? '停用岗位' : '启用岗位'}</Button>
          {role.members.length === 0 ? (
            <Button tone="danger" onPress={() => model.actions.roleDelete(role)}>
              删除岗位
            </Button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function revokeRole(model: AccessViewModel, role: AccessRole, memberId: string): void {
  const target = model.page?.items.find((item) => item.id === memberId);
  if (target) model.actions.roleRevoke(role, target);
}
