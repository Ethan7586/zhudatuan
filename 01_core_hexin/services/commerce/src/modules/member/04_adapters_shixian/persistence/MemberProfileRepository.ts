import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { MemberProfile } from '../../01_public_gongkai/MemberPort';

export async function readSecurityProfile(database: OperationDatabase, principal: string): Promise<Readonly<{
  displayName: string | null;
  mobileCiphertext: string | null;
}>> {
  const result = await database.query<{ display_name: string; mobile_ciphertext: string | null }>(
    `select display_name,mobile_ciphertext from member.profile
      where principal_id=$1 and status='active'`,
    [principal]
  );
  return {
    displayName: result.rows[0]?.display_name ?? null,
    mobileCiphertext: result.rows[0]?.mobile_ciphertext ?? null,
  };
}

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
