import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopePath } from '../../shared/url/ScopePath';
import { CockpitHero } from './CockpitHero';
import { CockpitMetrics } from './CockpitMetrics';
import { cockpitKey, cockpitPeriods, readCockpit, type CockpitPeriod } from './CockpitQuery';
import type { BusinessInsight, CockpitSales } from './CockpitSchema';
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
    empty: false,
    stale: query.isStale,
  });
  const openInsight = (insight: BusinessInsight) => {
    if (insight.target !== undefined) void navigate(scopePath(context.scope, insight.target));
  };
  const content = query.data === undefined ? undefined : <CockpitContent sales={query.data.summary.sales} onOpenInsight={openInsight} />;
  const resource = content === undefined && query.isPending ? <span role="status">正在加载经营驾驶舱…</span> : condition === 'ready' ? content : (
    <Suspense fallback={content ?? <span role="status">正在加载经营驾驶舱…</span>}>
      <LazyAccessDeniedActionsProvider actions={{
        onReturnToWorkspace: () => { void navigate(scopePath(context.scope, 'cockpit')); },
        onRelogin: () => {
          void import('../../shared/config/AppConfig').then(({ appConfig }) => {
            window.location.assign(`${appConfig.authBaseUrl}/login?client=console`);
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
      {resource}
    </section>
  );
}

function queryCondition(input: Readonly<{
  pending: boolean;
  fetching: boolean;
  error: Error | null;
  hasData: boolean;
  empty: boolean;
  stale: boolean;
}>) {
  if (input.pending) return 'loading' as const;
  if (input.error !== null) {
    const status = apiError(input.error)?.status;
    if (status === 401) return 'unauthenticated' as const;
    if (status === 403) return 'denied' as const;
    if (!navigator.onLine) return input.hasData ? 'stale' as const : 'offline' as const;
    if (input.fetching) return 'retry' as const;
    if (input.hasData) return 'stale' as const;
    if (status === 404) return 'notfound' as const;
    if (status === 409 || status === 412) return 'conflict' as const;
    if (status === 429) return 'ratelimited' as const;
    return 'failure' as const;
  }
  if (!input.hasData || input.empty) return 'empty' as const;
  if (input.fetching) return 'refreshing' as const;
  if (input.stale) return 'stale' as const;
  return 'ready' as const;
}

function safeQueryError(error: Error | null): string | undefined {
  if (error === null) return undefined;
  const api = apiError(error);
  return api === undefined ? (navigator.onLine ? 'REQUEST_FAILED' : 'NETWORK_OFFLINE') : `${api.code} · 请求 ${api.requestId}`;
}

function apiError(error: Error): Readonly<{ status: number; code: string; requestId: string }> | undefined {
  const value = error as Error & Partial<{ status: number; code: string; requestId: string }>;
  return value.name === 'ApiError' && typeof value.status === 'number' && typeof value.code === 'string'
    && typeof value.requestId === 'string' ? { status: value.status, code: value.code, requestId: value.requestId } : undefined;
}

function CockpitContent({ sales, onOpenInsight }: Readonly<{
  sales: CockpitSales;
  onOpenInsight: (insight: BusinessInsight) => void;
}>) {
  return (
    <div className="cockpitstack">
      <CockpitHero sales={sales} />
      <CockpitMetrics sales={sales} />
      <DeferredCockpitDetails sales={sales} onOpenInsight={onOpenInsight} />
    </div>
  );
}

function DeferredCockpitDetails({ sales, onOpenInsight }: Readonly<{
  sales: CockpitSales;
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
      <CockpitDeferred sales={sales} onOpenInsight={onOpenInsight} />
    </Suspense>
  );
}
