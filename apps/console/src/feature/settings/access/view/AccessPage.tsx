import { Button, JourneyGuide, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import { AssurancePrompt } from '../../../../entity/session/AssurancePrompt';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { MemberTable } from './MemberTable';
import { OwnerTransferDialog } from './OwnerTransferDialog';
import { OverrideDialog } from './OverrideDialog';
import { RoleDialog } from './RoleDialog';
import { RoleWorkspace } from './RoleWorkspace';
import { ScopeDialog } from './ScopeDialog';
import { OwnershipCard, TaskNavigation } from './AccessTasks';
import '../Access.css';

const accessJourney = Object.freeze([
  Object.freeze({ title: '选择管理任务', detail: '先选择成员、岗位、项目或所有权' }),
  Object.freeze({ title: '查看变更影响', detail: '确认新增、移除、范围和职责冲突' }),
  Object.freeze({ title: '验证后生效', detail: '核验身份并提交，完成后自动刷新结果' }),
]);

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
            <JourneyGuide eyebrow="安全变更流程" title="每次权限调整都分三步完成" steps={accessJourney} footer={<p>所有权交接必须由新所有者接受；接受前，当前权限不会改变。</p>} />
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
