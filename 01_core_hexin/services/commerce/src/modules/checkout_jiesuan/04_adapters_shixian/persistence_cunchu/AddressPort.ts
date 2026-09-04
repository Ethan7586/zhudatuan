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
  readonly expectedVersion: number | null;
}

export class AddressPort {
  list(database: OperationDatabase, member: string, after: string | null, limit: number) {
    return database.query(`select id,recipient_masked,mobile_masked,address_masked,region_code,status,version from checkout.address
      where member_id=$1 and status='active' and ($2::text is null or id>$2) order by id limit $3`, [member, after, limit]);
  }

  remove(database: OperationDatabase, id: string, member: string, expectedVersion: number | null) {
    return database.query(`update checkout.address set status='deleted',version=version+1
      where id=$1 and member_id=$2 and ($3::bigint is null or version=$3) returning id,status,version`, [id, member, expectedVersion]);
  }

  save(database: OperationDatabase, input: AddressInput) {
    return database.query(`insert into checkout.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,
      recipient_masked,mobile_masked,address_masked,region_code,status,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',0)
      on conflict(id) do update set recipient_ciphertext=excluded.recipient_ciphertext,mobile_ciphertext=excluded.mobile_ciphertext,
      address_ciphertext=excluded.address_ciphertext,region_token=excluded.region_token,address_token=excluded.address_token,
      recipient_masked=excluded.recipient_masked,mobile_masked=excluded.mobile_masked,address_masked=excluded.address_masked,region_code=excluded.region_code,
      status='active',version=checkout.address.version+1 where checkout.address.member_id=$2 and ($12::bigint is null or checkout.address.version=$12)
      returning id,recipient_masked,mobile_masked,address_masked,region_code,status,version`, [input.id, input.member,
      input.recipientEnvelope.ciphertext, input.mobileEnvelope.ciphertext, input.addressEnvelope.ciphertext,
      createHash('sha256').update(input.region).digest('hex'), input.addressEnvelope.fingerprint,
      maskName(input.recipient), maskMobile(input.mobile), maskAddress(input.address), input.region, input.expectedVersion]);
  }
}

function maskName(value: string): string { return value.length < 2 ? '*' : `${value.slice(0, 1)}${'*'.repeat(Math.min(3, value.length - 1))}`; }
function maskMobile(value: string): string { return `${value.slice(0, 3)}****${value.slice(-4)}`; }
function maskAddress(value: string): string { return `${value.slice(0, Math.min(8, value.length))}***`; }

export const addressPort = new AddressPort();
