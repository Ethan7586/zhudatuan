import type { InvitationCreatedRecord, InvitationReadRecord, InvitationRevokedRecord } from '../../application/port/InvitationRepository';
import { Invitation, type InvitationState } from '../../domain/model/Invitation';
import { InvitationClaim } from '../../domain/model/InvitationClaim';

export interface InvitationRow {
  readonly id: string;
  readonly kind: InvitationState['kind'];
  readonly target: InvitationState['target'];
  readonly organization_id: string;
  readonly membership_id: string | null;
  readonly principal_id: string | null;
  readonly recipient_hash: Buffer | null;
  readonly token_key_version: string;
  readonly issuer_membership_id: string;
  readonly issuer_access_version: number;
  readonly grant_digest: string;
  readonly minimum_assurance: 1 | 2 | 3;
  readonly max_uses: number;
  readonly use_count: number;
  readonly not_before: Date;
  readonly expires_at: Date;
  readonly status: InvitationState['status'];
  readonly policy_id: string | null;
  readonly terms_hash: string | null;
  readonly reason: string;
  readonly version: number;
}
export interface CreatedRow {
  readonly id: string;
  readonly kind: InvitationState['kind'];
  readonly target: InvitationState['target'];
  readonly organization_id: string;
  readonly membership_id: string | null;
  readonly minimum_assurance: 1 | 2 | 3;
  readonly max_uses: number;
  readonly use_count: number;
  readonly not_before: Date;
  readonly expires_at: Date;
  readonly status: InvitationState['status'];
  readonly reason: string;
  readonly created_at: Date;
  readonly version: number;
}
export interface ListRow extends CreatedRow {
  readonly issuer_membership_id: string;
  readonly issuer_access_version: number;
  readonly revoked_at: Date | null;
  readonly revoked_by: string | null;
  readonly revoke_reason: string | null;
}
export interface RevokedRow {
  readonly id: string;
  readonly kind: InvitationState['kind'];
  readonly target: InvitationState['target'];
  readonly status: 'revoked';
  readonly revoked_at: Date;
  readonly revoked_by: string;
  readonly revoke_reason: string;
  readonly version: number;
}

export function claimOf(
  row: Readonly<{
    id: string;
    invitation_id: string;
    kind: InvitationState['kind'];
    target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
    recipient_hash: Buffer | null;
    state: InvitationClaim['state'];
    proof_method: InvitationClaim['proof'];
    expires_at: Date;
    proved_at: Date | null;
    version: number;
  }>
): InvitationClaim {
  return new InvitationClaim({
    id: row.id,
    invitation: row.invitation_id,
    kind: row.kind,
    target: row.target,
    recipientHash: row.recipient_hash,
    state: row.state,
    proof: row.proof_method,
    expiresAt: row.expires_at,
    provedAt: row.proved_at,
    version: Number(row.version),
  });
}

export function invitationState(row: InvitationRow): Invitation {
  return new Invitation(
    Object.freeze({
      id: row.id,
      kind: row.kind,
      target: row.target,
      organization: row.organization_id,
      membership: row.membership_id,
      principal: row.principal_id,
      recipientHash: row.recipient_hash,
      keyVersion: row.token_key_version,
      issuer: row.issuer_membership_id,
      issuerAccessVersion: Number(row.issuer_access_version),
      grantDigest: row.grant_digest,
      assurance: Number(row.minimum_assurance) as 1 | 2 | 3,
      maxUses: Number(row.max_uses),
      useCount: Number(row.use_count),
      notBefore: row.not_before,
      expiresAt: row.expires_at,
      status: row.status,
      policy: row.policy_id,
      termsHash: row.terms_hash,
      reason: row.reason,
      version: Number(row.version),
    })
  );
}
export function invitationOf(row: InvitationRow, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', now: Date): Invitation {
  const invitation = invitationState(row);
  invitation.assertResolvable(now, target);
  return invitation;
}

export function createdOf(row: CreatedRow): InvitationCreatedRecord {
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    target: row.target,
    organization_id: row.organization_id,
    membership_id: row.membership_id,
    minimum_assurance: Number(row.minimum_assurance) as 1 | 2 | 3,
    max_uses: Number(row.max_uses),
    use_count: Number(row.use_count),
    not_before: row.not_before.toISOString(),
    expires_at: row.expires_at.toISOString(),
    status: row.status,
    reason: row.reason,
    created_at: row.created_at.toISOString(),
    version: Number(row.version),
  });
}
export function listOf(row: ListRow): InvitationReadRecord {
  return Object.freeze({
    ...createdOf(row),
    issuer_membership_id: row.issuer_membership_id,
    issuer_access_version: Number(row.issuer_access_version),
    revoked_at: row.revoked_at?.toISOString() ?? null,
    revoked_by: row.revoked_by,
    revoke_reason: row.revoke_reason,
  });
}
export function revokedOf(row: RevokedRow): InvitationRevokedRecord {
  return Object.freeze({ id: row.id, kind: row.kind, target: row.target, status: row.status, revoked_at: row.revoked_at.toISOString(), revoked_by: row.revoked_by, revoke_reason: row.revoke_reason, version: Number(row.version) });
}
