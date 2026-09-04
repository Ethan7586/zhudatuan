import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { AuthTicketBinding } from './AuthTicketPort';
import type { MembershipCandidate } from '../model/MembershipCandidate';
export type { MembershipCandidate } from '../model/MembershipCandidate';

export interface MembershipSelectionValue {
  readonly id: string;
  readonly principal: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly memberships: readonly MembershipCandidate[];
  readonly expiresAt: Date;
  readonly transaction: string | null;
  readonly returnTarget: string;
  readonly authorization: AuthTicketBinding;
  readonly assurance: number;
}

export interface MembershipSelectionPort {
  create(
    context: WriteTransactionContext,
    input: Omit<MembershipSelectionValue, 'id' | 'expiresAt' | 'transaction'> &
      Readonly<{
        browser: Buffer;
        device: Buffer;
      }>
  ): Promise<Readonly<{ id: string; token: string }>>;
  read(context: ReadTransactionContext, id: string): Promise<MembershipSelectionValue>;
  consume(context: WriteTransactionContext, id: string, browser: Buffer, device: Buffer, membership: string): Promise<MembershipSelectionValue>;
}
