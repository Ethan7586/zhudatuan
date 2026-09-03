import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceOverview, FinanceRecordPage, FinanceReconciliationPage, FinanceReconciliationQuery, FinanceSection } from '../model/Finance';

export interface FinancePort {
  overview(context: ConsoleContext, signal?: AbortSignal): Promise<FinanceOverview>;
  section(context: ConsoleContext, section: FinanceSection, cursor?: string, signal?: AbortSignal): Promise<FinanceRecordPage>;
  reconciliations(context: ConsoleContext, query: FinanceReconciliationQuery, signal?: AbortSignal): Promise<FinanceReconciliationPage>;
}
