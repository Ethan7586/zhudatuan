import { DomainError } from '../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { IdentityMemberPort } from './public/IdentityMemberPort';
import type { InvitationMemberPort, InvitationMobileOwner, PendingInvitationMember } from './public/InvitationMemberPort';

export interface MemberProfile {
  readonly member: string;
  readonly principal: string;
  readonly display: string;
  readonly status: 'active' | 'pending';
  readonly mobileCiphertext?: string;
  readonly mobileFingerprint?: string;
  readonly mobileMasked?: string;
}

export class MemberPort implements IdentityMemberPort, InvitationMemberPort {
  async pending(database: OperationDatabase, member: string): Promise<PendingInvitationMember> {
    const result = await database.query<Readonly<{ member: string; principal: string; mobile_ciphertext: string | null }>>(
      `select profile.id member,
      profile.principal_id principal,profile.mobile_ciphertext from member.profile profile
      where profile.id=$1 and profile.status='pending' for update`,
      [member]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    return Object.freeze({ member: row.member, principal: row.principal, mobileCiphertext: row.mobile_ciphertext });
  }

  async assertMobileAvailable(database: OperationDatabase, fingerprint: string, exceptMember?: string): Promise<void> {
    if (await this.mobileOwner(database, fingerprint, exceptMember)) throw new DomainError('REGISTRATION_REJECTED');
  }

  async mobileOwner(database: OperationDatabase, fingerprint: string, exceptMember?: string): Promise<InvitationMobileOwner | null> {
    const existing = await database.query<{ id: string; principal_id: string }>(
      `select id,principal_id from member.profile
      where mobile_token=$1 and status in('pending','active') and ($2::text is null or id<>$2) order by id limit 1`,
      [fingerprint, exceptMember ?? null]
    );
    const row = existing.rows[0];
    return row ? Object.freeze({ member: row.id, principal: row.principal_id }) : null;
  }

  async createPending(database: OperationDatabase, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void> {
    const created = await database.query(
      `insert into member.profile(id,principal_id,display_name,status,mobile_ciphertext,mobile_token,
      mobile_masked,created_at,updated_at,version) values($1,$2,$3,'pending',$4,$5,$6,clock_timestamp(),clock_timestamp(),1)
      returning id`,
      [input.member, input.principal, input.display, input.mobileCiphertext, input.mobileFingerprint, input.mobileMasked]
    );
    if (!created.rows[0]) throw new Error('MEMBER_PROFILE_CREATE_FAILED');
  }

  async memberForPrincipal(database: OperationDatabase, principal: string): Promise<string> {
    const result = await database.query<{ id: string }>('select id from member.profile where principal_id=$1 and status=$2', [principal, 'active']);
    if (!result.rows[0]) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    return result.rows[0].id;
  }

  async activate(database: OperationDatabase, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void> {
    const result = await database.query(
      `update member.profile set display_name=$3,mobile_ciphertext=$4,mobile_token=$5,mobile_masked=$6,
      status='active',version=version+1,updated_at=clock_timestamp() where id=$1 and principal_id=$2 and status='pending' returning id`,
      [input.member, input.principal, input.display, input.mobileCiphertext, input.mobileFingerprint, input.mobileMasked]
    );
    if (!result.rows[0]) throw new DomainError('MEMBERSHIP_NOT_INVITED');
  }
  async securityProfile(database: OperationDatabase, principal: string): Promise<Readonly<{ mobileCiphertext: string | null; mobileFingerprint: string | null }>> {
    const result = await database.query<{ mobile_ciphertext: string | null; mobile_token: string | null }>(
      `select mobile_ciphertext,mobile_token from member.profile
      where principal_id=$1 and status='active'`,
      [principal]
    );
    return {
      mobileCiphertext: result.rows[0]?.mobile_ciphertext ?? null,
      mobileFingerprint: result.rows[0]?.mobile_token ?? null,
    };
  }

  async updateDisplay(database: OperationDatabase, member: string, display: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query(
      `update member.profile set display_name=$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id,display_name,version`,
      [member, display]
    );
    if (!result.rows[0]) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    return result.rows[0];
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
      `update member.profile set mobile_ciphertext=$2,mobile_token=$3,mobile_masked=$4,
      version=version+1,updated_at=clock_timestamp()
      where principal_id=$1 returning id,display_name,mobile_masked,version`,
      [principal, ciphertext, fingerprint, masked]
    );
    const row = result.rows[0];
    if (!row) throw new Error('MEMBER_PROFILE_NOT_FOUND');
    return row;
  }
}
