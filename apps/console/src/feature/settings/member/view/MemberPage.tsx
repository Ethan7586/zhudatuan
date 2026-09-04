import { Button, DataTable, ResourcePanel, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { Member } from '../model/Member';
import type { MemberViewModel } from '../viewmodel/MemberViewModel';
import { memberStatusText } from '../viewmodel/MemberText';
import { ImportDialog } from './ImportDialog';
import { MemberDialog } from './MemberDialog';
import { RegistrationResetDialog } from './RegistrationResetDialog';
import '../Member.css';

export function MemberPage({ title, model }: Readonly<{ title: string; model: MemberViewModel }>) {
  const columns: readonly DataColumn<Member>[] = [
    { key: 'name', label: '成员', render: (row) => row.displayName },
    { key: 'employee', label: '员工号', render: (row) => row.employeeNo ?? '—' },
    { key: 'scope', label: '所属范围', render: (row) => chineseReference('组织范围', row.organizationId) },
    { key: 'profile', label: '档案状态', render: (row) => chineseDomainLabel(row.profileStatus) },
    { key: 'membership', label: '成员状态', render: (row) => memberStatusText(row.membershipStatus) },
    { key: 'joined', label: '加入时间', render: (row) => formatDate(row.joinedAt) },
    { key: 'version', label: '权限版本', render: (row) => `第 ${row.accessVersion} 版` },
    ...(model.canManage
      ? [
          {
            key: 'actions',
            label: '操作',
            render: (row: Member) => (
              <div className="memberactions">
                <Button onPress={() => model.actions.begin(row)}>编辑成员</Button>
                {model.canResetRegistration ? (
                  <Button tone="danger" onPress={() => model.actions.beginRegistrationReset(row)} isDisabled={!row.registrationResetAllowed}>
                    重置注册身份
                  </Button>
                ) : null}
                {model.canResetRegistration && row.registrationResetBlockReason ? <small>{registrationBlockText(row.registrationResetBlockReason)}</small> : null}
              </div>
            ),
          } satisfies DataColumn<Member>,
        ]
      : []),
  ];
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('成员管理')}
        description="成员档案、成员状态、所属范围和权限版本均来自权威成员服务。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <div className="memberactions">
            {model.canInvite ? <Button tone="primary" onPress={model.actions.inviteAfterReset}>邀请成员</Button> : null}
            {model.canImport ? (
              <Button onPress={model.actions.openImport}>
                批量导入
              </Button>
            ) : null}
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新'}
            </Button>
          </div>
        }
        notice={
          <section className="capabilitynote">
            <h2>{model.canManage ? '成员资料与状态可维护' : '当前账号只有查看权限'}</h2>
            <p>{model.canManage ? '状态和所属范围以服务端返回为准；变更具备二次验证、CSRF、稳定幂等键、目标版本、事务提交和权威回读。' : '无管理能力时写入口直接消失；页面状态不参与服务端授权。'}</p>
          </section>
        }
      >
        {model.page ? (
          <div className="featurestack">
            <DataTable caption={title} columns={columns} rows={model.page.items} rowKey={(row) => row.membershipId} />
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
      <MemberDialog model={model} />
      <RegistrationResetDialog model={model} />
      <ImportDialog model={model} />
    </>
  );
}

function registrationBlockText(reason: Member['registrationResetBlockReason']): string {
  if (reason === 'self') return '不能重置当前登录身份';
  if (reason === 'protected') return '所有者身份受保护';
  if (reason === 'inactive') return '成员身份已停用';
  if (reason === 'unbound') return '登录身份已释放';
  return '';
}
