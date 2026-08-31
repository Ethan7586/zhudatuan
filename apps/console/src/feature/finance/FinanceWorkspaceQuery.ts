import { createFetchFinanceReconciliationsRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceReconciliationPageSchema } from './FinanceWorkspaceSchema';

const reconciliationsRead = createFetchFinanceReconciliationsRead(appConfig.apiBaseUrl);

export interface FinanceReconciliationQuery {
  readonly cursor?: string;
  readonly limit: number;
}

export const financeReconciliationKey = (context: ConsoleContext, filter: FinanceReconciliationQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance.reconciliations.read', filter.cursor ?? null, filter.limit] as const);

export async function readFinanceReconciliations(context: ConsoleContext, filter: FinanceReconciliationQuery, signal: AbortSignal) {
  const value = await reconciliationsRead(
    {
      query: {
        limit: filter.limit,
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return FinanceReconciliationPageSchema.parse(value);
}
