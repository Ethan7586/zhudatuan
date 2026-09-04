import { OP_FINANCE_ENTRIES_READ, OP_FINANCE_OVERVIEW_READ, OP_FINANCE_RECONCILIATIONS_READ, OP_FINANCE_SETTLEMENTS_READ, OP_FINANCE_STATEMENTS_READ, OP_FINANCE_WITHDRAWALS_READ, OP_INVOICE_REQUESTS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceReconciliationQuery, FinanceSection } from '../model/Finance';

const scopeKey = (context: ConsoleContext) => ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance'] as const;

export const financeOverviewKey = (context: ConsoleContext) => Object.freeze([...scopeKey(context), OP_FINANCE_OVERVIEW_READ] as const);
export const financeSectionKey = (context: ConsoleContext, section: FinanceSection, cursor?: string) => Object.freeze([...scopeKey(context), financeOperation(section), cursor ?? null, 50] as const);
export const financeReconciliationKey = (context: ConsoleContext, query: FinanceReconciliationQuery) => Object.freeze([...scopeKey(context), OP_FINANCE_RECONCILIATIONS_READ, query.cursor ?? null, query.limit] as const);

function financeOperation(section: FinanceSection): string {
  return section === 'entries'
    ? OP_FINANCE_ENTRIES_READ
    : section === 'statements'
      ? OP_FINANCE_STATEMENTS_READ
      : section === 'reconciliations'
        ? OP_FINANCE_RECONCILIATIONS_READ
        : section === 'settlements'
          ? OP_FINANCE_SETTLEMENTS_READ
          : section === 'withdrawals'
            ? OP_FINANCE_WITHDRAWALS_READ
            : OP_INVOICE_REQUESTS_READ;
}
