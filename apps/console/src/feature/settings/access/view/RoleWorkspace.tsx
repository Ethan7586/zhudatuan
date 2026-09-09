import { Button } from '@shop/design';
import { useState } from 'react';
import type { AccessRole } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';

export function RoleWorkspace({ model }: Readonly<{ model: AccessViewModel }>) {
  const roles = model.page?.roles ?? [];
  return (
    <section className="roleworkspace" aria-labelledby="roleworkspacetitle">
      <header>
        <div>
          <h2 id="roleworkspacetitle">岗位角色</h2>
          <p>治理角色只读；自定义角色通过模板三步创建，并在保存前复核影响。</p>
        </div>
        {model.capabilities.role ? (
          <Button tone="primary" onPress={model.actions.createRole}>
            新建角色
          </Button>
        ) : null}
      </header>
      {roles.length === 0 ? (
        <div className="roleempty" role="status">
          <strong>还没有角色</strong>
          <span>选择一个岗位模板即可开始，不需要理解权限代码。</span>
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
  const [membership, setMembership] = useState(available[0]?.id ?? '');
  const selected = available.find((member) => member.id === membership);
  return (
    <article className="rolecard">
      <header>
        <div>
          <span>{role.kind === 'owner' ? '所有者' : role.kind === 'system' ? '系统角色' : '自定义角色'}</span>
          <h3>{role.name}</h3>
          <p>{role.description || '暂无角色说明'}</p>
        </div>
        <b className={role.status === 'active' ? 'active' : 'disabled'}>{role.status === 'active' ? '已启用' : '已停用'}</b>
      </header>
      <div className="rolemetrics">
        <span>
          <strong>{role.allows.length}</strong> 项允许
        </span>
        <span>
          <strong>{role.denies.length}</strong> 项拒绝
        </span>
        <span>
          <strong>{role.affectedPeople}</strong> 位成员
        </span>
        <span>
          <strong>{role.affectedScopes}</strong> 个范围
        </span>
      </div>
      {role.members.length ? (
        <ul className="rolemembers">
          {role.members.map((member) => (
            <li key={member.membership}>
              <span>
                <strong>{member.displayName}</strong>
                <small>权限第 {member.accessVersion} 版</small>
              </span>
              {model.capabilities.role && role.kind === 'custom' ? <Button onPress={() => revokeRole(model, role, member.membership)}>撤销</Button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="roleemptyline">尚未授予任何成员</p>
      )}
      {model.capabilities.role && role.kind === 'custom' ? (
        <>
          <div className="roleassign">
            <label>
              授予成员
              <select value={membership} onChange={(event) => setMembership(event.target.value)}>
                <option value="">请选择成员</option>
                {available.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Button onPress={() => selected && model.actions.roleAssign(role, selected)} isDisabled={!selected || role.status !== 'active'}>
              授予
            </Button>
          </div>
          <footer>
            <Button onPress={() => model.actions.role(role)}>编辑角色</Button>
            <Button onPress={() => model.actions.roleStatus(role)}>{role.status === 'active' ? '停用' : '启用'}</Button>
            {role.members.length === 0 ? (
              <Button tone="danger" onPress={() => model.actions.roleDelete(role)}>
                删除
              </Button>
            ) : null}
          </footer>
        </>
      ) : null}
    </article>
  );
}

function revokeRole(model: AccessViewModel, role: AccessRole, membership: string): void {
  const target = model.page?.items.find((item) => item.id === membership);
  if (target) model.actions.roleRevoke(role, target);
}
