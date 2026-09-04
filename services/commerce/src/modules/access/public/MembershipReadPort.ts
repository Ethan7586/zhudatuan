import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface MembershipReadPort {
  member(context: ReadTransactionContext, membership: string): Promise<string | null>;
  summaries(context: ReadTransactionContext, memberships: readonly string[], scope: string): Promise<readonly MembershipSummary[]>;
}
export interface MembershipSummary {
  readonly membership: string;
  readonly member: string;
  readonly employeeNo: string | null;
}
export const MEMBERSHIP_READ_PORT = publicPort<MembershipReadPort>('access', 'membershipread');
