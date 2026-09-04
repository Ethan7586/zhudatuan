import { Button, DataTable, ResourcePanel, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseSectionLabel } from '@shop/presentation';
import { useState } from 'react';
import { AssurancePrompt } from '../../../../entity/session/AssurancePrompt';
import type { AccessMembership, AccessRole } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { OwnerTransferDialog } from './OwnerTransferDialog';
import { OverrideDialog } from './OverrideDialog';
import { RoleDialog } from './RoleDialog';
import { ScopeDialog } from './ScopeDialog';
import { accountLabel } from './TargetSummary';
import '../Access.css';

export function AccessPage({ title, model, currentMembership }: Readonly<{ title: string; model: AccessViewModel; currentMembership: string }>) {
  if (model.stepupRequired) return <AssurancePrompt title={title} description="管理员账号、角色和项目范围属于敏感信息。请先完成短信二次验证，成功后会自动返回并加载当前权限中心。" />;
  const columns: readonly DataColumn<AccessMembership>[] = [
    {
      key: 'membership',
      label: '账号',
      render: (row) => (
        <div className="accessaccount">
          <strong>{row.displayName}</strong>
          <span>{accountLabel(row)}</span>
        </div>
      ),
    },
    { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
    { key: 'roles', label: '角色', render: (row) => <div className="accessroles">{row.roles.length ? row.roles.map((role) => <span key={role.id}>{chineseDomainLabel(role.name, role.name)}</span>) : '未分配'}</div> },
    { key: 'scopes', label: '项目范围', render: (row) => `${row.scopes.length} 项` },
    { key: 'overrides', label: '覆盖权限', render: (row) => `${row.overrides.length} 项` },
    { key: 'version', label: '权限版本', render: (row) => `第 ${row.accessVersion} 版` },
    ...(model.capabilities.role || model.capabilities.override || model.capabilities.scope
      ? [{ key: 'actions', label: '操作', render: (row: AccessMembership) => <RowActions row={row} currentMembership={currentMembership} model={model} /> } satisfies DataColumn<AccessMembership>]
      : []),
  ];
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('权限中心')}
        description="统一维护管理员角色、成员覆盖权限、项目范围和所有权；默认拒绝与显式拒绝始终优先。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <div className="accessactions">
            {model.capabilities.owner ? (
              <Button tone="danger" onPress={model.actions.owner}>
                发起所有权转移
              </Button>
            ) : null}
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新'}
            </Button>
          </div>
        }
        notice={
          <section className="capabilitynote">
            <h2>关键授权已接入完整安全闭环</h2>
            <p>角色、覆盖权限、项目范围和所有权转移均要求高强度二次验证、乐观锁、稳定幂等键、另一位管理员签发的一次性凭证及提交后权威回读。所有权只有在目标方接受后才会切换。</p>
          </section>
        }
      >
        {model.page ? (
          <div className="featurestack">
            <TaskNavigation model={model} />
            {model.task === 'ownership' ? <>{model.ownership ? <OwnershipCard model={model} /> : null}{model.ownershipError ? <p className="accesserror">所有权状态暂时无法加载：{model.ownershipError}</p> : null}</> : null}
            {model.task === 'roles' ? <RoleWorkspace model={model} /> : null}
            {model.task === 'members' || model.task === 'scopes' ? <>
              <DataTable caption={model.task === 'members' ? '成员与权限' : '项目范围'} columns={columns} rows={model.page.items} rowKey={(row) => row.id} />
              <div className="pagination">
                <span>本页 {model.page.count} 条</span>
                <div>
                  {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                  {model.page.nextCursor ? <Button onPress={() => model.actions.next(model.page?.nextCursor ?? '')}>下一页</Button> : null}
                </div>
              </div>
            </> : null}
          </div>
        ) : null}
      </ResourcePanel>
      {model.receipt ? (
        <section className="accessreceipt" role="status">
          <strong>操作完成</strong>
          <span>
            {model.receipt.message} 当前版本：{model.receipt.version}
          </span>
          <small>
            请求编号 {model.receipt.requestId} · {new Date(model.receipt.occurredAt).toLocaleString('zh-CN')}
          </small>
          <Button onPress={model.actions.dismissReceipt}>知道了</Button>
        </section>
      ) : null}
      <RoleDialog model={model} />
      <OverrideDialog model={model} />
      <ScopeDialog model={model} />
      <OwnerTransferDialog model={model} />
    </>
  );
}

function TaskNavigation({ model }: Readonly<{ model: AccessViewModel }>) {
  const tasks = [
    { id: 'members' as const, title: '成员与权限', detail: '查看账号、角色与最终权限', count: model.page?.count ?? 0 },
    { id: 'roles' as const, title: '岗位角色', detail: '模板创建、影响复核与成员授予', count: model.page?.roles.length ?? 0 },
    { id: 'scopes' as const, title: '项目范围', detail: '维护商城、部门、门店等范围', count: model.page?.items.reduce((sum, item) => sum + item.scopes.length, 0) ?? 0 },
    { id: 'ownership' as const, title: '所有权转移', detail: '双向核验、冷静期与会话失效', count: model.ownership?.pending?.state === 'pending' ? 1 : 0 },
  ];
  return <nav className="accesstasks" aria-label="权限中心任务">{tasks.map((task) => <button type="button" key={task.id} aria-current={model.task === task.id ? 'page' : undefined} onClick={() => model.actions.task(task.id)}><span>{task.title}<b>{task.count}</b></span><small>{task.detail}</small></button>)}</nav>;
}

