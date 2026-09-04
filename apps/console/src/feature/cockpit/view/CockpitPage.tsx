import { Button, FilterBar, Watermark } from '@shop/design';
import { formatDate } from '../../../shared/ui/Format';
import { cockpitPeriods, type CockpitPeriod } from '../model/Cockpit';
import type { CockpitViewModel } from '../viewmodel/CockpitViewModel';
import { BusinessEvents, BusinessInsights, CategoryBreakdown, MallComparison, OperationDetails, ProductLeaders } from './CockpitDetails';
import { CockpitHero } from './CockpitHero';
import { CockpitMetrics } from './CockpitMetrics';
import { CockpitSection } from './CockpitSection';
import { CockpitTrend } from './CockpitTrend';

const periodLabels: Readonly<Record<CockpitPeriod, string>> = Object.freeze({ realtime: '实时', yesterday: '昨日', '7days': '近 7 日', '30days': '近 30 日' });

export function CockpitPage({ title, model }: Readonly<{ title: string; model: CockpitViewModel }>) {
  return (
    <section className="cockpitpage" aria-label="经营驾驶舱">
      <CockpitHero title={title} scope={model.scope} period={model.period} application={model.application} {...(model.conclusion ? { conclusion: model.conclusion } : {})} />
      <FilterBar
        label="驾驶舱筛选"
        actions={
          <>
            <Button onPress={model.actions.applyApplication}>应用筛选</Button>
            <Button onPress={model.actions.refresh}>刷新</Button>
          </>
        }
      >
        <label>
          统计周期
          <select value={model.period} onChange={(event) => model.actions.period(event.target.value as CockpitPeriod)}>
            {cockpitPeriods.map((period) => (
              <option key={period} value={period}>
                {periodLabels[period]}
              </option>
            ))}
          </select>
        </label>
        <label>
          应用编号
          <input value={model.applicationDraft} onChange={(event) => model.actions.application(event.target.value)} placeholder="全部应用" />
        </label>
      </FilterBar>
      {model.watermark ? <Watermark value={formatDate(model.watermark)} timezone={model.timezone} stale={model.stale} /> : null}
      {model.period === 'realtime' && model.watermark ? (
        <p className="cockpitfreshness" data-stale={model.stale ? 'true' : 'false'} role="status">
          数据状态：{model.stale ? '延迟' : '实时'}
        </p>
      ) : null}
      <p className="cockpitprojection">投影版本 v{model.projectionVersion || '—'}</p>
      <div className="cockpitstack">
        <CockpitSection title="经营指标" state={model.sections.metrics}>
          {model.sections.metrics.data ? <CockpitMetrics sales={model.sections.metrics.data.sales} onOpenOrders={model.actions.openOrders} /> : <span />}
        </CockpitSection>
        <CockpitSection title="经营趋势" state={model.sections.trends}>
          {model.sections.trends.data ? (
            <div className="cockpitstack">
              <div className="cockpitprimarygrid">
                <CockpitTrend sales={model.sections.trends.data.sales} />
                <CategoryBreakdown categories={model.sections.trends.data.sales.categories} />
              </div>
              <ProductLeaders products={model.sections.trends.data.sales.topProducts} onOpen={model.actions.openProduct} />
            </div>
          ) : (
            <span />
          )}
        </CockpitSection>
        <div className="cockpitsecondarygrid">
          <CockpitSection title="商城经营趋势" state={model.sections.trends}>
            {model.sections.trends.data ? <MallComparison malls={model.sections.trends.data.sales.malls} /> : <span />}
          </CockpitSection>
          <CockpitSection title="经营异常" state={model.sections.anomalies}>
            {model.sections.anomalies.data ? <BusinessEvents events={model.sections.anomalies.data.events} timezone={model.sections.anomalies.data.metadata.timezone} /> : <span />}
          </CockpitSection>
        </div>
        <div className="cockpitlowergrid">
          <CockpitSection title="经营待办" state={model.sections.todos}>
            {model.sections.todos.data ? <BusinessInsights insights={model.sections.todos.data.insights} onOpen={model.actions.openInsight} /> : <span />}
          </CockpitSection>
          <CockpitSection title="经营明细" state={model.sections.metrics}>
            {model.sections.metrics.data ? <OperationDetails summary={model.sections.metrics.data.summary} /> : <span />}
          </CockpitSection>
        </div>
      </div>
    </section>
  );
}
