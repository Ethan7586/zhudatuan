import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface ReferralMemberPort {
  eligible(
    context: ReadTransactionContext,
    scopeId: string,
    membershipId: string
  ): Promise<Readonly<{
    memberId: string;
    scopeId: string;
    version: number;
  }> | null>;
}
export const REFERRAL_MEMBER_PORT = publicPort<ReferralMemberPort>('member', 'referral');
