import { Button, ResourcePanel } from '@shop/design';
import { chineseReference, chineseSectionLabel } from '@shop/presentation';
import type { QualificationViewModel } from '../viewmodel/QualificationViewModel';
import { DecisionDialog } from './DecisionDialog';
import { PolicyDialog } from './PolicyDialog';
import { PolicyTable } from './PolicyTable';
import { QualificationTable } from './QualificationTable';
import { QualificationDialog } from './QualificationDialog';
import '../Qualification.css';

export function QualificationPage({ title, model }: Readonly<{ title: string; model: QualificationViewModel }>) {
  return (
    <div className="qualificationworkspace">
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('资格管理')}
        description="统一管理经营资质与购买资格策略；材料核验、影响预览、模拟决策和最终结算均由服务端执行。"
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
              <Button onPress={model.actions.create}>
                创建策略
              </Button>
            ) : null}
            {model.casework.canPublish ? <Button tone="primary" onPress={model.casework.actions.openPublish}>发布经营资质</Button> : null}
          </>
        }
        notice={
          <section className="qualificationnotice">
            <span aria-hidden="true">盾</span>
            <div>
              <strong>资质可追溯，策略不覆盖</strong>
              <p>经营资质到期或撤销后会联动交易与商品；购买策略的资源、人群和限购关系始终跟随不可变版本快照。</p>
            </div>
          </section>
        }
      >
        {model.page ? (
          <div className="featurestack">
            <QualificationTable rows={model.page.cases} model={model.casework} />
            <section className="qualificationsection" aria-labelledby="qualificationpoliciestitle">
              <header><div><p>购买规则 · 版本快照 · 权威模拟</p><h2 id="qualificationpoliciestitle">资格策略</h2></div><span>{model.page.count} 项</span></header>
            <PolicyTable rows={model.page.items} model={model} />
            </section>
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
      {model.casework.receipt ? (
        <section className="qualificationreceipt" role="status"><strong>{model.casework.receipt.state === 'revoked' ? '经营资质已撤销' : '经营资质已发布'}</strong><span>{model.casework.receipt.title} · v{model.casework.receipt.version}</span><Button onPress={model.casework.actions.dismissReceipt}>知道了</Button></section>
      ) : null}
      <PolicyDialog model={model} />
      <DecisionDialog model={model} />
      <QualificationDialog model={model.casework} />
    </div>
  );
}
