import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CockpitDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { cockpitPeriods, type BusinessInsight, type CockpitDestination, type CockpitFilter, type CockpitPeriod } from '../model/Cockpit';
import { useCockpitSections } from './CockpitSections';

export function useCockpitViewModel(context: ConsoleContext, dependencies: CockpitDependencies, navigate: (destination: CockpitDestination) => void) {
  const [search, setSearch] = useSearchParams();
  const period = readPeriod(search.get('period'));
  const application = search.get('application') ?? '';
  const [applicationDraft, setApplicationDraft] = useState(application);
  useEffect(() => setApplicationDraft(application), [application]);
  const filter: CockpitFilter = useMemo(() => Object.freeze({ period, ...(application ? { application } : {}) }), [application, period]);
  const sections = useCockpitSections(context, dependencies, filter);
  const metadata = sections.metrics.data?.metadata ?? sections.trends.data?.metadata ?? sections.todos.data?.metadata ?? sections.anomalies.data?.metadata;
  const watermark = metadata?.watermark;
  const timezone = metadata?.timezone ?? 'Asia/Shanghai';
  const projectionVersion = metadata?.projectionVersion ?? 0;
  const stale = watermark === undefined ? false : Date.now() - new Date(watermark).getTime() > (period === 'realtime' ? 15 * 60_000 : 36 * 60 * 60_000);
  const searchValue = search.toString();
  const update = useCallback(
    (key: 'period' | 'application', value: string) => {
      const next = new URLSearchParams(searchValue);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearch(next);
    },
    [searchValue, setSearch]
  );
  const refresh = sections.refresh;
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => void refresh(),
        period: (value: CockpitPeriod) => update('period', value),
        application: setApplicationDraft,
        applyApplication: () => update('application', applicationDraft.trim()),
        openInsight: (insight: BusinessInsight) => navigate({ kind: 'insight', target: insight.target }),
        openProduct: (productId: string) => navigate({ kind: 'product', productId }),
        openOrders: () => navigate({ kind: 'orders' }),
      }),
    [applicationDraft, navigate, refresh, update]
  );
  return Object.freeze({
    scope: context.scope.name ?? context.scope.id,
    period,
    application,
    applicationDraft,
    sections,
    conclusion: metadata?.conclusion,
    watermark,
    timezone,
    projectionVersion,
    stale,
    actions,
  });
}

export type CockpitViewModel = ReturnType<typeof useCockpitViewModel>;
function readPeriod(value: string | null): CockpitPeriod {
  return cockpitPeriods.includes(value as CockpitPeriod) ? (value as CockpitPeriod) : '30days';
}
