import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
export interface BenefitSummary {
  readonly accounts: number;
  readonly availableMinor: number;
  readonly currency: string | null;
  readonly version: number;
}
export interface BenefitReadPort {
  summary(context: ReadTransactionContext, member: string, mall: string): Promise<BenefitSummary>;
}
export const BENEFIT_READ_PORT = publicPort<BenefitReadPort>('benefit', 'read');
