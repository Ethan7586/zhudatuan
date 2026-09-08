import { FINANCE_RECONCILIATION_STATES } from '@shop/contract';
import { defineQueryState, integerQuery, optionalQuery, trimmedQuery } from '../../../shared/query/QueryState';
import type { FinanceReconciliationQuery } from '../model/Finance';

export const removedReconciliationQueryKeys = ['q', 'tab'] as const;
export const reconciliationStates = FINANCE_RECONCILIATION_STATES;
export const reconciliationQuery = defineQueryState({
  cursor: optionalQuery(), reconPeriod: trimmedQuery(), channel: trimmedQuery(), mall: trimmedQuery(), status: trimmedQuery(), difference: trimmedQuery(),
  limit: integerQuery(50, [20, 50]), selected: optionalQuery(255), item: optionalQuery(255), q: optionalQuery(255), tab: optionalQuery(64),
});

export function reconciliationInput(url: ReturnType<typeof reconciliationQuery.read>): FinanceReconciliationQuery {
  const state = reconciliationStates.find((value) => value === url.status);
  return Object.freeze({
    limit: url.limit as 20 | 50,
    ...(url.cursor === undefined ? {} : { cursor: url.cursor }),
    ...(url.reconPeriod === undefined ? {} : { period: url.reconPeriod }),
    ...(url.channel === undefined ? {} : { provider: url.channel }),
    ...(url.mall === undefined ? {} : { mall: url.mall }),
    ...(state === undefined ? {} : { state }),
    ...(url.difference === undefined ? {} : { differenceType: url.difference }),
  });
}
