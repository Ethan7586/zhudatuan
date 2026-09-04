import { Button, FilterBar, ResourceState, Watermark } from '@shop/design';
import { formatDate } from '../../../shared/ui/Format';
import { cockpitPeriods, type CockpitPeriod } from '../model/Cockpit';
import type { CockpitViewModel } from '../viewmodel/CockpitViewModel';
import { BusinessEvents, BusinessInsights, CategoryBreakdown, MallComparison, OperationDetails, ProductLeaders } from './CockpitDetails';
import { CockpitHero } from './CockpitHero';
import { CockpitMetrics } from './CockpitMetrics';
import { CockpitTrend } from './CockpitTrend';

const periodLabels: Readonly<Record<CockpitPeriod, string>> = Object.freeze({ realtime: '实时', yesterday: '昨日', '7days': '近 7 日', '30days': '近 30 日' });

export function CockpitPage({ title, model }: Readonly<{ title: string; model: CockpitViewModel }>) {
  return (
    <section className="cockpitpage" aria-label="经营驾驶舱">
      <CockpitHero title={title} scope={model.scope} period={model.period} application={model.application} {...(model.data ? { conclusion: model.data.summary.sales.conclusion } : {})} />
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
      <ResourceState condition={model.condition} {...(model.error ? { error: model.error } : {})} retry={model.actions.refresh}>
        {model.data ? (
          <div className="cockpitstack">
            <CockpitMetrics sales={model.data.summary.sales} />
            <div className="cockpitprimarygrid">
              <CockpitTrend sales={model.data.summary.sales} />
              <CategoryBreakdown categories={model.data.summary.sales.categories} />
            </div>
            <ProductLeaders products={model.data.summary.sales.topProducts} />
            <div className="cockpitsecondarygrid">
              <MallComparison malls={model.data.summary.sales.malls} />
              <BusinessEvents events={model.data.summary.sales.events} timezone={model.timezone} />
            </div>
            <div className="cockpitlowergrid">
              <BusinessInsights insights={model.data.summary.sales.insights} onOpen={model.actions.openInsight} />
              <OperationDetails summary={model.data.summary} />
            </div>
          </div>
        ) : (
          <span />
        )}
      </ResourceState>
    </section>
  );
}
