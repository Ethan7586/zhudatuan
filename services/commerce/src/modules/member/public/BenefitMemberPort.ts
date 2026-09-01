import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface BenefitMemberPort {
  active(context: ReadTransactionContext, member: string): Promise<boolean>;
}
export const BENEFIT_MEMBER_PORT = publicPort<BenefitMemberPort>('member', 'benefit');
