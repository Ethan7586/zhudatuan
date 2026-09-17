import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { MemberProfile } from '../../01_public_gongkai/MemberPort';

export async function createMemberProfile(database: OperationDatabase, input: MemberProfile): Promise<void> {
  await database.query(
    `insert into member.profile(id,principal_id,display_name,status,mobile_ciphertext,mobile_token,mobile_masked,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp())`,
    [input.member, input.principal, input.display, input.status, input.mobileCiphertext ?? null, input.mobileFingerprint ?? null, input.mobileMasked ?? '***']
  );
}

export async function ensureImportedMemberProfile(database: OperationDatabase, input: MemberProfile): Promise<void> {
  await database.query('select member.ensure_imported_profile($1,$2,$3)', [input.member, input.principal, input.display]);
}

export async function changeMemberMobile(
  database: OperationDatabase,
  principal: string,
  ciphertext: string,
  fingerprint: string,
  masked: string,
): Promise<Readonly<Record<string, unknown>>> {
  const result = await database.query(
    `update member.profile set mobile_ciphertext=$2,mobile_token=$3,mobile_masked=$4,version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,mobile_masked,version`,
    [principal, ciphertext, fingerprint, masked]
  );
  const row = result.rows[0];
  if (!row) throw new Error('MEMBER_PROFILE_NOT_FOUND');
  return row;
}
