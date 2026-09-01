import type { CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

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
  readonly expectedVersion: number | null;
}

export interface MemberAddressSummary {
  readonly id: string;
  readonly recipient_masked: string;
  readonly mobile_masked: string;
  readonly address_masked: string;
  readonly region_code: string;
  readonly status: 'active' | 'deleted';
  readonly version: number;
}

export interface AddressRepository {
  list(context: ReadTransactionContext, member: string, after: string | null, limit: number): Promise<readonly MemberAddressSummary[]>;
  remove(context: WriteTransactionContext, id: string, member: string, expectedVersion: number | null): Promise<Readonly<{ id: string; status: string; version: number }> | null>;
  save(context: WriteTransactionContext, input: MemberAddressInput): Promise<MemberAddressSummary | null>;
}
