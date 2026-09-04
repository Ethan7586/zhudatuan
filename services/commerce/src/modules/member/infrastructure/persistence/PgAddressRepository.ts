import { createHash } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AddressRepository, MemberAddressInput, MemberAddressSummary } from '../../application/port/AddressRepository';
import { AddressBook } from '../../domain/model/AddressBook';
import type { RemoveAddressDecision, SaveAddressDecision } from '../../domain/model/AddressBook';
import { AddressPolicy } from '../../domain/policy/AddressPolicy';
import type { MemberAddressPort, MemberAddressSnapshot } from '../../public/MemberAddressPort';

interface AddressRow {
  readonly id: string;
  readonly recipient_masked: string;
  readonly mobile_masked: string;
  readonly address_masked: string;
  readonly region_code: string;
  readonly is_default: boolean;
  readonly status: 'active' | 'deleted';
  readonly version: number;
}

interface AddressSnapshotRow extends AddressRow {
  readonly recipient_ciphertext: string;
  readonly mobile_ciphertext: string;
  readonly address_ciphertext: string;
}

export class PgAddressRepository implements AddressRepository, MemberAddressPort {
  private readonly policy = new AddressPolicy();
  constructor(private readonly transactions: PgTransactionAccess) {}

  async snapshot(context: ReadTransactionContext, id: string | null, member: string): Promise<MemberAddressSnapshot | null> {
    if (id === null) return null;
    const result = await this.transactions.database(context).query<AddressSnapshotRow>(
      `select id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,
      recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version from member.address
      where id=$1 and member_id=$2 and status='active'`,
      [id, member]
    );
    const row = result.rows[0];
    return row ? addressSnapshot(row) : null;
  }

  async list(context: ReadTransactionContext, member: string, after: string | null, limit: number): Promise<readonly MemberAddressSummary[]> {
    const result = await this.transactions.database(context).query<AddressRow>(
      `select id,recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version from member.address
      where member_id=$1 and status='active' and ($2::text is null or id>$2)
      order by id limit $3`,
      [member, after, limit]
    );
    return Object.freeze(result.rows.map(addressSummary));
  }

  async book(context: WriteTransactionContext, member: string): Promise<AddressBook> {
    const database = this.transactions.database(context);
    const owner = await database.query<{ id: string }>("select id from member.profile where id=$1 and status='active' for update", [member]);
    if (!owner.rows[0]) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    const result = await database.query<Pick<AddressRow, 'id' | 'is_default' | 'status' | 'version'>>('select id,is_default,status,version from member.address where member_id=$1 order by is_default desc,id for update', [member]);
    return new AddressBook(
      member,
      result.rows.map((row) => ({ id: row.id, isDefault: row.is_default, state: row.status, version: Number(row.version) }))
    );
  }

  async remove(context: WriteTransactionContext, member: string, decision: RemoveAddressDecision) {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; status: string; version: number }>(
      `update member.address set status='deleted',is_default=false,version=version+1,updated_at=clock_timestamp()
      where id=$1 and member_id=$2 and status='active' and version=$3 returning id,status,version`,
      [decision.id, member, decision.expectedVersion]
    );
    if (result.rows[0] && decision.promote !== null) {
      await database.query(
        `update member.address set is_default=true,version=version+1,updated_at=clock_timestamp()
        where id=$1 and member_id=$2 and status='active'`,
        [decision.promote, member]
      );
    }
    return result.rows[0] ? Object.freeze({ ...result.rows[0], version: Number(result.rows[0].version) }) : null;
  }

  async save(context: WriteTransactionContext, input: MemberAddressInput, decision: SaveAddressDecision): Promise<MemberAddressSummary | null> {
    const database = this.transactions.database(context);
    if (decision.isDefault) {
      await database.query(
        `update member.address set is_default=false,version=version+1,updated_at=clock_timestamp()
        where member_id=$1 and status='active' and is_default and id<>$2`,
        [input.member, input.id]
      );
    }
    const masked = this.policy.mask(input);
    const result = await database.query<AddressRow>(
      `insert into member.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,
      recipient_masked,mobile_masked,address_masked,region_code,is_default,status,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',clock_timestamp(),clock_timestamp(),1)
      on conflict(id) do update set recipient_ciphertext=excluded.recipient_ciphertext,mobile_ciphertext=excluded.mobile_ciphertext,
      address_ciphertext=excluded.address_ciphertext,region_token=excluded.region_token,address_token=excluded.address_token,
      recipient_masked=excluded.recipient_masked,mobile_masked=excluded.mobile_masked,address_masked=excluded.address_masked,region_code=excluded.region_code,
      is_default=excluded.is_default,status='active',updated_at=clock_timestamp(),version=member.address.version+1
      where member.address.member_id=$2 and member.address.version=$13
      returning id,recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version`,
      [
        input.id,
        input.member,
        input.recipientEnvelope.ciphertext,
        input.mobileEnvelope.ciphertext,
        input.addressEnvelope.ciphertext,
        createHash('sha256').update(input.region).digest('hex'),
        input.addressEnvelope.fingerprint,
        masked.recipient,
        masked.mobile,
        masked.address,
        input.region,
        decision.isDefault,
        input.expectedVersion,
      ]
    );
    return result.rows[0] ? addressSummary(result.rows[0]) : null;
  }
}

function addressSummary(row: AddressRow): MemberAddressSummary {
  return Object.freeze({
    id: row.id,
    recipient_masked: row.recipient_masked,
    mobile_masked: row.mobile_masked,
    address_masked: row.address_masked,
    region_code: row.region_code,
    is_default: row.is_default,
    status: row.status,
    version: Number(row.version),
  });
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
    isDefault: row.is_default,
    version: Number(row.version),
  });
}
