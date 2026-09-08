import type { DelegationRole, DelegationScope, OverrideChange, VersionChange } from '../../application/port/AccessRepository';
import { Membership } from '../../domain/model/Membership';
import { Role, type PermissionEffect, type RoleKind, type RoleTemplateCode } from '../../domain/model/Role';
import { Scope } from '../../domain/model/Scope';

export interface CenterRow {
  readonly id: string;
  readonly display_name: string | null;
  readonly employee_no: string | null;
  readonly mobile_masked: string | null;
  readonly client: string;
  readonly status: string;
  readonly access_version: number;
  readonly roles: readonly Readonly<{
    role: string;
    name: string;
    description: string;
    status: 'active' | 'disabled';
    kind: RoleKind;
    template: RoleTemplateCode | null;
    version: number;
    allows: readonly string[];
    denies: readonly string[];
  }>[];
  readonly scopes: readonly Readonly<{ id: string; kind: string; scope: string; effect: PermissionEffect; expires: string | null }>[];
  readonly overrides: readonly Readonly<{ permission: string; effect: PermissionEffect; expires: string | null }>[];
}
export interface RoleRow {
  readonly id: string;
  readonly scope_id: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly version: number;
  readonly kind: RoleKind;
  readonly template_code: RoleTemplateCode | null;
}
export interface RoleChangeRow extends RoleRow {
  readonly allow_count: number;
  readonly deny_count: number;
}
export interface ScopeRow {
  readonly id: string;
  readonly membership_id: string;
  readonly scope_kind: string;
  readonly scope_id: string;
  readonly scope_path: string;
  readonly effect: PermissionEffect;
  readonly expires_at: Date | null;
}
export interface MembershipRow {
  readonly id: string;
  readonly organization_id: string;
  readonly client: string;
  readonly status: string;
  readonly access_version: number;
}
export interface OverrideTargetRow extends MembershipRow {
  readonly owner: boolean;
}
export interface OverrideRow {
  readonly effect: PermissionEffect;
  readonly expires_at: Date | null;
}
export interface OwnershipRow {
  readonly scope_id: string;
  readonly role_id: string;
  readonly membership_id: string;
  readonly version: number;
  readonly role_kind: string;
}
export interface VersionRow {
  readonly membership_id: string;
  readonly organization_id: string;
  readonly access_version: number;
}
export interface IssuerRow {
  readonly organization_id: string;
  readonly access_version: number;
}
export interface TargetRow {
  readonly id: string;
  readonly organization_id: string;
  readonly principal_id: string | null;
  readonly status: string;
  readonly client: string;
}
export interface DelegationRoleRow {
  readonly id: string;
  readonly version: number;
  readonly kind: RoleKind;
  readonly expires_at: Date | null;
}
export interface DelegationPermissionRow {
  readonly role_id: string;
  readonly role_version: number;
  readonly code: string;
  readonly effect: PermissionEffect;
}
export interface DelegationScopeRow {
  readonly id: string;
  readonly scope_kind: string;
  readonly scope_id: string;
  readonly scope_path: string;
  readonly effect: PermissionEffect;
  readonly access_version: number;
  readonly effective_at: Date;
  readonly expires_at: Date | null;
}
export function roleModel(row: RoleRow): Role {
  return new Role({ id: row.id, scope: row.scope_id, name: row.name, description: row.description, status: row.status, version: Number(row.version), kind: row.kind, template: row.template_code });
}
export function membershipModel(row: MembershipRow): Membership {
  return new Membership({ id: row.id, organization: row.organization_id, client: row.client, status: row.status, accessVersion: Number(row.access_version) });
}
export function scopeModel(row: ScopeRow): Scope {
  return new Scope({ id: row.id, membership: row.membership_id, kind: row.scope_kind, resource: row.scope_id, path: row.scope_path, effect: row.effect, expiresAt: row.expires_at });
}
export function overrideChange(row: OverrideRow | undefined): OverrideChange | null {
  return row ? Object.freeze({ effect: row.effect, expiresAt: row.expires_at }) : null;
}
export function versionChange(row: VersionRow | undefined): VersionChange | null {
  return row ? Object.freeze({ membership: row.membership_id, organization: row.organization_id, version: Number(row.access_version) }) : null;
}
export function delegationRole(row: DelegationRoleRow): DelegationRole {
  return Object.freeze({ id: row.id, version: Number(row.version), kind: row.kind, expiresAt: row.expires_at });
}
export function delegationScope(row: DelegationScopeRow): DelegationScope {
  return Object.freeze({ id: row.id, kind: row.scope_kind, scope: row.scope_id, path: row.scope_path, effect: row.effect, accessVersion: Number(row.access_version), effectiveAt: row.effective_at, expiresAt: row.expires_at });
}
