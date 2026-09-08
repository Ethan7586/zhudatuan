import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface BenefitMemberPort {
  active(context: ReadTransactionContext, member: string): Promise<boolean>;
}
export const BENEFIT_MEMBER_PORT = publicPort<BenefitMemberPort>('member', 'benefit');
