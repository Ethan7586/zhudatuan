import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { CockpitSchema } from './CockpitSchema';

export const cockpitPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;
export type CockpitPeriod = (typeof cockpitPeriods)[number];

export const cockpitKey = (context: ConsoleContext, period: CockpitPeriod) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'reporting.dashboard.read', period,
] as const);

export async function readCockpit(context: ConsoleContext, period: CockpitPeriod, signal: AbortSignal) {
  const prefetch = typeof window === 'undefined' ? undefined : window.__consoleCockpitPrefetch;
  if (typeof window !== 'undefined') delete window.__consoleCockpitPrefetch;
  const prefetched = await consumeDocumentPrefetch(prefetch, signal);
  const matches = prefetched?.scopeKind === context.scope.kind
    && prefetched.scopeId === context.scope.id
    && prefetched.accessVersion === context.session.accessVersion
    && prefetched.period === period;
  if (matches) {
    const parsed = CockpitSchema.safeParse(prefetched.value);
    if (parsed.success) return parsed.data;
  }
  const value = await readCockpitFromSdk(context, period, signal);
  return CockpitSchema.parse(value);
}

async function readCockpitFromSdk(context: ConsoleContext, period: CockpitPeriod, signal: AbortSignal) {
  const [{ createFetchReportingDashboardRead }, { consoleRequest }, { appConfig }] = await Promise.all([
    import('@shop/sdk/reporting'),
    import('../../shared/api/Client'),
    import('../../shared/config/AppConfig'),
  ]);
  return createFetchReportingDashboardRead(appConfig.apiBaseUrl)(
    { query: { period, limit: 100 } },
    consoleRequest(context.scope, signal, context.session.accessVersion),
  );
}

async function consumeDocumentPrefetch(
  slot: Window['__consoleCockpitPrefetch'],
  signal: AbortSignal,
) {
  if (slot === undefined) return undefined;
  const abort = () => window.__consoleAbortDocumentPrefetch?.();
  if (signal.aborted) {
    abort();
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (!slot.settled) {
      abort();
      return undefined;
    }
    return await slot.promise;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
