import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { OwnershipTransferView } from '../../application/port/OwnershipRepository';
import { OwnershipTransfer } from '../../domain/model/OwnershipTransfer';

export interface OwnershipTransferRow {
  readonly id: string;
  readonly scope_id: string;
  readonly role_id: string;
  readonly source_membership_id: string;
  readonly target_membership_id: string;
  readonly former_owner_mode: 'retain_admin' | 'remove_admin';
  readonly former_owner_role_id: string | null;
  readonly former_owner_role_version: number | null;
  readonly ownership_version: number;
  readonly target_access_version: number;
  readonly source_proof_hash: string | null;
  readonly target_proof_hash: string | null;
  readonly cancel_proof_hash: string | null;
  readonly state: 'draft' | 'pending' | 'accepted' | 'cancelled' | 'expired';
  readonly version: number;
  readonly cooling_until: Date;
  readonly expires_at: Date;
}

export function ownershipTransferModel(row: OwnershipTransferRow): OwnershipTransfer {
  return new OwnershipTransfer({
    id: row.id,
    scope: row.scope_id,
    role: row.role_id,
    sourceMembership: row.source_membership_id,
    targetMembership: row.target_membership_id,
    formerOwnerMode: row.former_owner_mode,
    formerOwnerRole: row.former_owner_role_id,
    formerOwnerRoleVersion: row.former_owner_role_version === null ? null : Number(row.former_owner_role_version),
    ownershipVersion: Number(row.ownership_version),
    targetAccessVersion: Number(row.target_access_version),
    sourceProof: row.source_proof_hash,
    targetProof: row.target_proof_hash,
    cancelProof: row.cancel_proof_hash,
    state: row.state,
    version: Number(row.version),
    coolingUntil: row.cooling_until,
    expiresAt: row.expires_at,
  });
}

export async function ownershipTransferView(database: SqlExecutor, scope: string, transfer: string): Promise<OwnershipTransferView | null> {
  const result = await database.query<OwnershipTransferView>(
    `select candidate.id,candidate.state,candidate.source_membership_id "sourceMembership",
    candidate.target_membership_id "targetMembership",target.member_id "targetMember",target.principal_id "targetPrincipal",
    coalesce(profile.display_name,target.id) "targetDisplayName",candidate.former_owner_mode "formerOwnerMode",
    candidate.former_owner_role_id "formerOwnerRole",candidate.former_owner_role_version "formerOwnerRoleVersion",
    candidate.cooling_until "coolingUntil",
    candidate.expires_at "expiresAt",candidate.version
    from access.ownershiptransfer candidate join access.membership target on target.id=candidate.target_membership_id
    left join access.memberprofile profile on profile.member_id=target.member_id
    where candidate.id=$1 and candidate.scope_id=$2`,
    [transfer, scope]
  );
  const row = result.rows[0];
  return row ? Object.freeze({ ...row, version: Number(row.version), coolingUntil: new Date(row.coolingUntil).toISOString(), expiresAt: new Date(row.expiresAt).toISOString() }) : null;
}

export async function recordOwnershipTimeline(database: SqlExecutor, transfer: string, scope: string, previous: string | null, state: string, actor: string, reason: string, version: number): Promise<void> {
  await database.query(
    `insert into access.ownershiptimeline(id,tenant_id,scope_id,transfer_id,previous_state,state,actor_membership_id,reason,version,occurred_at)
    values($1,current_setting('app.tenant_id'),$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
    [`ownershiptimeline:${randomUUID()}`, scope, transfer, previous, state, actor, reason, version]
  );
}
