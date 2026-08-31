import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { InvitationCreatedRecord, InvitationFilter, InvitationListRecord, InvitationRepository, InvitationRevokedRecord, NewInvitation } from '../../application/port/InvitationRepository';
import { Invitation, type InvitationState } from '../../domain/model/Invitation';
import { InvitationClaim } from '../../domain/model/InvitationClaim';
import type { InvitationDigest } from '../../application/port/InvitationSecurity';
import { claimOf, createdOf, invitationOf, invitationState, listOf, revokedOf, type CreatedRow, type InvitationRow, type ListRow, type RevokedRow } from './InvitationRecord';
import { PgInvitationRedemption } from './PgInvitationRedemption';

export class PgInvitationRepository extends PgInvitationRedemption implements InvitationRepository {
  async find(database: OperationDatabase, hashes: readonly InvitationDigest[], target: 'console' | 'storefront', lock: boolean): Promise<Invitation> {
    const result = await database.query<InvitationRow>(
      `select id,kind,target,organization_id,membership_id,principal_id,recipient_hash,
      token_key_version,issuer_membership_id,issuer_access_version,grant_digest,minimum_assurance,max_uses,use_count,not_before,
      expires_at,status,policy_id,terms_hash,reason,version from identity.invitation
      where token_hash=any($1::bytea[]) and token_key_version=any($2::text[]) and target=$3
      and exists(select 1 from unnest($1::bytea[],$2::text[]) candidate(hash,version)
        where candidate.hash=identity.invitation.token_hash and candidate.version=identity.invitation.token_key_version)
      limit 2 ${lock ? 'for update' : ''}`,
      [hashes.map(({ hash }) => hash), hashes.map(({ version }) => version), target]
    );
    const row = result.rows[0];
    if (!row || result.rows.length !== 1) throw new DomainError('INVITATION_INVALID');
    return invitationOf(row, target, this.clock.now());
  }

