import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { CockpitSchema } from './CockpitSchema';

export const cockpitPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;
export type CockpitPeriod = (typeof cockpitPeriods)[number];
const DOCUMENT_PREFETCH_HANDOFF_MS = 180;
const DOCUMENT_PREFETCH_TIMEOUT = Symbol('DOCUMENT_PREFETCH_TIMEOUT');

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
  if (signal.aborted) {
    window.__consoleAbortDocumentPrefetch?.();
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
  let rejectAbort: (cause: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const abort = () => {
    window.__consoleAbortDocumentPrefetch?.();
    rejectAbort(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  };
  let timer: number | undefined;
  signal.addEventListener('abort', abort, { once: true });
  try {
    const value = slot.settled
      ? await Promise.race([slot.promise, aborted])
      : await Promise.race([
        slot.promise,
        aborted,
        new Promise<typeof DOCUMENT_PREFETCH_TIMEOUT>((resolve) => {
          timer = window.setTimeout(() => resolve(DOCUMENT_PREFETCH_TIMEOUT), DOCUMENT_PREFETCH_HANDOFF_MS);
        }),
      ]);
    if (value === DOCUMENT_PREFETCH_TIMEOUT) {
      window.__consoleAbortDocumentPrefetch?.();
      return undefined;
    }
    return value;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
