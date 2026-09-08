import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';

export interface AddressInput {
  readonly id: string;
  readonly member: string;
  readonly recipient: string;
  readonly mobile: string;
  readonly address: string;
  readonly region: string;
  readonly recipientEnvelope: CipherEnvelope;
  readonly mobileEnvelope: CipherEnvelope;
  readonly addressEnvelope: CipherEnvelope;
  readonly isDefault: boolean;
  readonly expectedVersion: number | null;
}

export class AddressPort {
  list(database: OperationDatabase, member: string, after: string | null, limit: number) {
    return database.query(`select id,recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version from checkout.address
      where member_id=$1 and status='active' and ($2::text is null or id>$2) order by id limit $3`, [member, after, limit]);
  }

  async remove(database: OperationDatabase, id: string, member: string, expectedVersion: number | null) {
    await memberLock(database, member);
    const removed = await database.query<{ is_default: boolean }>(`update checkout.address set status='deleted',is_default=false,version=version+1
      where id=$1 and member_id=$2 and ($3::bigint is null or version=$3) returning id,is_default,status,version`, [id, member, expectedVersion]);
    if (removed.rows[0]) {
      await database.query(`update checkout.address set is_default=true,version=version+1 where id=(
        select id from checkout.address where member_id=$1 and status='active' order by is_default desc,id limit 1
      ) and not exists(select 1 from checkout.address where member_id=$1 and status='active' and is_default)`, [member]);
    }
    return removed;
  }

  async save(database: OperationDatabase, input: AddressInput) {
    await memberLock(database, input.member);
    if (input.isDefault) {
      await database.query(`update checkout.address set is_default=false,version=version+1
        where member_id=$1 and status='active' and is_default and id<>$2`, [input.member, input.id]);
    }
    return database.query(`insert into checkout.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,
      recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      ($13::boolean or not exists(select 1 from checkout.address where member_id=$2 and status='active')),'active',0)
      on conflict(id) do update set recipient_ciphertext=excluded.recipient_ciphertext,mobile_ciphertext=excluded.mobile_ciphertext,
      address_ciphertext=excluded.address_ciphertext,region_token=excluded.region_token,address_token=excluded.address_token,
      recipient_masked=excluded.recipient_masked,mobile_masked=excluded.mobile_masked,address_masked=excluded.address_masked,region_code=excluded.region_code,
      is_default=($13::boolean or checkout.address.is_default or not exists(select 1 from checkout.address current_default
        where current_default.member_id=$2 and current_default.status='active' and current_default.id<>$1)),
      status='active',version=checkout.address.version+1 where checkout.address.member_id=$2 and ($12::bigint is null or checkout.address.version=$12)
      returning id,recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version`, [input.id, input.member,
      input.recipientEnvelope.ciphertext, input.mobileEnvelope.ciphertext, input.addressEnvelope.ciphertext,
      createHash('sha256').update(input.region).digest('hex'), input.addressEnvelope.fingerprint,
      maskName(input.recipient), maskMobile(input.mobile), maskAddress(input.address), input.region, input.expectedVersion, input.isDefault]);
  }

  async setDefault(database: OperationDatabase, id: string, member: string, expectedVersion: number | null) {
    await memberLock(database, member);
    const target = await database.query(`select id from checkout.address
      where id=$1 and member_id=$2 and status='active' and ($3::bigint is null or version=$3) for update`, [id, member, expectedVersion]);
    if (!target.rows[0]) return target;
    await database.query(`update checkout.address set is_default=false,version=version+1
      where member_id=$1 and status='active' and is_default and id<>$2`, [member, id]);
    return database.query(`update checkout.address set is_default=true,
      version=case when is_default then version else version+1 end where id=$1 and member_id=$2 and status='active'
      returning id,recipient_masked,mobile_masked,address_masked,region_code,is_default,status,version`, [id, member]);
  }
}

function memberLock(database: OperationDatabase, member: string) {
  return database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [member]);
}

function maskName(value: string): string { return value.length < 2 ? '*' : `${value.slice(0, 1)}${'*'.repeat(Math.min(3, value.length - 1))}`; }
function maskMobile(value: string): string { return `${value.slice(0, 3)}****${value.slice(-4)}`; }
function maskAddress(value: string): string { return `${value.slice(0, Math.min(8, value.length))}***`; }

export const addressPort = new AddressPort();
