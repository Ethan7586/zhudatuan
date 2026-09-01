import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface SupportBenefitPort {
  lot(context: ReadTransactionContext, id: string, member: string, scopes: readonly string[]): Promise<Readonly<Record<string, unknown>> | null>;
}
export const SUPPORT_BENEFIT_PORT = publicPort<SupportBenefitPort>('benefit', 'support');
