import { Button, DataTable, ResourcePanel, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseSectionLabel } from '@shop/presentation';
import { AssurancePrompt } from '../../../../entity/session/AssurancePrompt';
import type { AccessMembership } from '../model/Access';
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
                转移所有权
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
            <p>角色、覆盖权限、项目范围和所有权转移均要求高强度二次验证、乐观锁、稳定幂等键、另一位管理员签发的一次性凭证及提交后权威回读。</p>
          </section>
        }
      >
        {model.page ? (
          <div className="featurestack">
            <DataTable caption={title} columns={columns} rows={model.page.items} rowKey={(row) => row.id} />
            <div className="pagination">
              <span>本页 {model.page.count} 条</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {model.page.nextCursor ? <Button onPress={() => model.actions.next(model.page?.nextCursor ?? '')}>下一页</Button> : null}
              </div>
            </div>
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

function RowActions({ row, currentMembership, model }: Readonly<{ row: AccessMembership; currentMembership: string; model: AccessViewModel }>) {
  const custom = row.roles.find((role) => role.kind === 'custom');
  return (
    <div className="accessactions">
      {model.capabilities.override && row.id !== currentMembership && row.status === 'active' ? (
        <Button tone="primary" onPress={() => model.actions.override(row)}>
          编辑权限
        </Button>
      ) : null}
      {model.capabilities.scope && row.status === 'active' ? <Button onPress={() => model.actions.scope(row)}>项目授权</Button> : null}
      {model.capabilities.role && custom ? <Button onPress={() => model.actions.role(row, custom)}>编辑角色</Button> : null}
    </div>
  );
}
