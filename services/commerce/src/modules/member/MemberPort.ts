import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface MemberInvite {
  readonly organization_id: string;
  readonly role_id: string;
  readonly storefront_role_id: string;
  readonly target_client: 'storefront' | 'operator';
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
    const result = await database.query<{ mobile_ciphertext: string | null }>(
      `select mobile_ciphertext from member.profile
      where principal_id=$1 and status='active'`,
      [principal]
    );
    return { mobileCiphertext: result.rows[0]?.mobile_ciphertext ?? null };
  }

  invite(database: OperationDatabase, token: string) {
    return database.query(
      `select policy.terms_title,policy.terms_body,policy.privacy_title,policy.privacy_body,invite.terms_hash,
        invite.target_client,invite.effective_at,invite.expires_at
      from member.invite invite join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
      where invite.token_hash=$1 and invite.status='active' and invite.effective_at<=clock_timestamp()
        and invite.expires_at>clock_timestamp() and invite.use_count<invite.max_uses`,
      [token]
    );
  }

  async consumeInvite(database: OperationDatabase, token: string, destinationHash: string): Promise<MemberInvite> {
    const result = await database.query<MemberInvite>(
      `with consumed as(update member.invite set use_count=use_count+1,
      accepted_at=case when use_count+1=max_uses then clock_timestamp() else accepted_at end,version=version+1
      where token_hash=$1 and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
        and use_count<max_uses and (allowed_destination_hash is null or allowed_destination_hash=$2)
      returning organization_id,role_id,storefront_role_id,target_client,terms_hash)
      select organization_id,role_id,storefront_role_id,target_client,terms_hash from consumed`,
      [token, destinationHash]
    );
    const invitation = result.rows[0];
    if (!invitation) throw new Error('INVITE_INVALID');
    return invitation;
  }

  async create(database: OperationDatabase, input: MemberProfile): Promise<void> {
    await database.query(
      `insert into member.profile(id,principal_id,display_name,status,mobile_ciphertext,mobile_token,mobile_masked,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp())`,
      [input.member, input.principal, input.display, input.status, input.mobileCiphertext ?? null, input.mobileFingerprint ?? null, input.mobileMasked ?? '***']
    );
  }

  async ensureImported(database: OperationDatabase, input: MemberProfile): Promise<void> {
    await database.query(
      `insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
      values($1,$2,$3,$4,clock_timestamp(),clock_timestamp()) on conflict(id) do update set
      display_name=excluded.display_name,updated_at=clock_timestamp(),version=member.profile.version+1`,
      [input.member, input.principal, input.display, input.status]
    );
  }

  async changeMobile(database: OperationDatabase, principal: string, ciphertext: string, fingerprint: string, masked: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query(
      `update member.profile set mobile_ciphertext=$2,mobile_token=$3,version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,$4::text mobile_masked,version`,
      [principal, ciphertext, fingerprint, masked]
    );
    const row = result.rows[0];
    if (!row) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    return row;
  }
}

export const memberPort = new MemberPort();
