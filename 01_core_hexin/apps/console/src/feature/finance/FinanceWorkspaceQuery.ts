import { createFetchFinanceReconciliationsRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceReconciliationPageSchema, type FinanceFilter } from './FinanceWorkspaceSchema';

const reconciliationsRead = createFetchFinanceReconciliationsRead(appConfig.apiBaseUrl);

export interface FinanceReconciliationQuery extends FinanceFilter {
  readonly cursor?: string;
  readonly limit: number;
}

export function isFinancePreviewContext(context: ConsoleContext): boolean {
  return context.scope.kind === 'platform' && context.scope.id === 'platform:preview';
}

export const financeReconciliationKey = (context: ConsoleContext, filter: FinanceReconciliationQuery) =>
  Object.freeze([
    'console',
    context.scope.kind,
    context.scope.id,
    context.session.accessVersion,
    'finance.reconciliations.read',
    filter.q,
    filter.period,
    filter.channel,
    filter.mall,
    filter.status,
    filter.difference,
    filter.cursor ?? null,
    filter.limit,
  ] as const);

export async function readFinanceReconciliations(context: ConsoleContext, filter: FinanceReconciliationQuery, signal: AbortSignal) {
  const prefetched = await takeDocumentFinanceReconciliationPrefetch(context, filter, signal);
  if (prefetched !== undefined) return prefetched;
  const preview = isFinancePreviewContext(context);
  const value = await reconciliationsRead(
    {
      query: {
        limit: filter.limit,
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(preview && filter.q !== '' ? { q: filter.q } : {}),
        ...(preview && filter.period !== '' ? { period: filter.period } : {}),
        ...(preview && filter.channel !== '' ? { channel: filter.channel } : {}),
        ...(preview && filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(preview && filter.status !== '' ? { status: filter.status } : {}),
        ...(preview && filter.difference !== '' ? { difference: filter.difference } : {}),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return FinanceReconciliationPageSchema.parse(value);
}

async function takeDocumentFinanceReconciliationPrefetch(
  context: ConsoleContext,
  filter: FinanceReconciliationQuery,
  signal: AbortSignal,
) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleFinanceReconciliationPrefetch;
  delete window.__consoleFinanceReconciliationPrefetch;
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
    const query = value?.query;
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion
      && query?.q === filter.q
      && query.period === filter.period
      && query.channel === filter.channel
      && query.mall === filter.mall
      && query.status === filter.status
      && query.difference === filter.difference
      && query.cursor === filter.cursor
      && query.limit === filter.limit;
    if (!matches) return undefined;
    const parsed = FinanceReconciliationPageSchema.safeParse(value.value);
    return parsed.success ? parsed.data : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
