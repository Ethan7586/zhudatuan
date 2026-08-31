import { createFetchFinanceReconciliationsRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceReconciliationPageSchema, type FinanceFilter } from './FinanceWorkspaceSchema';

const reconciliationsRead = createFetchFinanceReconciliationsRead(appConfig.apiBaseUrl);

export interface FinanceReconciliationQuery extends FinanceFilter {
  readonly kind: 'payment' | 'refund';
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
    filter.kind,
    filter.cursor ?? null,
    filter.limit,
  ] as const);

export async function readFinanceReconciliations(context: ConsoleContext, filter: FinanceReconciliationQuery, signal: AbortSignal) {
  const value = await reconciliationsRead(
    {
      query: {
        limit: filter.limit,
        kind: filter.kind,
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.q !== '' ? { q: filter.q } : {}),
        ...(filter.period !== '' ? { period: filter.period } : {}),
        ...(filter.channel !== '' ? { channel: filter.channel } : {}),
        ...(filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(filter.status !== '' ? { status: filter.status } : {}),
        ...(filter.difference !== '' ? { difference: filter.difference } : {}),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return FinanceReconciliationPageSchema.parse(value);
}
