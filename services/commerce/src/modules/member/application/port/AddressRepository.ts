import type { CipherEnvelope } from '../../../../pipeline/KmsPort';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AddressBook, RemoveAddressDecision, SaveAddressDecision } from '../../domain/model/AddressBook';

export interface MemberAddressInput {
  readonly id: string;
  readonly member: string;
  readonly recipient: string;
  readonly mobile: string;
  readonly address: string;
  readonly region: string;
  readonly recipientEnvelope: CipherEnvelope;
  readonly mobileEnvelope: CipherEnvelope;
  readonly addressEnvelope: CipherEnvelope;
  readonly expectedVersion: number;
}

export interface MemberAddressSummary {
  readonly id: string;
  readonly recipient_masked: string;
  readonly mobile_masked: string;
  readonly address_masked: string;
  readonly region_code: string;
  readonly is_default: boolean;
  readonly status: 'active' | 'deleted';
  readonly version: number;
}

export interface AddressRepository {
  list(context: ReadTransactionContext, member: string, after: string | null, limit: number): Promise<readonly MemberAddressSummary[]>;
  book(context: WriteTransactionContext, member: string): Promise<AddressBook>;
  remove(context: WriteTransactionContext, member: string, decision: RemoveAddressDecision): Promise<Readonly<{ id: string; status: string; version: number }> | null>;
  save(context: WriteTransactionContext, input: MemberAddressInput, decision: SaveAddressDecision): Promise<MemberAddressSummary | null>;
}
