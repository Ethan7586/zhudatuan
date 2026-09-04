import { presentError, queryCondition } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CockpitDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { cockpitPeriods, type BusinessInsight, type CockpitFilter, type CockpitPeriod } from '../model/Cockpit';
import { cockpitKey } from './CockpitQueryKey';

export function useCockpitViewModel(context: ConsoleContext, dependencies: CockpitDependencies, navigate: (target: BusinessInsight['target']) => void) {
  const [search, setSearch] = useSearchParams();
  const period = readPeriod(search.get('period'));
  const application = search.get('application') ?? '';
  const [applicationDraft, setApplicationDraft] = useState(application);
  useEffect(() => setApplicationDraft(application), [application]);
  const filter: CockpitFilter = useMemo(() => Object.freeze({ period, ...(application ? { application } : {}) }), [application, period]);
  const query = useQuery({ queryKey: cockpitKey(context, filter), queryFn: ({ signal }) => dependencies.read.execute(context, filter, signal) });
  const data = query.data;
  const watermark = useMemo(() => latest(data?.items.map((item) => item.watermark) ?? []) ?? data?.summary.sales.asOf, [data]);
  const timezone = data?.items[0]?.period.timezone ?? 'Asia/Shanghai';
  const projectionVersion = data?.items.reduce((maximum, item) => Math.max(maximum, item.projectionVersion), 0) ?? 0;
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
  const refresh = query.refetch;
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => void refresh(),
        period: (value: CockpitPeriod) => update('period', value),
        application: setApplicationDraft,
        applyApplication: () => update('application', applicationDraft.trim()),
        openInsight: (insight: BusinessInsight) => navigate(insight.target),
      }),
    [applicationDraft, navigate, refresh, update]
  );
  return Object.freeze({
    scope: context.scope.name ?? context.scope.id,
    period,
    application,
    applicationDraft,
    data,
    watermark,
    timezone,
    projectionVersion,
    stale,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false }),
    error: query.error ? presentError(query.error).message : undefined,
    actions,
  });
}

export type CockpitViewModel = ReturnType<typeof useCockpitViewModel>;
function readPeriod(value: string | null): CockpitPeriod {
  return cockpitPeriods.includes(value as CockpitPeriod) ? (value as CockpitPeriod) : '30days';
}
function latest(values: readonly string[]): string | undefined {
  return values.length === 0 ? undefined : [...values].sort().at(-1);
}
