import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { scopePath } from '../../shared/url/ScopePath';
import { BusinessPerspectiveBar } from '../supply-chain/BusinessPerspectiveBar';
import { readSupplierPerspectives, supplierPerspectiveKey } from '../supply-chain/SupplierPerspectiveQuery';
import { CockpitHero } from './CockpitHero';
import { CockpitMetrics } from './CockpitMetrics';
import { cockpitKey, cockpitPeriods, readCockpit, type CockpitPeriod } from './CockpitQuery';
import type { BusinessInsight, CockpitData, CockpitSales } from './CockpitSchema';
import './cockpit.css';

const CockpitDeferred = lazy(() => import('./CockpitDeferred'));
const LazyResourceState = lazy(async () => {
  const { ResourceState } = await import('@shop/design');
  return { default: ResourceState };
});
const LazyAccessDeniedActionsProvider = lazy(async () => {
  const { AccessDeniedActionsProvider } = await import('@shop/design/access-denied');
  return { default: AccessDeniedActionsProvider };
});

export function Component() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const requested = search.get('period');
  const period: CockpitPeriod = cockpitPeriods.includes(requested as CockpitPeriod) ? requested as CockpitPeriod : '30days';
  const supplier = search.get('supplier') ?? undefined;
  const perspectives = useQuery({
    queryKey: supplierPerspectiveKey(context),
    queryFn: ({ signal }) => readSupplierPerspectives(context, signal),
    staleTime: 5 * 60_000,
  });
  const query = useQuery({
    queryKey: cockpitKey(context, period, supplier),
    queryFn: ({ signal }) => readCockpit(context, period, signal, supplier),
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: false,
    stale: query.isStale,
  });
  const openInsight = (insight: BusinessInsight) => {
    if (insight.target !== undefined) void navigate(scopePath(context.scope, insight.target));
  };
  const setPerspective = (next?: string) => {
    const value = new URLSearchParams(search);
    if (next === undefined) value.delete('supplier'); else value.set('supplier', next);
    setSearch(value);
  };
  const content = query.data === undefined ? undefined : <CockpitContent summary={query.data.summary} onOpenInsight={openInsight} />;
  const resource = content === undefined && query.isPending ? <span role="status">正在加载经营驾驶舱…</span> : condition === 'ready' ? content : (
    <Suspense fallback={content ?? <span role="status">正在加载经营驾驶舱…</span>}>
      <LazyAccessDeniedActionsProvider actions={{
        onReturnToWorkspace: () => { void navigate(scopePath(context.scope, 'cockpit')); },
        onRelogin: () => {
          void import('../../shared/config/AppConfig').then(({ appConfig }) => {
            window.location.assign(appConfig.identityEntryUrl);
          });
        },
      }}>
        <LazyResourceState condition={condition} resourceLabel="经营驾驶舱" {...(error === undefined ? {} : { error })}
          retry={() => { void query.refetch(); }}>
          {content ?? <span />}
        </LazyResourceState>
      </LazyAccessDeniedActionsProvider>
    </Suspense>
  );
  return (
    <section className="cockpitpage" aria-label="经营驾驶舱">
      <BusinessPerspectiveBar partners={perspectives.data ?? []} {...(supplier === undefined ? {} : { selected: supplier })}
        busy={perspectives.isFetching || query.isFetching} onSelect={setPerspective} />
      {resource}
    </section>
  );
}

function CockpitContent({ summary, onOpenInsight }: Readonly<{
  summary: CockpitData['summary'];
  onOpenInsight: (insight: BusinessInsight) => void;
}>) {
  const sales = summary.sales;
  return (
    <div className="cockpitstack">
      <CockpitHero sales={sales} {...(summary.perspective === undefined ? {} : { perspective: summary.perspective })} />
      <CockpitMetrics sales={sales} {...(summary.operations === undefined ? {} : { operations: summary.operations })} />
      <DeferredCockpitDetails sales={sales} supplierView={summary.perspective !== undefined} onOpenInsight={onOpenInsight} />
    </div>
  );
}

function DeferredCockpitDetails({ sales, supplierView, onOpenInsight }: Readonly<{
  sales: CockpitSales;
  supplierView: boolean;
  onOpenInsight: (insight: BusinessInsight) => void;
}>) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);
  if (!ready) return <div className="cockpitdeferred" aria-hidden="true" />;
  return (
    <Suspense fallback={<div className="cockpitdeferred" aria-hidden="true" />}>
      <CockpitDeferred sales={sales} supplierView={supplierView} onOpenInsight={onOpenInsight} />
    </Suspense>
  );
}
