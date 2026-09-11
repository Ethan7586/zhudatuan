import type { NodeProfile, SignedLevel } from './SflNodeKernel';

export const ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION = 'sfl.admin-segment-scope.v1' as const;
export const ADMIN_MEMBER_SEGMENTS = Object.freeze([
  'first_segment',
  'second_segment',
  'both_segments',
] as const);

export type AdminMemberSegment = (typeof ADMIN_MEMBER_SEGMENTS)[number];
export type AdministratorRoleKind = 'owner' | 'senior_administrator' | 'administrator';

export interface AdminSegmentScope {
  readonly schema_version: typeof ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION;
  readonly scope_id: string;
  readonly scope_version: number;
  readonly realm_id: string;
  readonly line_id: string;
  readonly root_node_id: string;
  readonly segment: AdminMemberSegment;
  readonly access_version: number;
  readonly effective_at: string;
}

export interface AdministratorContext {
  readonly administrator_identity_id: string;
  readonly administrator_identity_version: number;
  readonly active_membership_id: string;
  readonly account_id: string;
  readonly principal_id: string;
  readonly realm_id: string;
  readonly host_node_id: string;
  readonly role_kind: AdministratorRoleKind;
  readonly role_ids: readonly string[];
  readonly permissions: readonly string[];
  readonly scope: AdminSegmentScope;
}

export interface AdministratorScopeChangeRequest {
  readonly action: 'grant' | 'replace' | 'revoke';
  readonly role_id: string;
  readonly segment: AdminMemberSegment;
  readonly root_node_id: string;
}

export interface AdministratorScopeChangeResult {
  readonly business_number: string;
  readonly administrator_identity_id: string;
  readonly administrator_membership_id: string;
  readonly role_id: string;
  readonly action: AdministratorScopeChangeRequest['action'];
  readonly scope: AdminSegmentScope | null;
  readonly access_version: number;
  readonly replayed: boolean;
}

export interface AdminManagedMember {
  readonly node_id: string;
  readonly realm_id: string;
  readonly line_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly node_profile: NodeProfile;
  readonly mall_id: string | null;
  readonly relation_version: number;
  readonly administrator_identity_id: string;
  readonly administrator_scope_version: number;
}

export function parseAdminMemberSegment(value: unknown): AdminMemberSegment {
  if (typeof value !== 'string' || !(ADMIN_MEMBER_SEGMENTS as readonly string[]).includes(value)) {
    throw new Error('SFL_ADMIN_SEGMENT_INVALID');
  }
  return value as AdminMemberSegment;
}

export function parseAdministratorScopeChangeRequest(value: unknown): AdministratorScopeChangeRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SFL_ADMIN_SCOPE_CHANGE_INVALID');
  }
  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'action,role_id,root_node_id,segment') throw new Error('SFL_ADMIN_SCOPE_CHANGE_INVALID');
  if (record.action !== 'grant' && record.action !== 'replace' && record.action !== 'revoke') {
    throw new Error('SFL_ADMIN_SCOPE_ACTION_INVALID');
  }
  if (typeof record.role_id !== 'string' || record.role_id.trim() !== record.role_id || record.role_id === ''
    || typeof record.root_node_id !== 'string' || record.root_node_id.trim() !== record.root_node_id
    || record.root_node_id === '') throw new Error('SFL_ADMIN_SCOPE_CHANGE_INVALID');
  return Object.freeze({
    action: record.action,
    role_id: record.role_id,
    segment: parseAdminMemberSegment(record.segment),
    root_node_id: record.root_node_id,
  });
}
