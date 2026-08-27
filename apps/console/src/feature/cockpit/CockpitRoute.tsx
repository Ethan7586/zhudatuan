import { ResourceState } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { scopePath } from '../../shared/url/ScopePath';
import { BusinessEvents, BusinessInsights, MallComparison } from './CockpitDetails';
import { CockpitHero } from './CockpitHero';
import { CockpitMetrics } from './CockpitMetrics';
import { cockpitKey, cockpitPeriods, readCockpit, type CockpitPeriod } from './CockpitQuery';
import type { BusinessInsight, CockpitSales } from './CockpitSchema';
import { CockpitTrend } from './CockpitTrend';
import './cockpit.css';

export function Component() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const requested = search.get('period');
  const period: CockpitPeriod = cockpitPeriods.includes(requested as CockpitPeriod) ? requested as CockpitPeriod : '30days';
  const query = useQuery({
    queryKey: cockpitKey(context, period),
    queryFn: ({ signal }) => readCockpit(context, period, signal),
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: query.data?.summary.orderCount === 0 && query.data.summary.catalogCount === 0,
    stale: query.isStale,
  });
  const openInsight = (insight: BusinessInsight) => {
    if (insight.target !== undefined) void navigate(scopePath(context.scope, insight.target));
  };
  return (
    <section className="cockpitpage" aria-label="经营驾驶舱">
      <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}>
        {query.data === undefined ? <span /> : <CockpitContent sales={query.data.summary.sales} onOpenInsight={openInsight} />}
      </ResourceState>
    </section>
  );
}

function CockpitContent({ sales, onOpenInsight }: Readonly<{
  sales: CockpitSales;
  onOpenInsight: (insight: BusinessInsight) => void;
}>) {
  return (
    <div className="cockpitstack">
      <CockpitHero sales={sales} />
      <CockpitMetrics sales={sales} />
      <div className="cockpitprimarygrid">
        <CockpitTrend sales={sales} />
        <MallComparison malls={sales.malls ?? []} />
      </div>
      <div className="cockpitsecondarygrid">
        <BusinessEvents events={sales.events ?? []} />
        <BusinessInsights insights={sales.insights ?? []} onOpen={onOpenInsight} />
      </div>
    </div>
  );
}
