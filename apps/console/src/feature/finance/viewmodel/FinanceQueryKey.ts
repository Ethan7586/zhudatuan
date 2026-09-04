import { OP_FINANCE_AUDIT_READ, OP_FINANCE_FACETS_READ, OP_FINANCE_OVERVIEW_READ, OP_FINANCE_RECONCILIATIONS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceReconciliationQuery, FinanceSection } from '../model/Finance';
import { financeSectionOperation } from '../model/FinanceOperation';

const scopeKey = (context: ConsoleContext) => ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance'] as const;

export const financeOverviewKey = (context: ConsoleContext) => Object.freeze([...scopeKey(context), OP_FINANCE_OVERVIEW_READ] as const);
export const financeFacetKey = (context: ConsoleContext) => Object.freeze([...scopeKey(context), OP_FINANCE_FACETS_READ] as const);
export const financeAuditKey = (context: ConsoleContext, reference: string) => Object.freeze([...scopeKey(context), OP_FINANCE_AUDIT_READ, reference] as const);
export const financeSectionKey = (context: ConsoleContext, section: FinanceSection, cursor?: string) => Object.freeze([...scopeKey(context), financeSectionOperation(section), cursor ?? null, 50] as const);
export const financeReconciliationKey = (context: ConsoleContext, query: FinanceReconciliationQuery) => Object.freeze([...scopeKey(context), OP_FINANCE_RECONCILIATIONS_READ, query.cursor ?? null, query.limit] as const);
