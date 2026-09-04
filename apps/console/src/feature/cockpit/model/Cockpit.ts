import { REPORT_PERIODS, type OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

export const cockpitPeriods = REPORT_PERIODS;
export type CockpitPeriod = (typeof cockpitPeriods)[number];

export type CockpitData = DeepReadonly<OperationOutputFor<'reporting.dashboard.read'>>;
export type CockpitMetric = CockpitData['items'][number];
export type CockpitSales = CockpitData['summary']['sales'];
export type Trend = CockpitSales['trend'][number];
export type CategoryPerformance = CockpitSales['categories'][number];
export type TopProduct = CockpitSales['topProducts'][number];
export type CockpitDeltas = CockpitSales['deltas'];
export type MallPerformance = CockpitSales['malls'][number];
export type BusinessEvent = CockpitSales['events'][number];
export type BusinessInsight = CockpitSales['insights'][number];
export type CockpitDestination = Readonly<{ kind: 'product'; productId: string }> | Readonly<{ kind: 'orders' }> | Readonly<{ kind: 'insight'; target: BusinessInsight['target'] }>;

export interface CockpitFilter {
  readonly period: CockpitPeriod;
  readonly application?: string;
}
