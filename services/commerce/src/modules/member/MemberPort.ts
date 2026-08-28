import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface MemberInvite {
  readonly organization_id: string;
  readonly role_id: string;
  readonly terms_hash: string;
}

export interface MemberProfile {
  readonly member: string;
  readonly principal: string;
  readonly display: string;
  readonly status: 'active' | 'pending';
  readonly mobileCiphertext?: string;
  readonly mobileFingerprint?: string;
  readonly mobileMasked?: string;
}

export class MemberPort {
  async securityProfile(database: OperationDatabase, principal: string): Promise<Readonly<{ mobileCiphertext: string | null }>> {
    const result = await database.query<{ mobile_ciphertext: string | null }>(`select mobile_ciphertext from member.profile
      where principal_id=$1 and status='active'`, [principal]);
    return { mobileCiphertext: result.rows[0]?.mobile_ciphertext ?? null };
  }

  invite(database: OperationDatabase, token: string) {
    return database.query(`select policy.terms_title,policy.terms_body,policy.privacy_title,policy.privacy_body,invite.terms_hash,invite.effective_at,invite.expires_at
      from member.invite invite join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and invite.role_id='role-zhudatuan-storefront-member' and role.status='active'
        and organization.kind='mall' and organization.status='active'
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash`, [token]);
  }

  async assertRegistrationInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<void> {
    const result = await database.query<{ id: string }>(`select invite.id from member.invite invite
      join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)
        and invite.role_id='role-zhudatuan-storefront-member' and role.status='active'
        and organization.kind='mall' and organization.status='active'
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash`, [token, destinationHash]);
    if (!result.rows[0]) throw new Error('INVITE_INVALID');
  }

  async consumeInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<MemberInvite> {
    const result = await database.query<MemberInvite>(`with candidate as materialized(
      select invite.id,invite.organization_id,invite.role_id,invite.terms_hash from member.invite invite
      join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)
        and invite.role_id='role-zhudatuan-storefront-member' and role.status='active'
        and organization.kind='mall' and organization.status='active'
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash for update of invite
    ), consumed as(update member.invite invite set use_count=invite.use_count+1,
      accepted_at=case when invite.use_count+1=invite.max_uses then clock_timestamp() else invite.accepted_at end,version=invite.version+1
      from candidate where invite.id=candidate.id
      returning candidate.organization_id,candidate.role_id,candidate.terms_hash)
      select organization_id,role_id,terms_hash from consumed`, [token, destinationHash]);
    const invitation = result.rows[0];
    if (!invitation) throw new Error('INVITE_INVALID');
    return invitation;
  }

  async create(database: OperationDatabase, input: MemberProfile): Promise<void> {
    await database.query(`insert into member.profile(id,principal_id,display_name,status,mobile_ciphertext,mobile_token,mobile_masked,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp())`, [input.member, input.principal, input.display,
      input.status, input.mobileCiphertext ?? null, input.mobileFingerprint ?? null, input.mobileMasked ?? '***']);
  }

  async ensureImported(database: OperationDatabase, input: MemberProfile): Promise<void> {
    await database.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
      values($1,$2,$3,$4,clock_timestamp(),clock_timestamp()) on conflict(id) do update set
      display_name=excluded.display_name,updated_at=clock_timestamp(),version=member.profile.version+1`,
    [input.member, input.principal, input.display, input.status]);
  }

  async changeMobile(database: OperationDatabase, principal: string, ciphertext: string, fingerprint: string, masked: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query(`update member.profile set mobile_ciphertext=$2,mobile_token=$3,mobile_masked=$4,
      version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,mobile_masked,version`, [principal, ciphertext, fingerprint, masked]);
    const row = result.rows[0];
    if (!row) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    return row;
  }
}

export const memberPort = new MemberPort();
