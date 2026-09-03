import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceReconciliationQuery, FinanceSection } from '../model/Finance';

const scopeKey = (context: ConsoleContext) => ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance'] as const;

export const financeOverviewKey = (context: ConsoleContext) => Object.freeze([...scopeKey(context), 'finance.overview.read'] as const);
export const financeSectionKey = (context: ConsoleContext, section: FinanceSection, cursor?: string) => Object.freeze([...scopeKey(context), financeOperation(section), cursor ?? null, 50] as const);
export const financeReconciliationKey = (context: ConsoleContext, query: FinanceReconciliationQuery) => Object.freeze([...scopeKey(context), 'finance.reconciliations.read', query.cursor ?? null, query.limit] as const);

function financeOperation(section: FinanceSection): string {
  return section === 'entries'
    ? 'finance.entries.read'
    : section === 'statements'
      ? 'finance.statements.read'
      : section === 'reconciliations'
        ? 'finance.reconciliations.read'
        : section === 'settlements'
          ? 'finance.settlements.read'
          : section === 'withdrawals'
            ? 'finance.withdrawals.read'
            : 'invoice.requests.read';
}
