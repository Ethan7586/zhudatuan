import { Button } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { RiskPolicy } from '../model/Risk';
import type { RiskViewModel } from '../viewmodel/RiskViewModel';

const states = Object.freeze({ active: '运行中', draft: '草稿', retired: '已停用' });
const replays = Object.freeze({ queued: '等待回放', running: '正在回放', passed: '回放通过', review: '需要复核', failed: '回放失败' });

export function PolicyCard({ item, model }: Readonly<{ item: RiskPolicy; model: RiskViewModel }>) {
  return (
    <article className="riskitem">
      <header>
        <div>
          <strong>{item.name}</strong>
          <small>
            {chineseReference('策略', item.id)} · 聚合 v{item.version}
          </small>
        </div>
        <span data-tone={item.status === 'active' ? 'success' : 'neutral'}>{states[item.status]}</span>
      </header>
      <dl>
        <div>
          <dt>生效版本</dt>
          <dd>{item.activeVersion === null ? '—' : `v${item.activeVersion}`}</dd>
        </div>
        <div>
          <dt>生效流量</dt>
          <dd>{item.rolloutPercent === null ? '—' : `${item.rolloutPercent}%`}</dd>
        </div>
        <div>
          <dt>候选版本</dt>
          <dd>{item.candidateVersion === null ? '—' : `v${item.candidateVersion}`}</dd>
        </div>
        <div>
          <dt>历史回放</dt>
          <dd>{item.replayState === null ? '尚无候选版本' : replays[item.replayState]}</dd>
        </div>
      </dl>
      {item.sampleCount === null ? null : (
        <section className="riskreplay" aria-label="候选策略历史回放">
          <strong>{item.sampleCount} 条样本</strong>
          <span>结果变化 {item.changedCount ?? 0} 条</span>
          <span>误报率 {percent(item.falsePositiveRate)}</span>
        </section>
      )}
      {item.preview === null ? null : (
        <details className="riskevidence">
          <summary>查看服务端回放摘要</summary>
          <pre>{JSON.stringify(item.preview, null, 2)}</pre>
        </details>
      )}
      {model.canWrite ? (
        <footer className="riskrowactions">
          <Button onPress={() => model.actions.revise(item)}>{item.candidateVersion === null ? '创建候选版本' : '修订候选版本'}</Button>
          {item.candidateVersion !== null && item.replayState === 'passed' ? (
            <Button tone="primary" onPress={() => model.actions.activate(item)}>
              核对并激活
            </Button>
          ) : null}
          {item.status !== 'retired' ? (
            <Button tone="danger" onPress={() => model.actions.retire(item)}>
              停用
            </Button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(2)}%`;
}
