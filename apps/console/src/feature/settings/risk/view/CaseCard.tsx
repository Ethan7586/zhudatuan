import { Button } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { RiskCase, RiskCaseAction } from '../model/Risk';
import type { RiskViewModel } from '../viewmodel/RiskViewModel';

const outcomes = Object.freeze({ review: '待人工复核', deny: '已拦截' });
const reasons = Object.freeze({ policy: '策略命中', amount: '金额异常', velocity: '频次异常', signal: '风险信号', list: '名单命中' });
const states = Object.freeze({ open: '待接单', reviewing: '复核中', cleared: '已排除', confirmed: '已确认', closed: '已关闭' });

export function CaseCard({ item, model }: Readonly<{ item: RiskCase; model: RiskViewModel }>) {
  return (
    <article className="riskitem riskcase">
      <header>
        <div>
          <strong>{outcomes[item.outcome]}</strong>
          <small>
            {chineseReference('案件', item.id)} · v{item.version}
          </small>
        </div>
        <span data-tone={item.outcome === 'deny' ? 'danger' : 'warning'}>风险分 {item.score}</span>
      </header>
      <dl>
        <div>
          <dt>状态</dt>
          <dd>{states[item.state]}</dd>
        </div>
        <div>
          <dt>原因</dt>
          <dd>{reasons[item.reason]}</dd>
        </div>
        <div>
          <dt>操作人</dt>
          <dd>
            <span className="riskaccount">
              <strong>{item.actorName ?? '系统任务'}</strong>
              {item.actorMobile ? <small>{item.actorMobile}</small> : null}
            </span>
          </dd>
        </div>
        <div>
          <dt>发生时间</dt>
          <dd>{formatDate(item.createdAt)}</dd>
        </div>
      </dl>
      <details className="riskevidence">
        <summary>查看脱敏决策证据</summary>
        <pre>{JSON.stringify(item.evidence, null, 2)}</pre>
      </details>
      {model.canReview ? (
        <footer className="riskrowactions">
          {actions(item).map((action) => (
            <Button key={action} {...(action === 'confirm' ? { tone: 'danger' as const } : action === 'clear' ? { tone: 'primary' as const } : {})} onPress={() => model.actions.reviewCase(item, action)}>
              {actionLabel(action)}
            </Button>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

function actions(item: RiskCase): readonly RiskCaseAction[] {
  if (item.state === 'open') return ['accept'];
  if (item.state === 'reviewing') return ['clear', 'confirm'];
  if (item.state === 'cleared' || item.state === 'confirmed') return ['close'];
  return [];
}
function actionLabel(action: RiskCaseAction): string {
  if (action === 'accept') return '接单复核';
  if (action === 'clear') return '排除风险';
  if (action === 'confirm') return '确认风险';
  return '关闭案件';
}
