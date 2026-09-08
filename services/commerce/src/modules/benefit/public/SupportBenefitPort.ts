import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface SupportBenefitPort {
  lot(context: ReadTransactionContext, id: string, member: string, scopes: readonly string[]): Promise<Readonly<Record<string, unknown>> | null>;
  recent(context: ReadTransactionContext, member: string, scopes: readonly string[], limit: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export const SUPPORT_BENEFIT_PORT = publicPort<SupportBenefitPort>('benefit', 'support');
