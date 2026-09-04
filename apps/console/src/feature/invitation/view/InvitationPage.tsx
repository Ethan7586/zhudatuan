import { Button, DataTable, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { InvitationViewModel } from '../viewmodel/InvitationViewModel';
import { CampaignInvitationDialog } from './CampaignInvitationDialog';
import { EmployeeInvitationDialog } from './EmployeeInvitationDialog';
import { InvitationReceiptDialog } from './InvitationReceiptDialog';
import { InvitationRevokeDialog } from './InvitationRevokeDialog';
import { invitationColumns } from './InvitationTable';
import { SigninInvitationDialog } from './SigninInvitationDialog';
import './Invitation.css';

export function InvitationPage({ title, model }: Readonly<{ title: string; model: InvitationViewModel }>) {
  const error = model.error === undefined ? {} : { error: model.error };
  const columns = invitationColumns(model.canRevoke, model.actions.openRevoke);
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('员工邀请')}
        description="创建员工注册、共享注册和指定成员登录邀请。邀请码只在创建成功后显示一次。"
        condition={model.condition}
        {...error}
        retry={model.actions.refresh}
        actions={<InvitationToolbar model={model} />}
        notice={
          <section className="capabilitynote">
            <h2>{model.boundary.title}</h2>
            <p>{model.boundary.message}</p>
            {model.membershipError ? (
              <p className="invitationerror" role="alert">
                成员范围读取失败：{model.membershipError}
              </p>
            ) : null}
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
      <EmployeeInvitationDialog
        open={model.createKind === 'employee'}
        targets={model.storefronts}
        departments={model.departments}
        busy={model.createBusy}
        {...(model.createError ? { error: model.createError } : {})}
        onClose={model.actions.closeCreate}
        onSubmit={model.actions.create}
      />
      <CampaignInvitationDialog
        open={model.createKind === 'campaign'}
        targets={model.storefronts}
        busy={model.createBusy}
        {...(model.createError ? { error: model.createError } : {})}
        onClose={model.actions.closeCreate}
        onSubmit={model.actions.create}
      />
      <SigninInvitationDialog
        open={model.createKind === 'signin'}
        memberships={model.memberships}
        busy={model.createBusy}
        {...(model.createError ? { error: model.createError } : {})}
        onClose={model.actions.closeCreate}
        onSubmit={model.actions.create}
      />
      <InvitationReceiptDialog {...(model.receipt === undefined ? {} : { receipt: model.receipt })} organization={model.organization} onDiscard={model.actions.discardReceipt} />
      <InvitationRevokeDialog
        {...(model.revoking === undefined ? {} : { invitation: model.revoking })}
        busy={model.revokeBusy}
        {...(model.revokeError ? { error: model.revokeError } : {})}
        onClose={model.actions.closeRevoke}
        onSubmit={model.actions.revoke}
      />
    </>
  );
}

function InvitationToolbar({ model }: Readonly<{ model: InvitationViewModel }>) {
  return (
    <div className="invitationtoolbar">
      <label>
        位置
        <select value={model.filter.target ?? ''} onChange={(event) => model.actions.updateFilter('target', event.target.value)}>
          <option value="">全部</option>
          <option value="storefront">员工商城</option>
          <option value="console">管理控制台</option>
        </select>
      </label>
      <label>
        类型
        <select value={model.filter.kind ?? ''} onChange={(event) => model.actions.updateFilter('kind', event.target.value)}>
          <option value="">全部</option>
          <option value="enrollment">员工注册</option>
          <option value="campaign">共享注册</option>
          <option value="signin">登录邀请</option>
        </select>
      </label>
      <label>
        状态
        <select value={model.filter.status ?? ''} onChange={(event) => model.actions.updateFilter('status', event.target.value)}>
          <option value="">全部</option>
          <option value="active">生效中</option>
          <option value="exhausted">已用尽</option>
          <option value="revoked">已撤销</option>
          <option value="expired">已过期</option>
        </select>
      </label>
      {model.canIssue ? (
        <>
          <Button tone="primary" onPress={() => model.actions.openCreate('employee')} isDisabled={model.storefronts.length === 0 || model.assurance < 2}>
            邀请员工
          </Button>
          <Button onPress={() => model.actions.openCreate('signin')} isDisabled={model.assurance < 3 || !model.membershipsReady}>
            登录邀请
          </Button>
          <Button onPress={() => model.actions.openCreate('campaign')} isDisabled={model.storefronts.length === 0 || model.assurance < 3}>
            共享邀请
          </Button>
        </>
      ) : null}
      <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
        {model.fetching ? '正在刷新…' : '刷新'}
      </Button>
    </div>
  );
}
