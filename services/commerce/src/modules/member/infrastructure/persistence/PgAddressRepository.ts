import { createHash } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AddressRepository, MemberAddressInput, MemberAddressSummary } from '../../application/port/AddressRepository';
import type { MemberAddressPort, MemberAddressSnapshot } from '../../public/MemberAddressPort';

interface AddressRow {
  readonly id: string;
  readonly recipient_masked: string;
  readonly mobile_masked: string;
  readonly address_masked: string;
  readonly region_code: string;
  readonly status: 'active' | 'deleted';
  readonly version: number;
}

interface AddressSnapshotRow extends AddressRow {
  readonly recipient_ciphertext: string;
  readonly mobile_ciphertext: string;
  readonly address_ciphertext: string;
}

export class PgAddressRepository implements AddressRepository, MemberAddressPort {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async snapshot(context: ReadTransactionContext, id: string | null, member: string): Promise<MemberAddressSnapshot | null> {
    if (id === null) return null;
    const result = await this.transactions.database(context).query<AddressSnapshotRow>(
      `select id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,
      recipient_masked,mobile_masked,address_masked,region_code,status,version from member.address
      where id=$1 and member_id=$2 and status='active'`,
      [id, member]
    );
    const row = result.rows[0];
    return row ? addressSnapshot(row) : null;
  }

  async list(context: ReadTransactionContext, member: string, after: string | null, limit: number): Promise<readonly MemberAddressSummary[]> {
    const result = await this.transactions.database(context).query<AddressRow>(
      `select id,recipient_masked,mobile_masked,address_masked,region_code,status,version from member.address
      where member_id=$1 and status='active' and ($2::text is null or id>$2) order by id limit $3`,
      [member, after, limit]
    );
    return Object.freeze(result.rows.map(addressSummary));
  }

  async remove(context: WriteTransactionContext, id: string, member: string, expectedVersion: number | null) {
    const result = await this.transactions.database(context).query<{ id: string; status: string; version: number }>(
      `update member.address set status='deleted',version=version+1
      where id=$1 and member_id=$2 and ($3::bigint is null or version=$3) returning id,status,version`,
      [id, member, expectedVersion]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0], version: Number(result.rows[0].version) }) : null;
  }

  async save(context: WriteTransactionContext, input: MemberAddressInput): Promise<MemberAddressSummary | null> {
    const result = await this.transactions.database(context).query<AddressRow>(
      `insert into member.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,
      recipient_masked,mobile_masked,address_masked,region_code,status,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',0)
      on conflict(id) do update set recipient_ciphertext=excluded.recipient_ciphertext,mobile_ciphertext=excluded.mobile_ciphertext,
      address_ciphertext=excluded.address_ciphertext,region_token=excluded.region_token,address_token=excluded.address_token,
      recipient_masked=excluded.recipient_masked,mobile_masked=excluded.mobile_masked,address_masked=excluded.address_masked,region_code=excluded.region_code,
      status='active',version=member.address.version+1 where member.address.member_id=$2 and ($12::bigint is null or member.address.version=$12)
      returning id,recipient_masked,mobile_masked,address_masked,region_code,status,version`,
      [
        input.id,
        input.member,
        input.recipientEnvelope.ciphertext,
        input.mobileEnvelope.ciphertext,
        input.addressEnvelope.ciphertext,
        createHash('sha256').update(input.region).digest('hex'),
        input.addressEnvelope.fingerprint,
        maskName(input.recipient),
        maskMobile(input.mobile),
        maskAddress(input.address),
        input.region,
        input.expectedVersion,
      ]
    );
    return result.rows[0] ? addressSummary(result.rows[0]) : null;
  }
}

function addressSummary(row: AddressRow): MemberAddressSummary {
  return Object.freeze({ id: row.id, recipient_masked: row.recipient_masked, mobile_masked: row.mobile_masked, address_masked: row.address_masked, region_code: row.region_code, status: row.status, version: Number(row.version) });
}

function addressSnapshot(row: AddressSnapshotRow): MemberAddressSnapshot {
  return Object.freeze({
    id: row.id,
    recipientCiphertext: row.recipient_ciphertext,
    mobileCiphertext: row.mobile_ciphertext,
    addressCiphertext: row.address_ciphertext,
    recipientMasked: row.recipient_masked,
    mobileMasked: row.mobile_masked,
    addressMasked: row.address_masked,
    regionCode: row.region_code,
    version: Number(row.version),
  });
}

function maskName(value: string): string {
  return value.length < 2 ? '*' : `${value.slice(0, 1)}${'*'.repeat(Math.min(3, value.length - 1))}`;
}
function maskMobile(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
function maskAddress(value: string): string {
  return `${value.slice(0, Math.min(8, value.length))}***`;
}
