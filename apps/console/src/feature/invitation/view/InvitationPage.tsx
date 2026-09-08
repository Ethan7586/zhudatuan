import { Button, DataTable, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { InvitationViewModel } from '../viewmodel/InvitationViewModel';
import { CampaignInvitationDialog } from './CampaignInvitationDialog';
import { EmployeeInvitationDialog } from './EmployeeInvitationDialog';
import { InvitationChoiceDialog } from './InvitationChoiceDialog';
import { InvitationFilters } from './InvitationFilters';
import { InvitationGuide } from './InvitationGuide';
import { InvitationReceiptDialog } from './InvitationReceiptDialog';
import { InvitationRevokeDialog } from './InvitationRevokeDialog';
import { invitationColumns } from './InvitationTable';
import { SigninInvitationDialog } from './SigninInvitationDialog';
import './Invitation.css';
import './InvitationFlow.css';
import './InvitationResponsive.css';

export function InvitationPage({ title, model }: Readonly<{ title: string; model: InvitationViewModel }>) {
  const error = model.error === undefined ? {} : { error: model.error };
  const columns = invitationColumns(model.canRevoke, model.actions.openRevoke);
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('邀请管理')}
        description="统一创建、交付和跟踪邀请。新员工完成注册；已有成员仅完成一次性身份确认。"
        condition={model.condition}
        {...error}
        retry={model.actions.refresh}
        actions={<InvitationToolbar model={model} />}
        notice={<InvitationNotice model={model} />}
      >
        {model.page ? (
          <div className="featurestack">
            <InvitationFilters model={model} />
            <div className="invitationrecords">
              <DataTable caption={title} columns={columns} rows={model.page.items} rowKey={(row) => row.id} />
            </div>
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
      <InvitationChoiceDialog
        open={model.createKind === 'choice'}
        assurance={model.assurance}
        hasStorefronts={model.storefronts.length > 0}
        membershipsReady={model.membershipsReady}
        membershipCount={model.memberships.length}
        onClose={model.actions.closeCreate}
        onChoose={model.actions.openCreate}
      />
      <EmployeeInvitationDialog
        open={model.createKind === 'employee'}
        targets={model.storefronts}
        departments={model.departments}
        busy={model.createBusy}
        {...(model.createError ? { error: model.createError } : {})}
        onClose={model.actions.closeCreate}
        onBack={model.actions.openChoice}
        onSubmit={model.actions.create}
      />
      <CampaignInvitationDialog
        open={model.createKind === 'campaign'}
        targets={model.storefronts}
        busy={model.createBusy}
        {...(model.createError ? { error: model.createError } : {})}
        onClose={model.actions.closeCreate}
        onBack={model.actions.openChoice}
        onSubmit={model.actions.create}
      />
      <SigninInvitationDialog
        open={model.createKind === 'signin'}
        memberships={model.memberships}
        busy={model.createBusy}
        {...(model.createError ? { error: model.createError } : {})}
        onClose={model.actions.closeCreate}
        onBack={model.actions.openChoice}
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
    <div className="invitationcommands">
      {model.canIssue ? (
        <Button tone="primary" onPress={model.actions.openChoice}>
          新建邀请
        </Button>
      ) : null}
      <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
        {model.fetching ? '正在刷新…' : '刷新'}
      </Button>
    </div>
  );
}

function InvitationNotice({ model }: Readonly<{ model: InvitationViewModel }>) {
  return (
    <div className="invitationnotices">
      <InvitationGuide />
      <section className="capabilitynote">
        <h2>{model.boundary.title}</h2>
        <p>{model.boundary.message}</p>
        {model.membershipError ? (
          <p className="invitationerror" role="alert">
            成员范围读取失败：{model.membershipError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
