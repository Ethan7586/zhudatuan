import { formatCount } from '../../../../shared/ui/Format';
import type { PolicyImpact } from '../model/Policy';

export function ImpactPanel({ impact }: Readonly<{ impact: PolicyImpact }>) {
  return (
    <section className="qualificationimpact" aria-labelledby="qualificationimpacttitle">
      <header>
        <div>
          <p>服务端只读分析</p>
          <h3 id="qualificationimpacttitle">{impact.action === 'rollback' ? `将历史 v${impact.sourceVersion} 复制为 v${impact.nextVersion}` : `将发布 v${impact.nextVersion}`}</h3>
        </div>
        <span>当前 {impact.currentVersion === null ? '无版本' : `v${impact.currentVersion}`}</span>
      </header>
      <div className="qualificationmetrics">
        <article>
          <span>潜在成员</span>
          <strong>{formatCount(impact.potentialProfiles)}</strong>
          <small>当前范围内保守上界</small>
        </article>
        <article>
          <span>资源约束</span>
          <strong>{formatCount(impact.resourceCount)}</strong>
          <small>随快照完整继承</small>
        </article>
        <article>
          <span>人群约束</span>
          <strong>{formatCount(impact.subjectCount)}</strong>
          <small>随快照完整继承</small>
        </article>
        <article>
          <span>限购约束</span>
          <strong>{formatCount(impact.limitCount)}</strong>
          <small>随快照完整继承</small>
        </article>
      </div>
      <dl className="qualificationdiff">
        <div>
          <dt>变化路径</dt>
          <dd>{impact.changedFields.map(fieldLabel).join('、') || '无变化'}</dd>
        </div>
        <div>
          <dt>当前摘要</dt>
          <dd>{shortHash(impact.currentHash)}</dd>
        </div>
        <div>
          <dt>目标摘要</dt>
          <dd>{shortHash(impact.proposedHash)}</dd>
        </div>
      </dl>
      <p>潜在成员是保守影响上界，不代表前端判定结果；下单时资格服务仍会使用已发布版本、成员事实和原子限购记录重新计算。</p>
    </section>
  );
}

function shortHash(value: string | null): string {
  return value === null ? '无' : `${value.slice(0, 12)}…${value.slice(-8)}`;
}
function fieldLabel(value: string): string {
  if (value === 'name') return '策略名称';
  if (value === 'versionSnapshot') return '完整历史快照';
  return value;
}
