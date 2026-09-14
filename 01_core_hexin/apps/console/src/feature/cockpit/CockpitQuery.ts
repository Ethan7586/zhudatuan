import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consumeDocumentPrefetch } from '../../shared/api/DocumentPrefetch';
import { CockpitSchema } from './CockpitSchema';

export const cockpitPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;
export type CockpitPeriod = (typeof cockpitPeriods)[number];
const DOCUMENT_PREFETCH_HANDOFF_MS = 180;

export const cockpitKey = (context: ConsoleContext, period: CockpitPeriod, supplier?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'reporting.dashboard.read', period, supplier ?? 'all',
] as const);

export async function readCockpit(context: ConsoleContext, period: CockpitPeriod, signal: AbortSignal, supplier?: string) {
  const prefetch = typeof window === 'undefined' ? undefined : window.__consoleCockpitPrefetch;
  if (typeof window !== 'undefined') delete window.__consoleCockpitPrefetch;
  const prefetched = supplier === undefined
    ? await consumeDocumentPrefetch(prefetch, signal, { handoffMs: DOCUMENT_PREFETCH_HANDOFF_MS }) : undefined;
  const matches = prefetched?.scopeKind === context.scope.kind
    && prefetched.scopeId === context.scope.id
    && prefetched.accessVersion === context.session.accessVersion
    && prefetched.period === period;
  if (matches) {
    const parsed = CockpitSchema.safeParse(prefetched.value);
    if (parsed.success) return parsed.data;
  }
  const value = await readCockpitFromSdk(context, period, signal, supplier);
  return CockpitSchema.parse(value);
}

async function readCockpitFromSdk(context: ConsoleContext, period: CockpitPeriod, signal: AbortSignal, supplier?: string) {
  const [{ createFetchReportingDashboardRead }, { consoleRequest }, { appConfig }] = await Promise.all([
    import('@shop/sdk/reporting'),
    import('../../shared/api/Client'),
    import('../../shared/config/AppConfig'),
  ]);
  return createFetchReportingDashboardRead(appConfig.apiBaseUrl)(
    { query: { period, limit: 100, ...(supplier === undefined ? {} : { supplierid: supplier }) } },
    consoleRequest(context.scope, signal, context.session.accessVersion),
  );
}
