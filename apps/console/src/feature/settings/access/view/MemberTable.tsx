import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel } from '@shop/presentation';
import type { AccessMembership } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { accountLabel } from './TargetSummary';

export function MemberTable({ model, currentMembership }: Readonly<{ model: AccessViewModel; currentMembership: string }>) {
  const page = model.page;
  if (!page) return null;
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
      <DataTable caption={model.task === 'members' ? '成员与权限' : '项目范围'} columns={columns} rows={page.items} rowKey={(row) => row.id} />
      <div className="pagination">
        <span>本页 {page.count} 条</span>
        <div>
          {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
          {page.nextCursor ? <Button onPress={() => model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}
        </div>
      </div>
    </>
  );
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