function RoleWorkspace({ model }: Readonly<{ model: AccessViewModel }>) {
  const roles = model.page?.roles ?? [];
  return <section className="roleworkspace" aria-labelledby="roleworkspacetitle">
    <header><div><h2 id="roleworkspacetitle">岗位角色</h2><p>治理角色只读；自定义角色通过模板三步创建，并在保存前复核影响。</p></div>{model.capabilities.role ? <Button tone="primary" onPress={model.actions.createRole}>新建角色</Button> : null}</header>
    {roles.length === 0 ? <div className="roleempty" role="status"><strong>还没有角色</strong><span>选择一个岗位模板即可开始，不需要理解权限代码。</span></div> : <div className="rolecards">{roles.map((role) => <RoleCard key={role.id} model={model} role={role} />)}</div>}
  </section>;
}

function RoleCard({ model, role }: Readonly<{ model: AccessViewModel; role: AccessRole }>) {
  const available = model.page?.items.filter((member) => member.status === 'active' && !role.members.some((assignment) => assignment.membership === member.id)) ?? [];
  const [membership, setMembership] = useState(available[0]?.id ?? '');
  const selected = available.find((member) => member.id === membership);
  return <article className="rolecard">
    <header><div><span>{role.kind === 'owner' ? '所有者' : role.kind === 'system' ? '系统角色' : '自定义角色'}</span><h3>{role.name}</h3><p>{role.description || '暂无角色说明'}</p></div><b className={role.status === 'active' ? 'active' : 'disabled'}>{role.status === 'active' ? '已启用' : '已停用'}</b></header>
    <div className="rolemetrics"><span><strong>{role.allows.length}</strong> 项允许</span><span><strong>{role.denies.length}</strong> 项拒绝</span><span><strong>{role.affectedPeople}</strong> 位成员</span><span><strong>{role.affectedScopes}</strong> 个范围</span></div>
    {role.members.length ? <ul className="rolemembers">{role.members.map((member) => <li key={member.membership}><span><strong>{member.displayName}</strong><small>权限第 {member.accessVersion} 版</small></span>{model.capabilities.role && role.kind === 'custom' ? <Button onPress={() => {
      const target = model.page?.items.find((item) => item.id === member.membership);
      if (target) model.actions.roleRevoke(role, target);
    }}>撤销</Button> : null}</li>)}</ul> : <p className="roleemptyline">尚未授予任何成员</p>}
    {model.capabilities.role && role.kind === 'custom' ? <>
      <div className="roleassign"><label>授予成员<select value={membership} onChange={(event) => setMembership(event.target.value)}><option value="">请选择成员</option>{available.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label><Button onPress={() => selected && model.actions.roleAssign(role, selected)} isDisabled={!selected || role.status !== 'active'}>授予</Button></div>
      <footer><Button onPress={() => model.actions.role(role)}>编辑角色</Button><Button onPress={() => model.actions.roleStatus(role)}>{role.status === 'active' ? '停用' : '启用'}</Button>{role.members.length === 0 ? <Button tone="danger" onPress={() => model.actions.roleDelete(role)}>删除</Button> : null}</footer>
    </> : null}
  </article>;
}

function OwnershipCard({ model }: Readonly<{ model: AccessViewModel }>) {
  const ownership = model.ownership;
  if (!ownership) return null;
  const pending = ownership.pending;
  return (
    <section className="accessownership" aria-label="所有权状态">
      <div>
        <span>当前所有者</span>
        <strong>{ownership.owner.displayName}</strong>
        <small>所有权第 {ownership.version} 版{ownership.mobileReady ? ' · 已具备手机验证条件' : ' · 尚未具备手机验证条件'}</small>
      </div>
      {pending ? (
        <div className="accesspending">
          <span>待接受申请</span>
          <strong>新所有者：{pending.targetDisplayName}</strong>
          <small>
            {pending.state === 'expired'
              ? '申请已过期，请刷新后重新发起'
              : model.coolingRemaining > 0
                ? `24 小时冷静期剩余 ${formatDuration(model.coolingRemaining)}`
                : '冷静期已结束，可由新所有者接受'}
            {' · '}有效期至 {new Date(pending.expiresAt).toLocaleString('zh-CN')} · 第 {pending.version} 版
          </small>
        </div>
      ) : (
        <p>当前没有待处理的所有权转移申请。</p>
      )}
      <div className="accessactions">
        {model.capabilities.ownerAccept ? (
          <Button tone="danger" onPress={model.actions.ownerAccept}>
            审核并接受
          </Button>
        ) : null}
        {model.capabilities.ownerCancel ? <Button onPress={model.actions.ownerCancel}>取消申请</Button> : null}
      </div>
    </section>
  );
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}

function RowActions({ row, currentMembership, model }: Readonly<{ row: AccessMembership; currentMembership: string; model: AccessViewModel }>) {
  return (
    <div className="accessactions">
      {model.capabilities.override && row.id !== currentMembership && row.status === 'active' ? (
        <Button tone="primary" onPress={() => model.actions.override(row)}>
          编辑权限
        </Button>
      ) : null}
      {model.capabilities.scope && row.status === 'active' ? <Button onPress={() => model.actions.scope(row)}>项目授权</Button> : null}
    </div>
  );
}
