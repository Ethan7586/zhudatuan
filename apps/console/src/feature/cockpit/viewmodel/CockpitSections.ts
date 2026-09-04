import { presentError, queryCondition } from '@shop/presentation';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CockpitDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { CockpitData, CockpitFilter } from '../model/Cockpit';
import { cockpitKey } from './CockpitQueryKey';

export interface CockpitMetadata {
  readonly watermark: string;
  readonly timezone: string;
  readonly projectionVersion: number;
  readonly conclusion: string;
}

export interface CockpitSectionState<T> {
  readonly data: T | undefined;
  readonly condition: ReturnType<typeof queryCondition>;
  readonly error: string | undefined;
  readonly revision: number;
  readonly retry: () => void;
}

export function useCockpitSections(context: ConsoleContext, dependencies: CockpitDependencies, filter: CockpitFilter) {
  const source = { queryKey: cockpitKey(context, filter), queryFn: ({ signal }: Readonly<{ signal: AbortSignal }>) => dependencies.read.execute(context, filter, signal) };
  const metrics = useQuery({ ...source, select: selectMetrics });
  const trends = useQuery({ ...source, select: selectTrends });
  const todos = useQuery({ ...source, select: selectTodos });
  const anomalies = useQuery({ ...source, select: selectAnomalies });
  return Object.freeze({
    metrics: sectionState(metrics),
    trends: sectionState(trends),
    todos: sectionState(todos),
    anomalies: sectionState(anomalies),
    refresh: () => void metrics.refetch(),
  });
}

export const selectMetrics = (data: CockpitData) => Object.freeze({ metadata: metadata(data), sales: data.summary.sales, summary: data.summary });
export const selectTrends = (data: CockpitData) => Object.freeze({ metadata: metadata(data), sales: data.summary.sales });
export const selectTodos = (data: CockpitData) => Object.freeze({ metadata: metadata(data), insights: data.summary.sales.insights });
export const selectAnomalies = (data: CockpitData) => Object.freeze({ metadata: metadata(data), events: data.summary.sales.events });

function metadata(data: CockpitData): CockpitMetadata {
  return Object.freeze({
    watermark: data.snapshot.watermark.occurredAt,
    timezone: data.items[0]?.period.timezone ?? 'Asia/Shanghai',
    projectionVersion: data.snapshot.watermark.version,
    conclusion: data.summary.sales.conclusion,
  });
}

function sectionState<T>(query: UseQueryResult<T>): CockpitSectionState<T> {
  const data = query.data;
  return Object.freeze({
    data,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false }),
    error: query.error ? presentError(query.error).message : undefined,
    revision: query.dataUpdatedAt,
    retry: () => void query.refetch(),
  });
}
