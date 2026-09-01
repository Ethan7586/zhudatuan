import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { AuthTicketBinding } from './AuthTicketPort';

export interface MembershipCandidate {
  readonly id: string;
  readonly target: 'console' | 'storefront';
}
export interface MembershipSelectionValue {
  readonly id: string;
  readonly principal: string;
  readonly target: 'console' | 'storefront';
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
