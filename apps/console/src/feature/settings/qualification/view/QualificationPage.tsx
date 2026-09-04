import { Button, ResourcePanel } from '@shop/design';
import { chineseReference, chineseSectionLabel } from '@shop/presentation';
import type { QualificationViewModel } from '../viewmodel/QualificationViewModel';
import { DecisionDialog } from './DecisionDialog';
import { PolicyDialog } from './PolicyDialog';
import { PolicyTable } from './PolicyTable';
import '../Qualification.css';

export function QualificationPage({ title, model }: Readonly<{ title: string; model: QualificationViewModel }>) {
  return (
    <div className="qualificationworkspace">
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('资格管理')}
        description="资格策略使用不可变版本快照；影响预览、模拟决策和最终结算均由服务端执行。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <>
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新'}
            </Button>
            {model.canPreview ? <Button onPress={model.actions.decision}>模拟决策</Button> : null}
            {model.canManage ? (
              <Button tone="primary" onPress={model.actions.create}>
                创建策略
              </Button>
            ) : null}
          </>
        }
        notice={
          <section className="qualificationnotice">
            <span aria-hidden="true">盾</span>
            <div>
              <strong>发布不覆盖，回滚也产生新版本</strong>
              <p>资源、人群与限购关系跟随版本快照完整继承；浏览器只负责呈现和发出命令，绝不作最终资格判定。</p>
            </div>
          </section>
        }
      >
        {model.page ? (
          <div className="featurestack">
            <PolicyTable rows={model.page.items} model={model} />
            <footer className="qualificationpagination">
              <span>本页 {model.page.count} 条 · 每条展示最近 20 个可回滚版本</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {model.page.nextCursor ? <Button onPress={() => model.actions.next(model.page?.nextCursor ?? '')}>下一页</Button> : null}
              </div>
            </footer>
          </div>
        ) : null}
      </ResourcePanel>
      {model.receipt ? (
        <section className="qualificationreceipt" role="status">
          <strong>{model.receipt.action === 'rollback' ? '回滚版本已发布' : '策略版本已发布'}</strong>
          <span>
            {chineseReference('策略', model.receipt.id)} · 生效 v{model.receipt.activeVersion}
            {model.receipt.sourceVersion === null ? '' : ` · 来源 v${model.receipt.sourceVersion}`}
          </span>
          <Button onPress={model.actions.dismissReceipt}>知道了</Button>
        </section>
      ) : null}
      <PolicyDialog model={model} />
      <DecisionDialog model={model} />
    </div>
  );
}
