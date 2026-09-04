import { Button, ResourcePanel } from '@shop/design';
import { chineseReference, chineseSectionLabel } from '@shop/presentation';
import type { RiskViewModel } from '../viewmodel/RiskViewModel';
import { RiskDialog } from './RiskDialog';
import { RiskWorkspace } from './RiskWorkspace';
import '../Risk.css';
import '../RiskEmpty.css';
import '../RiskGuardrails.css';
import '../RiskActions.css';

export function RiskPage({ title, notificationHref, model }: Readonly<{ title: string; notificationHref?: string; model: RiskViewModel }>) {
  return (
    <div className="riskpage">
      <ResourcePanel
        eyebrow={chineseSectionLabel('系统治理')}
        title={title}
        description="集中管理风险策略、历史样本回放与风险案件；页面只消费当前范围的权威读模型。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <>
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新治理状态'}
            </Button>
            {notificationHref ? (
              <a className="risknotificationlink" href={notificationHref}>
                进入通知管理
              </a>
            ) : null}
            {model.mallWrite ? (
              <Button tone="primary" onPress={model.actions.create}>
                新建候选策略
              </Button>
            ) : null}
          </>
        }
        notice={
          model.groupBoundary ? (
            <section className="riskboundary">
              <strong>集团风险写入暂不开放</strong>
              <p>集团层策略对象、作用范围和审批权限仍是 MVP 阻断澄清项；真实读模型继续保留，写入口直接隐藏，不以禁用按钮假装完成。商城范围的已确认治理能力不受影响。</p>
            </section>
          ) : undefined
        }
      >
        {model.page ? (
          <>
            <RiskWorkspace model={model} />
            <footer className="riskpagination">
              <span>本页 {model.page.count} 条</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {model.page.nextCursor ? <Button onPress={() => model.actions.next(model.page?.nextCursor ?? '')}>下一页</Button> : null}
              </div>
            </footer>
          </>
        ) : null}
      </ResourcePanel>
      {model.receipt ? (
        <section className="riskreceipt" role="status">
          <strong>{model.receipt.kind === 'policy' ? '策略命令已完成' : '案件处置已完成'}</strong>
          <span>
            {chineseReference(model.receipt.kind === 'policy' ? '策略' : '案件', model.receipt.id)} · 聚合 v{model.receipt.version} · 状态 {model.receipt.state}
          </span>
          <Button onPress={model.actions.dismissReceipt}>知道了</Button>
        </section>
      ) : null}
      <RiskDialog model={model} />
    </div>
  );
}
