import { createFetchFinanceOverviewRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceOverviewSchema } from './FinanceSchema';

const overviewRead = createFetchFinanceOverviewRead(appConfig.apiBaseUrl);

export const financeKey = (context: ConsoleContext) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance.overview.read',
] as const);

export async function readFinance(context: ConsoleContext, signal: AbortSignal) {
  const prefetched = await takeDocumentFinanceOverviewPrefetch(context, signal);
  if (prefetched !== undefined) return prefetched;
  const value = await overviewRead(
    {},
    consoleRequest(context.scope, signal, context.session.accessVersion),
  );
  return FinanceOverviewSchema.parse(value);
}

async function takeDocumentFinanceOverviewPrefetch(context: ConsoleContext, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleFinanceOverviewPrefetch;
  delete window.__consoleFinanceOverviewPrefetch;
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
  signal.addEventListener('abort', abort, { once: true });
  try {
    const value = await Promise.race([slot.promise, aborted]);
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion;
    if (!matches) return undefined;
    const parsed = FinanceOverviewSchema.safeParse(value.value);
    return parsed.success ? parsed.data : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
