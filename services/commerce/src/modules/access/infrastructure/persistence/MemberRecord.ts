import type { ActiveMembershipReference, MemberRecord } from '../../application/port/AccessRepository';
import type { OperationTarget } from '@shop/contract';
import { membershipTarget } from './MembershipTarget';

export interface MemberRow {
  readonly id: string;
  readonly member_id: string;
  readonly organization_id: string;
  readonly employee_no: string | null;
  readonly status: string;
  readonly access_version: number;
  readonly joined_at: Date | null;
  readonly registration_reset_allowed: boolean;
  readonly registration_reset_block_reason: 'self' | 'protected' | 'inactive' | null;
}
export interface IdentityMembershipRow {
  readonly id: string;
  readonly principal_id: string;
  readonly client: string;
  readonly organization_id: string;
  readonly access_version: number;
  readonly display_name: string;
  readonly organization_name: string;
  readonly scope_kind: string;
  readonly role_label: string | null;
}

export function identityMembership(row: IdentityMembershipRow, requested?: OperationTarget): ActiveMembershipReference {
  return Object.freeze({
    id: row.id,
    client: requested ?? membershipTarget(row.client),
    organization: row.organization_id,
    accessVersion: Number(row.access_version),
    displayName: row.display_name,
    organizationName: row.organization_name,
    scopeKind: row.scope_kind,
    scopeId: row.organization_id,
    roleLabel: row.role_label ?? '已授权成员',
    logoUrl: null,
  });
}

export function memberRecord(row: MemberRow): MemberRecord {
  return Object.freeze({
    id: row.id,
    member: row.member_id,
    organization: row.organization_id,
    employee: row.employee_no,
    status: row.status,
    accessVersion: Number(row.access_version),
    joinedAt: row.joined_at,
    registrationResetAllowed: row.registration_reset_allowed,
    registrationResetBlockReason: row.registration_reset_block_reason,
  });
}
