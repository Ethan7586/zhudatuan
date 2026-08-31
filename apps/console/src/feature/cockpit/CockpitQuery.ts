import { createFetchReportingDashboardRead } from '@shop/sdk/reporting';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { CockpitSchema } from './CockpitSchema';

const dashboardRead = createFetchReportingDashboardRead(appConfig.apiBaseUrl);

export const cockpitPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;
export type CockpitPeriod = (typeof cockpitPeriods)[number];

export const cockpitKey = (context: ConsoleContext, period: CockpitPeriod) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'reporting.dashboard.read', period] as const);

export async function readCockpit(context: ConsoleContext, period: CockpitPeriod, signal: AbortSignal) {
  const value = await dashboardRead({ query: { period, limit: 100 } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  return CockpitSchema.parse(value);
}
