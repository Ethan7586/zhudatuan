import type { RiskCase, RiskPolicy } from '../model/Risk';
import type { RiskViewModel } from '../viewmodel/RiskViewModel';
import { CaseCard } from './CaseCard';
import { PolicyCard } from './PolicyCard';

export function RiskWorkspace({ model }: Readonly<{ model: RiskViewModel }>) {
  const policies = model.page?.items.filter((item): item is RiskPolicy => item.kind === 'policy') ?? [];
  const cases = model.page?.items.filter((item): item is RiskCase => item.kind === 'case') ?? [];
  const attention = policies.filter((item) => item.replayState === 'review' || item.replayState === 'failed').length;
  return (
    <div className="riskworkspace">
      <section className="riskhero" aria-labelledby="riskherotitle">
        <div>
          <p className="eyebrow">当前治理态势</p>
          <h2 id="riskherotitle">风险边界清晰，异常处置有据可循</h2>
          <p>候选策略先回放、后复核、再激活；风险案件按状态机处置，敏感读取与治理动作均受权限、安全等级和审计约束。</p>
        </div>
        <span className={attention > 0 ? 'riskhealth isattention' : 'riskhealth'}>
          <i aria-hidden="true" />
          {attention > 0 ? `${attention} 项回放需要关注` : '治理链路运行正常'}
        </span>
      </section>
      <section className="riskmetrics" aria-label="治理指标">
        <RiskMetric label="风险策略" value={policies.length} detail="当前页全部策略" />
        <RiskMetric label="运行中" value={policies.filter((item) => item.status === 'active').length} detail="正在参与实时决策" tone="success" />
        <RiskMetric label="待处置案件" value={cases.filter((item) => item.state !== 'closed').length} detail="需要人工判断" tone={cases.some((item) => item.state !== 'closed') ? 'warning' : 'neutral'} />
        <RiskMetric label="拦截事件" value={cases.filter((item) => item.outcome === 'deny').length} detail="当前页自动拒绝" tone="danger" />
      </section>
      <div className="riskcolumns">
        <RiskSection title="策略运行态" count={policies.length}>
          {policies.length === 0 ? (
            <RiskEmpty title="暂无风险策略" description="默认拒绝、权限校验和关键操作二次验证仍持续生效。" />
          ) : (
            <div className="risklist">
              {policies.map((item) => (
                <PolicyCard key={item.id} item={item} model={model} />
              ))}
            </div>
          )}
        </RiskSection>
        <RiskSection title="事件复核队列" count={cases.length}>
          {cases.length === 0 ? (
            <RiskEmpty title="暂无风险案件" description="系统继续记录规则命中、风险分数和脱敏证据，异常会自动进入队列。" />
          ) : (
            <div className="risklist">
              {cases.map((item) => (
                <CaseCard key={item.id} item={item} model={model} />
              ))}
            </div>
          )}
        </RiskSection>
      </div>
      <section className="riskguardrails" aria-labelledby="riskguardrailstitle">
        <header>
          <p className="eyebrow">治理保障</p>
          <h2 id="riskguardrailstitle">每一步都可验证、可拒绝、可追溯</h2>
        </header>
        <div>
          <Guardrail index="01" title="范围隔离" description="所有读写由服务端范围策略裁剪，页面不自行推断权限。" />
          <Guardrail index="02" title="先回放后激活" description="候选策略必须完成历史样本回放，失败或待复核时不提供激活入口。" />
          <Guardrail index="03" title="双人复核" description="高风险命令绑定完整请求和版本，由不同管理员复核并一次性执行。" />
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
function RiskSection({ title, count, children }: Readonly<{ title: string; count: number; children: React.ReactNode }>) {
  return (
    <section className="risksection">
      <header>
        <div>
          <p className="eyebrow">权威数据</p>
          <h2>{title}</h2>
        </div>
        <span>{count} 项</span>
      </header>
      {children}
    </section>
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
