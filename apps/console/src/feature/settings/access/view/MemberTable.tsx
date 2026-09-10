import { Button, DataTable, type DataColumn } from '@shop/design';
import { useMemo, useState } from 'react';
import { accountLabel, membershipStatusLabel, roleName } from '../AccessText';
import type { AccessMembership } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { MemberDetails } from './MemberDetails';

export function MemberTable({ model, currentMembership }: Readonly<{ model: AccessViewModel; currentMembership: string }>) {
  const page = model.page;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('zh-CN');
    if (!search || !page) return page?.items ?? [];
    return page.items.filter((row) => `${row.displayName} ${row.employeeNo ?? ''} ${row.mobileMasked ?? ''} ${row.roles.map((role) => role.name).join(' ')}`.toLocaleLowerCase('zh-CN').includes(search));
  }, [page, query]);
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
    {
      key: 'status',
      label: '使用状态',
      render: (row) => (
        <span className="accessstatus" data-status={row.status}>
          {membershipStatusLabel(row.status)}
        </span>
      ),
    },
    { key: 'roles', label: '岗位角色', render: (row) => <div className="accessroles">{row.roles.length ? row.roles.map((role) => <span key={role.id}>{roleName(role)}</span>) : <span className="unassigned">未分配岗位</span>}</div> },
    { key: 'scopes', label: '可管理项目', render: (row) => (row.scopes.length ? `${row.scopes.length} 个` : '无额外范围') },
    { key: 'overrides', label: '个人例外', render: (row) => (row.overrides.length ? `${row.overrides.length} 项` : '无') },
    { key: 'actions', label: '操作', render: (row) => <Button onPress={() => setSelected(row.id)}>查看与调整</Button> },
  ];
  const member = page.items.find((item) => item.id === selected);
  return (
    <section className="accessmembers" aria-labelledby="accessmemberstitle">
      <header>
        <div>
          <span>{model.task === 'members' ? '成员与权限' : '项目范围'}</span>
          <h2 id="accessmemberstitle">{model.task === 'members' ? '先找到需要授权的成员' : '按成员设置可管理项目'}</h2>
          <p>{model.task === 'members' ? '打开成员详情即可看清岗位、功能权限、项目范围与个人例外。' : '先选择成员，再限定其可以管理的商城、门店或其他业务范围。'}</p>
        </div>
        <label>
          搜索成员
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、手机号或岗位" />
        </label>
      </header>
      {rows.length ? (
        <DataTable caption={model.task === 'members' ? '成员与权限列表' : '成员项目范围列表'} columns={columns} rows={rows} rowKey={(row) => row.id} />
      ) : (
        <div className="accessmemberempty" role="status">
          <strong>没有找到匹配的成员</strong>
          <span>可尝试输入姓名、手机号后四位或岗位名称。</span>
        </div>
      )}
      <div className="pagination">
        <span>
          显示 {rows.length} 位，本页共 {page.count} 位
        </span>
        <div>
          {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
          {page.nextCursor ? <Button onPress={() => model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}
        </div>
      </div>
      {member ? <MemberDetails member={member} currentMembership={currentMembership} model={model} onClose={() => setSelected(undefined)} /> : null}
    </section>
  );
}
