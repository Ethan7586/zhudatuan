import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface MemberAddressSnapshot {
  readonly id: string;
  readonly recipientCiphertext: string;
  readonly mobileCiphertext: string;
  readonly addressCiphertext: string;
  readonly recipientMasked: string;
  readonly mobileMasked: string;
  readonly addressMasked: string;
  readonly regionCode: string;
  readonly isDefault: boolean;
  readonly version: number;
}

export interface MemberAddressPort {
  snapshot(context: ReadTransactionContext, id: string | null, member: string): Promise<MemberAddressSnapshot | null>;
}

export const MEMBER_ADDRESS_PORT = publicPort<MemberAddressPort>('member', 'address');
