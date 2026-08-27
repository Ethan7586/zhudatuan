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
  const value = await overviewRead(
    {},
    consoleRequest(context.scope, signal, context.session.accessVersion),
  );
  return FinanceOverviewSchema.parse(value);
}
