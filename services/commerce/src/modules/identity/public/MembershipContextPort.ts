import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface MembershipContext {
  readonly principal: string;
  readonly membership: string;
  readonly membershipStatus: string;
  readonly accessVersion: number;
  readonly assurance: number;
}

export interface MembershipContextPort {
  read(context: ReadTransactionContext, principal: string, membership: string): Promise<MembershipContext>;
}

export const MEMBERSHIP_CONTEXT_PORT = publicPort<MembershipContextPort>('identity', 'membershipcontext');
