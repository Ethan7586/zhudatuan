import { createFetchAccessRolesManage } from '@shop/sdk/access';
import type { ConsoleScope } from '../../entity/session/ConsoleSession';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AccessRoleAssignmentReceiptSchema, AccessRoleDeleteReceiptSchema, AccessRoleWriteReceiptSchema,
  type AccessMembership, type AccessRole } from './AccessSchema';

const rolesManage = createFetchAccessRolesManage(appConfig.apiBaseUrl);

export interface AccessRoleDraft {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly string[];
  readonly version?: number;
}

export interface AccessRoleAssignmentDraft {
  readonly action: 'assign' | 'revoke';
  readonly role: string;
  readonly membership: string;
  readonly scope: ConsoleScope;
  readonly scopeSource: 'direct' | 'inherited';
  readonly accessVersion: number;
}

export function roleCommandAvailable(context: ConsoleContext): boolean {
  return context.session.csrf !== undefined
    && context.session.permissions.includes('access.role.manage')
    && context.session.capabilities.includes('access.roles.manage');
}

export async function saveAccessRole(context: ConsoleContext, draft: AccessRoleDraft, signal?: AbortSignal) {
  if (!roleCommandAvailable(context)) throw new Error('ACCESS_ROLE_COMMAND_NOT_AVAILABLE');
  const response = await rolesManage(
    { path: { roleid: draft.id }, body: { name: draft.name, permissions: [...draft.permissions] } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      ...(draft.version === undefined ? {} : { expectedVersion: draft.version }),
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return AccessRoleWriteReceiptSchema.parse(response);
}

export async function saveAccessRoleAssignment(context: ConsoleContext, draft: AccessRoleAssignmentDraft, signal?: AbortSignal) {
  if (!roleCommandAvailable(context)) throw new Error('ACCESS_ROLE_COMMAND_NOT_AVAILABLE');
  const response = await rolesManage(
    { path: { roleid: draft.role }, body: { action: draft.action, membership: draft.membership,
      kind: draft.scope.kind, scope: draft.scope.id, scopeSource: draft.scopeSource } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      expectedVersion: draft.accessVersion,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return AccessRoleAssignmentReceiptSchema.parse(response);
}

export async function offboardAdministrator(context: ConsoleContext, membership: string, accessVersion: number,
  signal?: AbortSignal): Promise<Readonly<{ action: 'offboard'; changed: true; membership: string; status: 'offboarded'; access_version: number }>> {
  if (!roleCommandAvailable(context)) throw new Error('ACCESS_ROLE_COMMAND_NOT_AVAILABLE');
  const response = await rolesManage(
    { path: { roleid: 'role:self' }, body: { action: 'offboard', membership } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      expectedVersion: accessVersion,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  if (response === undefined || response.action !== 'offboard' || response.changed !== true
    || response.membership !== membership || response.status !== 'offboarded'
    || typeof response.access_version !== 'number' || response.access_version <= accessVersion) {
    throw new Error('ADMINISTRATOR_OFFBOARD_VERIFICATION_FAILED');
  }
  return response as Readonly<{ action: 'offboard'; changed: true; membership: string; status: 'offboarded'; access_version: number }>;
}

export async function deleteAccessRole(context: ConsoleContext, role: Pick<AccessRole, 'id' | 'version'>, signal?: AbortSignal) {
  if (!roleCommandAvailable(context)) throw new Error('ACCESS_ROLE_COMMAND_NOT_AVAILABLE');
  const response = await rolesManage(
    { path: { roleid: role.id }, body: { action: 'delete' } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      expectedVersion: role.version,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return AccessRoleDeleteReceiptSchema.parse(response);
}

export function verifyAccessRoleSave(draft: AccessRoleDraft, receipt: Readonly<{
  version: number;
  affected_memberships: readonly Readonly<{ membership: string; access_version: number }>[];
}>, roles: readonly AccessRole[], beforeMembers: readonly AccessMembership[], members: readonly AccessMembership[]): AccessRole {
  const saved = roles.find(({ id }) => id === draft.id);
  const requestedPermissions = [...new Set(draft.permissions)].sort();
  const savedPermissions = saved === undefined ? [] : [...new Set(saved.permissions)].sort();
  const affected = new Map(receipt.affected_memberships.map((item) => [item.membership, item.access_version]));
  const assignedBefore = beforeMembers.filter((member) => member.roles.some((assignment) => assignment.role === draft.id));
  const membersVerified = assignedBefore.every((before) => {
    const member = members.find(({ id }) => id === before.id);
    const accessVersion = affected.get(before.id);
    return member !== undefined && accessVersion !== undefined && accessVersion > before.access_version
      && member.access_version === accessVersion && assignmentsMatch(before, member)
      && scopesMatch(before, member) && effectivePermissionsMatch(member, roles);
  });
  if (saved === undefined
    || saved.name !== draft.name
    || saved.version !== receipt.version
    || requestedPermissions.length !== savedPermissions.length
    || requestedPermissions.some((permission, index) => permission !== savedPermissions[index])
    || !membersVerified) {
    throw new Error('ACCESS_ROLE_SAVE_VERIFICATION_FAILED');
  }
  return saved;
}

export function verifyAccessRoleAssignment(draft: AccessRoleAssignmentDraft, receipt: Readonly<{
  changed: boolean; access_version: number; scope_source: 'direct' | 'inherited';
}>, before: AccessMembership, roles: readonly AccessRole[], members: readonly AccessMembership[]): AccessMembership {
  const member = members.find(({ id }) => id === draft.membership);
  const role = roles.find(({ id }) => id === draft.role);
  const assignment = member?.roles.find((candidate) => candidate.role === draft.role && candidate.scope.id === draft.scope.id);
  const roleMember = role?.members.find((candidate) => candidate.membership === draft.membership && candidate.scope.id === draft.scope.id);
  const assignmentMatches = draft.action === 'assign'
    ? assignment?.scope_source === draft.scopeSource && roleMember?.scope_source === draft.scopeSource
    : assignment === undefined && roleMember === undefined;
  const preserved = assignmentKeys(before.roles)
    .filter((key) => key !== assignmentKey(draft.role, draft.scope.id))
    .every((key) => member?.roles.some((candidate) => assignmentKey(candidate.role, candidate.scope.id) === key));
  if (!receipt.changed || member === undefined || role === undefined || receipt.access_version <= before.access_version
    || member.access_version !== receipt.access_version || receipt.scope_source !== draft.scopeSource
    || !assignmentMatches || !preserved || !effectivePermissionsMatch(member, roles)) {
    throw new Error('ACCESS_ROLE_ASSIGNMENT_VERIFICATION_FAILED');
  }
  return member;
}

export function verifyAccessRoleDelete(role: AccessRole, receipt: Readonly<{
  deleted: true; affected_memberships: readonly Readonly<{ membership: string; access_version: number }>[];
}>, roles: readonly AccessRole[], members: readonly AccessMembership[]): void {
  if (roles.some(({ id }) => id === role.id)) throw new Error('ACCESS_ROLE_DELETE_VERIFICATION_FAILED');
  const beforeMembers = new Set(role.members.map(({ membership }) => membership));
  const affected = new Map(receipt.affected_memberships.map((item) => [item.membership, item.access_version]));
  if ([...beforeMembers].some((membership) => {
    const member = members.find(({ id }) => id === membership);
    const accessVersion = affected.get(membership);
    return member === undefined || accessVersion === undefined || member.access_version !== accessVersion
      || member.roles.some((assignment) => assignment.role === role.id) || !effectivePermissionsMatch(member, roles);
  })) throw new Error('ACCESS_ROLE_DELETE_VERIFICATION_FAILED');
}

function effectivePermissionsMatch(member: AccessMembership, roles: readonly AccessRole[]): boolean {
  const rolePermissions = new Map(roles.map((role) => [role.id, role.permissions] as const));
  const denied = new Set(member.denies);
  const effective = new Set(member.effective_permissions);
  if ([...denied].some((permission) => effective.has(permission))) return false;
  const expected = new Set(member.roles.flatMap((assignment) => rolePermissions.get(assignment.role) ?? [])
    .filter((permission) => !denied.has(permission)));
  return expected.size === effective.size && [...expected].every((permission) => effective.has(permission));
}

function assignmentsMatch(before: AccessMembership, member: AccessMembership): boolean {
  const expected = assignmentKeys(before.roles).sort();
  const actual = assignmentKeys(member.roles).sort();
  return expected.length === actual.length && expected.every((key, index) => key === actual[index]);
}

function scopesMatch(before: AccessMembership, member: AccessMembership): boolean {
  const key = (scope: AccessMembership['scopes'][number]) => `${scope.id}\u0000${scope.kind}\u0000${scope.scope}\u0000${scope.effect}\u0000${scope.expires ?? ''}`;
  const expected = before.scopes.map(key).sort();
  const actual = member.scopes.map(key).sort();
  return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
}

function assignmentKeys(assignments: AccessMembership['roles']): string[] {
  return assignments.map((assignment) => assignmentKey(assignment.role, assignment.scope.id));
}

function assignmentKey(role: string, scope: string): string {
  return `${role}\u0000${scope}`;
}
