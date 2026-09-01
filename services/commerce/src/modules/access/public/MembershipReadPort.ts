import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface MembershipReadPort {
  member(context: ReadTransactionContext, membership: string): Promise<string | null>;
}
export const MEMBERSHIP_READ_PORT = publicPort<MembershipReadPort>('access', 'membershipread');