  async claimed(database: OperationDatabase, claim: string, target: 'console' | 'storefront', lock: boolean): Promise<Invitation> {
    const result = await database.query<InvitationRow>(
      `select invitation.id,invitation.kind,invitation.target,invitation.organization_id,
      invitation.membership_id,invitation.principal_id,invitation.recipient_hash,invitation.token_key_version,
      invitation.issuer_membership_id,invitation.issuer_access_version,invitation.grant_digest,invitation.minimum_assurance,
      invitation.max_uses,invitation.use_count,invitation.not_before,invitation.expires_at,invitation.status,invitation.policy_id,
      invitation.terms_hash,invitation.reason,invitation.version from identity.invitationclaim claim
      join identity.invitation invitation on invitation.id=claim.invitation_id
      where claim.id=$1 and claim.target=$2 and claim.state in('reserved','proofpending','proved')
      and claim.expires_at>clock_timestamp() ${lock ? 'for update of invitation,claim' : ''}`,
      [claim, target]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('PREAUTH_EXPIRED');
    return invitationOf(row, target, this.clock.now());
  }

  async claim(database: OperationDatabase, id: string): Promise<InvitationClaim> {
    const result = await database.query<{
      id: string;
      invitation_id: string;
      kind: InvitationState['kind'];
      target: 'console' | 'storefront';
      recipient_hash: Buffer | null;
      state: InvitationClaim['state'];
      proof_method: InvitationClaim['proof'];
      expires_at: Date;
      proved_at: Date | null;
      version: number;
    }>(
      `select id::text,invitation_id,kind,target,recipient_hash,state,proof_method,expires_at,proved_at,version
      from identity.invitationclaim where id=$1 and state in('reserved','proofpending','proved') and expires_at>clock_timestamp()`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('PREAUTH_EXPIRED');
    return claimOf(row);
  }

  async bindRecipient(database: OperationDatabase, id: string, recipient: Buffer): Promise<InvitationClaim> {
    const result = await database.query<{
      id: string;
      invitation_id: string;
      kind: InvitationState['kind'];
      target: 'console' | 'storefront';
      recipient_hash: Buffer | null;
      state: InvitationClaim['state'];
      proof_method: InvitationClaim['proof'];
      expires_at: Date;
      proved_at: Date | null;
      version: number;
    }>(
      `update identity.invitationclaim set recipient_hash=coalesce(recipient_hash,$2),
      updated_at=case when recipient_hash is null then clock_timestamp() else updated_at end,
      version=case when recipient_hash is null then version+1 else version end where id=$1
      and state in('reserved','proofpending','proved') and expires_at>clock_timestamp()
      and (recipient_hash is null or recipient_hash=$2) returning id::text,invitation_id,kind,target,recipient_hash,state,proof_method,
      expires_at,proved_at,version`,
      [id, recipient]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('INVITATION_INVALID');
    return claimOf(row);
  }

  async create(database: OperationDatabase, value: NewInvitation): Promise<InvitationCreatedRecord> {
    const notBefore = this.clock.now();
    const invitation = new Invitation(
      Object.freeze({
        id: value.id,
        kind: value.kind,
        target: value.target,
        organization: value.organization,
        membership: value.membership,
        principal: value.principal,
        recipientHash: value.recipientHash,
        keyVersion: value.token.version,
        issuer: value.issuer,
        issuerAccessVersion: value.issuerAccessVersion,
        grantDigest: value.grantDigest,
        assurance: value.assurance,
        maxUses: value.maxUses,
        useCount: 0,
        notBefore,
        expiresAt: value.expiresAt,
        status: 'draft',
        policy: value.policy,
        termsHash: value.termsHash,
        reason: value.reason,
        version: 1,
      })
    ).activate(notBefore);
    const result = await database.query<CreatedRow>(
      `insert into identity.invitation(id,kind,target,organization_id,membership_id,principal_id,
      recipient_hash,token_hash,token_key_version,issuer_membership_id,issuer_access_version,grant_digest,minimum_assurance,
      max_uses,use_count,not_before,expires_at,status,policy_id,terms_hash,reason,created_at,created_by,updated_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,clock_timestamp(),$10,
        clock_timestamp(),$22)
      returning id,kind,target,organization_id,membership_id,minimum_assurance,max_uses,use_count,not_before,expires_at,status,reason,created_at,version`,
      [
        value.id,
        value.kind,
        value.target,
        value.organization,
        value.membership,
        value.principal,
        value.recipientHash,
        value.token.hash,
        invitation.state.keyVersion,
        value.issuer,
        invitation.state.issuerAccessVersion,
        invitation.state.grantDigest,
        invitation.state.assurance,
        invitation.state.maxUses,
        invitation.state.useCount,
        invitation.state.notBefore,
        invitation.state.expiresAt,
        invitation.state.status,
        invitation.state.policy,
        invitation.state.termsHash,
        invitation.state.reason,
        invitation.state.version,
      ]
    );
    if (!result.rows[0]) throw new Error('INVITATION_CREATE_FAILED');
    return createdOf(result.rows[0]);
  }

  async read(database: OperationDatabase, filter: InvitationFilter): Promise<readonly InvitationListRecord[]> {
    const result = await database.query<ListRow>(
      `select id,kind,target,organization_id,membership_id,
      case when recipient_hash is null then null else '已绑定' end recipient,issuer_membership_id,issuer_access_version,
      minimum_assurance,max_uses,use_count,not_before,expires_at,status,reason,created_at,revoked_at,revoked_by,revoke_reason,version
      from identity.invitation invitation where $1=nullif(current_setting('app.scope_id',true),'')
      and access.scope_allowed(invitation.organization_id)
      and ($2::text is null or invitation.target=$2) and ($3::text is null or invitation.kind=$3)
      and ($4::text is null or invitation.status=$4)
      and ($5::text is null or (invitation.created_at,invitation.id)<(
        select cursor.created_at,cursor.id from identity.invitation cursor
        where cursor.id=$5 and access.scope_allowed(cursor.organization_id)))
      order by invitation.created_at desc,invitation.id desc limit $6`,
      [filter.scope, filter.target, filter.kind, filter.status, filter.cursor, filter.limit]
    );
    return Object.freeze(result.rows.map(listOf));
  }

  async revoke(database: OperationDatabase, id: string, actor: string, reason: string, version: number): Promise<InvitationRevokedRecord> {
    const current = await database.query<InvitationRow>(
      `select id,kind,target,organization_id,membership_id,principal_id,
      recipient_hash,token_key_version,issuer_membership_id,issuer_access_version,grant_digest,minimum_assurance,max_uses,
      use_count,not_before,expires_at,status,policy_id,terms_hash,reason,version from identity.invitation where id=$1 for update`,
      [id]
    );
    const row = current.rows[0];
    if (!row) throw new DomainError('INVITATION_NOT_FOUND');
    if (Number(row.version) !== version) throw new DomainError('VERSION_CONFLICT');
    const revoked = invitationState(row).revoke();
    const result = await database.query<RevokedRow>(
      `update identity.invitation set status=$2,revoked_at=clock_timestamp(),revoked_by=$3,
      revoke_reason=$4,version=$5,updated_at=clock_timestamp() where id=$1 and version=$6 returning id,kind,target,status,revoked_at,revoked_by,
      revoke_reason,version`,
      [id, revoked.state.status, actor, reason, revoked.state.version, version]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    await database.query(
      `with claims as(
      update identity.invitationclaim set state='revoked',updated_at=clock_timestamp(),version=version+1
      where invitation_id=$1 and state in('reserved','proofpending','proved') returning id::text
    ) update identity.preauth set state='revoked',version=version+1
      where reference_id in(select id from claims) and state='active'`,
      [id]
    );
    return revokedOf(result.rows[0]);
  }
}
