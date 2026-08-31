import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
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
  readonly authorization: AuthTicketBinding;
  readonly assurance: number;
}

export interface MembershipSelectionPort {
  create(
    database: OperationDatabase,
    input: Omit<MembershipSelectionValue, 'id' | 'expiresAt' | 'transaction'> &
      Readonly<{
        browser: Buffer;
        device: Buffer;
      }>
  ): Promise<Readonly<{ id: string; token: string }>>;
  read(database: OperationDatabase, id: string): Promise<MembershipSelectionValue>;
  consume(database: OperationDatabase, id: string, browser: Buffer, device: Buffer, membership: string): Promise<MembershipSelectionValue>;
}
