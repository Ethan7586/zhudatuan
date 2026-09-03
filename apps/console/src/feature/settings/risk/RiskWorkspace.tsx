import type { OperationOutputFor } from '@shop/contract';
import { chineseReference } from '@shop/presentation';

type RiskPage = OperationOutputFor<'risk.center.read'>;
type RiskItem = RiskPage['items'][number];

const policyStatus: Readonly<Record<string, string>> = Object.freeze({ active: '运行中', draft: '草稿', retired: '已停用' });
const replayStatus: Readonly<Record<string, string>> = Object.freeze({ queued: '等待回放', running: '正在回放', passed: '回放通过', review: '需要复核', failed: '回放失败' });
const outcomeLabel: Readonly<Record<string, string>> = Object.freeze({ review: '待人工复核', deny: '已拦截', challenge: '需要验证', allow: '已放行' });
const reasonLabel: Readonly<Record<string, string>> = Object.freeze({ policy: '策略命中', amount: '金额异常', velocity: '频次异常', signal: '风险信号', list: '名单命中' });

export function RiskWorkspace({ data }: Readonly<{ data: RiskPage }>) {
  const policies = data.items.filter((item) => item.kind === 'policy');
  const cases = data.items.filter((item) => item.kind === 'case');
  const active = policies.filter((item) => item.status === 'active').length;
  const blocked = cases.filter((item) => item.outcome === 'deny').length;
  const needsAttention = policies.filter((item) => item.replay_state === 'review' || item.replay_state === 'failed').length;
  return (
    <div className="riskworkspace">
      <section className="riskhero" aria-labelledby="riskhero-title">
        <div>
          <p className="eyebrow">当前治理态势</p>
          <h2 id="riskhero-title">风险边界清晰，异常处置有据可循</h2>
          <p>策略发布前先回放，风险事件进入复核队列；所有敏感读取与治理动作均受安全等级、权限和审计约束。</p>
        </div>
        <span className={needsAttention > 0 ? 'riskhealth isattention' : 'riskhealth'}>
          <i aria-hidden="true" />
          {needsAttention > 0 ? `${needsAttention} 项策略需要关注` : '治理链路运行正常'}
        </span>
      </section>

      <section className="riskmetrics" aria-label="治理指标">
        <RiskMetric label="风险策略" value={policies.length} detail="当前范围内全部策略" />
        <RiskMetric label="运行中" value={active} detail="正在参与实时决策" tone="success" />
        <RiskMetric label="待复核事件" value={cases.length} detail="需要人工判断的事件" tone={cases.length > 0 ? 'warning' : 'neutral'} />
        <RiskMetric label="当前页已拦截" value={blocked} detail="由策略拒绝的事件" tone={blocked > 0 ? 'danger' : 'neutral'} />
      </section>

      <div className="riskcolumns">
        <section className="risksection" aria-labelledby="riskpolicy-title">
          <header>
            <div>
              <p className="eyebrow">风险策略</p>
              <h2 id="riskpolicy-title">策略运行态</h2>
            </div>
            <span>{policies.length} 项</span>
          </header>
          {policies.length === 0 ? (
            <RiskEmpty title="暂无自定义风险策略" description="当前范围尚未发布自定义策略。默认拒绝、权限校验和关键操作二次验证仍会持续生效。" />
          ) : (
            <div className="risklist">
              {policies.map((item) => (
                <PolicyCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="risksection" aria-labelledby="riskcase-title">
          <header>
            <div>
              <p className="eyebrow">复核队列</p>
              <h2 id="riskcase-title">事件复核队列</h2>
            </div>
            <span>{cases.length} 项</span>
          </header>
          {cases.length === 0 ? (
            <RiskEmpty title="暂无待复核风险事件" description="当前范围没有待处置事件。系统会继续记录策略命中、风险分数和证据，出现异常时自动进入这里。" />
          ) : (
            <div className="risklist">
              {cases.map((item) => (
                <CaseCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="riskguardrails" aria-labelledby="riskguardrails-title">
        <header>
          <p className="eyebrow">治理保障</p>
          <h2 id="riskguardrails-title">治理安全边界</h2>
        </header>
        <div>
          <Guardrail index="01" title="默认拒绝" description="未授权、范围不匹配或能力未开放时，服务端直接拒绝请求。" />
          <Guardrail index="02" title="发布前回放" description="候选策略必须完成历史样本回放，再由有权人员决定是否发布。" />
          <Guardrail index="03" title="全链路留痕" description="风险决定、复核结论和通知通过权威记录与审计事件关联。" />
        </div>
      </section>
    </div>
  );
}

function RiskMetric({ label, value, detail, tone = 'neutral' }: Readonly<{ label: string; value: number; detail: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }>) {
  return (
    <article className={`riskmetric is${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PolicyCard({ item }: Readonly<{ item: RiskItem }>) {
  const status = item.status === null ? '状态未知' : (policyStatus[item.status] ?? '待识别状态');
  const replay = item.replay_state === null ? '尚无候选版本' : (replayStatus[item.replay_state] ?? '待识别状态');
  return (
    <article className="riskitem">
      <header>
        <div>
          <strong>{item.name ?? '未命名策略'}</strong>
          <small>{chineseReference('策略', item.id)}</small>
        </div>
        <span data-tone={item.status === 'active' ? 'success' : 'neutral'}>{status}</span>
      </header>
      <dl>
        <div>
          <dt>生效版本</dt>
          <dd>{item.active_version === null ? '—' : `第 ${item.active_version} 版`}</dd>
        </div>
        <div>
          <dt>流量比例</dt>
          <dd>{item.rollout_percent === null ? '—' : `${item.rollout_percent}%`}</dd>
        </div>
        <div>
          <dt>候选版本</dt>
          <dd>{item.candidate_version === null ? '—' : `第 ${item.candidate_version} 版`}</dd>
        </div>
        <div>
          <dt>回放状态</dt>
          <dd>{replay}</dd>
        </div>
      </dl>
      {item.sample_count === null ? null : (
        <p>
          回放样本 {item.sample_count} 条 · 结果变化 {item.changed_count ?? 0} 条 · 误报率 {percent(item.false_positive_rate)}
        </p>
      )}
    </article>
  );
}

function CaseCard({ item }: Readonly<{ item: RiskItem }>) {
  return (
    <article className="riskitem riskcase">
      <header>
        <div>
          <strong>{item.outcome === null ? '风险事件' : (outcomeLabel[item.outcome] ?? '待识别结果')}</strong>
          <small>{chineseReference('风险事件', item.id)}</small>
        </div>
        <span data-tone={item.outcome === 'deny' ? 'danger' : 'warning'}>风险分 {item.score ?? 0}</span>
      </header>
      <dl>
        <div>
          <dt>原因</dt>
          <dd>{item.safe_reason === null ? '待补充' : (reasonLabel[item.safe_reason] ?? '待补充说明')}</dd>
        </div>
        <div>
          <dt>操作人</dt>
          <dd>{chineseReference('操作人', item.actor_id)}</dd>
        </div>
        <div>
          <dt>决策记录</dt>
          <dd>{chineseReference('决策记录', item.decision_id)}</dd>
        </div>
        <div>
          <dt>发生时间</dt>
          <dd>{formatTime(item.created_at)}</dd>
        </div>
      </dl>
    </article>
  );
}

function RiskEmpty({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div className="riskempty">
      <span aria-hidden="true">✓</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Guardrail({ index, title, description }: Readonly<{ index: string; title: string; description: string }>) {
  return (
    <article>
      <span>{index}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(2)}%`;
}
function formatTime(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}
