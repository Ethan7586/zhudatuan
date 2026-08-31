import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface MemberInvite {
  readonly organization_id: string;
  readonly role_id: string;
<<<<<<< HEAD
<<<<<<< HEAD
  readonly target_client: 'storefront' | 'operator';
  readonly terms_hash: string;
  readonly storefront_organization_id: string | null;
=======
  readonly terms_hash: string;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly target_client: 'storefront' | 'operator';
  readonly terms_hash: string;
  readonly storefront_organization_id: string | null;
>>>>>>> 018b2a71 (chore(release): capture current production source)
}

export interface MemberProfile {
  readonly member: string;
  readonly principal: string;
  readonly display: string;
  readonly status: 'active' | 'pending';
<<<<<<< HEAD
<<<<<<< HEAD
  readonly mobileCiphertext?: string;
  readonly mobileFingerprint?: string;
  readonly mobileMasked?: string;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly mobileCiphertext?: string;
  readonly mobileFingerprint?: string;
  readonly mobileMasked?: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
}

export class MemberPort {
  async securityProfile(database: OperationDatabase, principal: string): Promise<Readonly<{ mobileCiphertext: string | null }>> {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const result = await database.query<{ mobile_ciphertext: string | null }>(
      `select mobile_ciphertext from member.profile
      where principal_id=$1 and status='active'`,
      [principal]
    );
<<<<<<< HEAD
=======
    const result = await database.query<{ mobile_ciphertext: string | null }>(`select mobile_ciphertext from member.profile
      where principal_id=$1 and status='active'`, [principal]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    return { mobileCiphertext: result.rows[0]?.mobile_ciphertext ?? null };
  }

  invite(database: OperationDatabase, token: string) {
<<<<<<< HEAD
<<<<<<< HEAD
    return database.query(
      `select policy.terms_title,policy.terms_body,policy.privacy_title,policy.privacy_body,invite.terms_hash,
        invite.target_client,invite.effective_at,invite.expires_at
      from member.invite invite join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and ${registrationInviteBoundary()}
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash`,
      [token]
    );
  }

  async assertRegistrationInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<void> {
    const result = await database.query<{ id: string }>(`select invite.id from member.invite invite
      join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)
        and ${registrationInviteBoundary()}
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash`, [token, destinationHash]);
    if (!result.rows[0]) throw new Error('INVITE_INVALID');
  }

  async consumeInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<MemberInvite> {
    const result = await database.query<MemberInvite>(`with candidate as materialized(
      select invite.id,invite.organization_id,invite.role_id,invite.terms_hash,invite.target_client,invite.storefront_organization_id from member.invite invite
      join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)
        and ${registrationInviteBoundary()}
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash for update of invite
    ), consumed as(update member.invite invite set use_count=invite.use_count+1,
      accepted_at=case when invite.use_count+1=invite.max_uses then clock_timestamp() else invite.accepted_at end,version=invite.version+1
      from candidate where invite.id=candidate.id
      returning candidate.organization_id,candidate.role_id,candidate.terms_hash,candidate.target_client,candidate.storefront_organization_id)
      select organization_id,role_id,terms_hash,target_client,storefront_organization_id from consumed`, [token, destinationHash]);
=======
    return database.query(`select policy.terms_title,policy.terms_body,policy.privacy_title,policy.privacy_body,invite.terms_hash,invite.effective_at,invite.expires_at
=======
    return database.query(
      `select policy.terms_title,policy.terms_body,policy.privacy_title,policy.privacy_body,invite.terms_hash,
        invite.target_client,invite.effective_at,invite.expires_at
>>>>>>> 018b2a71 (chore(release): capture current production source)
      from member.invite invite join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and ${registrationInviteBoundary()}
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash`,
      [token]
    );
  }

<<<<<<< HEAD
  async consumeInvite(database: OperationDatabase, token: string): Promise<MemberInvite> {
    const result = await database.query<MemberInvite>(`with consumed as(update member.invite set use_count=use_count+1,
      accepted_at=case when use_count+1=max_uses then clock_timestamp() else accepted_at end,version=version+1
      where token_hash=$1 and status='active' and expires_at>clock_timestamp() and use_count<max_uses
      returning organization_id,role_id,terms_hash) select organization_id,role_id,terms_hash from consumed`, [token]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  async assertRegistrationInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<void> {
    const result = await database.query<{ id: string }>(`select invite.id from member.invite invite
      join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)
        and ${registrationInviteBoundary()}
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash`, [token, destinationHash]);
    if (!result.rows[0]) throw new Error('INVITE_INVALID');
  }

  async consumeInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<MemberInvite> {
    const result = await database.query<MemberInvite>(`with candidate as materialized(
      select invite.id,invite.organization_id,invite.role_id,invite.terms_hash,invite.target_client,invite.storefront_organization_id from member.invite invite
      join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      join organization.organization organization on organization.id=invite.organization_id
      join access.role role on role.id=invite.role_id and role.scope_id=invite.organization_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses
        and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)
        and ${registrationInviteBoundary()}
        and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
        and policy.terms_hash=invite.terms_hash for update of invite
    ), consumed as(update member.invite invite set use_count=invite.use_count+1,
      accepted_at=case when invite.use_count+1=invite.max_uses then clock_timestamp() else invite.accepted_at end,version=invite.version+1
      from candidate where invite.id=candidate.id
      returning candidate.organization_id,candidate.role_id,candidate.terms_hash,candidate.target_client,candidate.storefront_organization_id)
      select organization_id,role_id,terms_hash,target_client,storefront_organization_id from consumed`, [token, destinationHash]);
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const invitation = result.rows[0];
    if (!invitation) throw new Error('INVITE_INVALID');
    return invitation;
  }

  async create(database: OperationDatabase, input: MemberProfile): Promise<void> {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    await database.query(
      `insert into member.profile(id,principal_id,display_name,status,mobile_ciphertext,mobile_token,mobile_masked,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp())`,
      [input.member, input.principal, input.display, input.status, input.mobileCiphertext ?? null, input.mobileFingerprint ?? null, input.mobileMasked ?? '***']
    );
<<<<<<< HEAD
  }

  async ensureImported(database: OperationDatabase, input: MemberProfile): Promise<void> {
    await database.query('select member.ensure_imported_profile($1,$2,$3)', [input.member, input.principal, input.display]);
  }

  async changeMobile(database: OperationDatabase, principal: string, ciphertext: string, fingerprint: string, masked: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query(
      `update member.profile set mobile_ciphertext=$2,mobile_token=$3,version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,$4::text mobile_masked,version`,
      [principal, ciphertext, fingerprint, masked]
    );
=======
    await database.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
      values($1,$2,$3,$4,clock_timestamp(),clock_timestamp())`, [input.member, input.principal, input.display, input.status]);
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  }

  async ensureImported(database: OperationDatabase, input: MemberProfile): Promise<void> {
    await database.query('select member.ensure_imported_profile($1,$2,$3)', [input.member, input.principal, input.display]);
  }

  async changeMobile(database: OperationDatabase, principal: string, ciphertext: string, fingerprint: string, masked: string): Promise<Readonly<Record<string, unknown>>> {
<<<<<<< HEAD
    const result = await database.query(`update member.profile set mobile_ciphertext=$2,mobile_token=$3,version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,$4::text mobile_masked,version`, [principal, ciphertext, fingerprint, masked]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const result = await database.query(
      `update member.profile set mobile_ciphertext=$2,mobile_token=$3,version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,$4::text mobile_masked,version`,
      [principal, ciphertext, fingerprint, masked]
    );
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const row = result.rows[0];
    if (!row) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    return row;
  }
}

export const memberPort = new MemberPort();
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

function registrationInviteBoundary(): string {
  return `(role.status='active' and organization.status='active' and (
    (invite.target_client='storefront' and invite.role_id='role-zhudatuan-storefront-member'
      and invite.storefront_organization_id is null and organization.kind='mall')
    or (invite.target_client='operator' and invite.role_id='role-zhudatuan-pending-operator'
      and invite.storefront_organization_id is not null and organization.kind='tenant'
      and not exists(select 1 from access.rolepermission pendingpermission where pendingpermission.role_id=role.id)
      and exists(select 1 from organization.organization storefront
        join organization.unitclosure closure on closure.descendant_id=storefront.id
        where storefront.id=invite.storefront_organization_id and storefront.kind='mall' and storefront.status='active'
          and closure.ancestor_id=organization.id))
  ))`;
}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
