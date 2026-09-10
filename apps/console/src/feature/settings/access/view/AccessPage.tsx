import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import { AssurancePrompt } from '../../../../entity/session/AssurancePrompt';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { AccessGuide } from './AccessGuide';
import { MemberTable } from './MemberTable';
import { OwnerTransferDialog } from './OwnerTransferDialog';
import { OverrideDialog } from './OverrideDialog';
import { RoleDialog } from './RoleDialog';
import { RoleWorkspace } from './RoleWorkspace';
import { ScopeDialog } from './ScopeDialog';
import { TechnicalDetails } from './TechnicalDetails';
import { OwnershipCard, TaskNavigation } from './AccessTasks';
import '../Access.css';

export function AccessPage({ title, model, currentMembership }: Readonly<{ title: string; model: AccessViewModel; currentMembership: string }>) {
  if (model.stepupRequired) return <AssurancePrompt title={title} description="管理员账号、角色和项目范围属于敏感信息。请先完成短信二次验证，成功后会自动返回并加载当前权限中心。" />;
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('权限中心')}
        description="统一管理谁能做什么、可以管理哪些项目，并安全完成最高管理权限交接。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <div className="accessactions">
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新'}
            </Button>
          </div>
        }
      >
        {model.page ? (
          <div className="featurestack">
            <TaskNavigation model={model} />
            {model.task === 'ownership' ? null : <AccessGuide task={model.task} />}
            {model.task === 'ownership' ? (
              <>
                {model.ownership ? <OwnershipCard model={model} /> : null}
                {model.ownershipError ? <p className="accesserror">所有权状态暂时无法加载：{model.ownershipError}</p> : null}
              </>
            ) : null}
            {model.task === 'roles' ? <RoleWorkspace model={model} /> : null}
            {model.task === 'members' || model.task === 'scopes' ? <MemberTable model={model} currentMembership={currentMembership} /> : null}
          </div>
        ) : null}
      </ResourcePanel>
      {model.receipt ? (
        <section className="accessreceipt" role="status">
          <strong>操作完成</strong>
          <span>{model.receipt.message}</span>
          <small>{new Date(model.receipt.occurredAt).toLocaleString('zh-CN')}</small>
          <TechnicalDetails
            facts={[
              { label: '请求编号', value: <code>{model.receipt.requestId}</code> },
              { label: '结果版本', value: `第 ${model.receipt.version} 版` },
            ]}
          />
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
