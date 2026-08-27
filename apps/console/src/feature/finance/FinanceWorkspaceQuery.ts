import { createFetchFinanceReconciliationsRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceReconciliationPageSchema, type FinanceFilter } from './FinanceWorkspaceSchema';

const reconciliationsRead = createFetchFinanceReconciliationsRead(appConfig.apiBaseUrl);

export interface FinanceReconciliationQuery extends FinanceFilter {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  readonly kind: 'payment' | 'refund';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly kind: 'payment' | 'refund';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    filter.kind,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    filter.kind,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    filter.cursor ?? null,
    filter.limit,
  ] as const);

export async function readFinanceReconciliations(context: ConsoleContext, filter: FinanceReconciliationQuery, signal: AbortSignal) {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
  const preview = isFinancePreviewContext(context);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const preview = isFinancePreviewContext(context);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const value = await reconciliationsRead(
    {
      query: {
        limit: filter.limit,
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        kind: filter.kind,
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.q !== '' ? { q: filter.q } : {}),
        ...(filter.period !== '' ? { period: filter.period } : {}),
        ...(filter.channel !== '' ? { channel: filter.channel } : {}),
        ...(filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(filter.status !== '' ? { status: filter.status } : {}),
        ...(filter.difference !== '' ? { difference: filter.difference } : {}),
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(preview && filter.q !== '' ? { q: filter.q } : {}),
        ...(preview && filter.period !== '' ? { period: filter.period } : {}),
        ...(preview && filter.channel !== '' ? { channel: filter.channel } : {}),
        ...(preview && filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(preview && filter.status !== '' ? { status: filter.status } : {}),
        ...(preview && filter.difference !== '' ? { difference: filter.difference } : {}),
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        kind: filter.kind,
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.q !== '' ? { q: filter.q } : {}),
        ...(filter.period !== '' ? { period: filter.period } : {}),
        ...(filter.channel !== '' ? { channel: filter.channel } : {}),
        ...(filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(filter.status !== '' ? { status: filter.status } : {}),
        ...(filter.difference !== '' ? { difference: filter.difference } : {}),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return FinanceReconciliationPageSchema.parse(value);
}
