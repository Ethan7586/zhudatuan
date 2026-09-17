import { randomUUID } from 'node:crypto';
import { checkScope, type Scope } from '@shop/authz';
import { requireAccess, rowResult, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { canonicalScope, numericVersion, requireExpectedVersion } from './AccessOperationValues';
import { promoteAdministrator } from './OperatorLifecycleOperations';

export interface ManagementTargetRow {
  readonly target_membership_id: string | null;
  readonly target_client: string | null;
  readonly target_status: string | null;
  readonly target_realm_id: string | null;
  readonly actor_realm_id: string | null;
  readonly target_membership_scope: unknown;
  readonly target_realm_binding: boolean;
  readonly target_organization_binding: boolean;
}

export async function grantOperatorScope(request: OperationRequest, database: OperationDatabase) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const membership = request.input.path.membershipid!;
  const kind = textField(body, 'kind');
  const scope = textField(body, 'scope');
  if (body.effect === 'deny') throw new Error('SCOPE_DENY_UNSUPPORTED');
  if (body.effect !== undefined && body.effect !== 'allow') throw new Error('VALIDATION_FAILED:effect');
  const effect = 'allow';
  const resolved = await database.query<ManagementTargetRow & { scope: unknown }>(`select access.scope_object($1) scope,
    access.scope_object(target.organization_id) target_membership_scope,target.id target_membership_id,
    target.client target_client,target.status target_status,target.realm_id target_realm_id,
    actor.realm_id actor_realm_id,
    exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
      and realm_target.surface='admin' and realm_target.membership_client='operator') target_realm_binding,
    exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
      and realm_target.surface='admin' and realm_target.membership_client='operator'
      and realm_target.membership_organization_id=target.organization_id) target_organization_binding
    from access.membership target
    join access.membership actor on actor.id=$3 and actor.status='active' and actor.client='operator'
    where target.id=$2 for update of target`, [scope, membership, access.membership.id]);
  const target = resolved.rows[0];
  if (target === undefined) throw new Error('MANAGEMENT_PERMISSION_TARGET_NOT_ACTIVE_OPERATOR');
  const targetScope = canonicalScope(target.scope);
  const targetMembershipScope = canonicalScope(target.target_membership_scope);
  requireManagementTarget(target, targetScope);
  const scopeDecision = targetScope === null ? null
    : checkScope(access.membership, 'access.scope.manage', targetScope, new Date());
  if (targetScope === null || targetMembershipScope === null || kind !== targetScope.kind
    || access.scope.kind !== targetScope.kind || access.scope.id !== targetScope.id
    || scopeDecision === null || 'reason' in scopeDecision
    || !scopesAreRelated(targetScope, targetMembershipScope)) throw new Error('CANNOT_GRANT_UNOWNED_SCOPE');
  const result = await database.query(`with changed as (
      insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,expires_at,access_version)
      values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,(select access_version+1 from access.membership where id=$2))
      on conflict(membership_id,scope_kind,scope_id,effect,effective_at) do nothing returning *
    ), raised as (update access.membership set access_version=access_version+1 where id=$2 returning access_version)
    select changed.*,raised.access_version from changed cross join raised`, [`scope:${randomUUID()}`, membership, targetScope.kind,
    targetScope.id, canonicalScopePath(targetScope), effect, body.expiresAt ?? null]);
  return rowResult(result, 200);
}

export async function manageRoleAssignment(request: OperationRequest, database: OperationDatabase,
  access: ReturnType<typeof requireAccess>, role: string, action: 'assign' | 'revoke'):
  Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
  const seniorRoleRequested = role.startsWith('role-senior-administrator-v1:');
  if (seniorRoleRequested && access.governance?.governanceLevel !== 'owner') throw new Error('OWNER_REQUIRED_FOR_SENIOR_ADMINISTRATOR');
  const body = bodyRecord(request);
  const membership = textField(body, 'membership');
  const kind = textField(body, 'kind');
  const scope = textField(body, 'scope');
  const source = textField(body, 'scopeSource');
  if (source !== 'direct' && source !== 'inherited') throw new Error('VALIDATION_FAILED:scopeSource');
  const expectedVersion = requireExpectedVersion(request);
  const resolved = await database.query<ManagementTargetRow & {
    scope: unknown;
    target_access_version: string | number;
    role_id: string;
    senior_role: boolean;
    target_is_owner: boolean;
    management_role: boolean;
  }>(`select access.scope_object($1) scope,access.scope_object(target.organization_id) target_membership_scope,
    target.access_version target_access_version,role.id role_id,
    role.id='role-senior-administrator-v1:'||role.scope_id senior_role,
    exists(select 1 from access.platformowner owner where owner.singleton=true and owner.state='active'
      and owner.membership_id=target.id) target_is_owner,target.id target_membership_id,
    target.client target_client,target.status target_status,target.realm_id target_realm_id,
    actor.realm_id actor_realm_id,
    exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
      and realm_target.surface='admin' and realm_target.membership_client='operator') target_realm_binding,
    exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
      and realm_target.surface='admin' and realm_target.membership_client='operator'
      and realm_target.membership_organization_id=target.organization_id) target_organization_binding,
    exists(select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      join capability.operation operation on operation.permission_code=permission.code and operation.audience='operator'
      where mapping.role_id=role.id and mapping.effect='allow'
        and not exists(select 1 from capability.operation other where other.permission_code=permission.code
          and other.audience<>'operator')) management_role
    from access.membership target
    join access.membership actor on actor.id=$5 and actor.status='active' and actor.client='operator'
    join access.role role on role.id=$3 and role.status='active'
      and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
      and (role.scope_id=$4 or ($6::boolean and role.id='role-senior-administrator-v1:'||role.scope_id
        and exists(select 1 from organization.unitclosure roleboundary
          where roleboundary.ancestor_id=role.scope_id and roleboundary.descendant_id=$4)))
    where target.id=$2 for update of target`, [scope, membership, role, access.scope.id, access.membership.id,
      access.governance?.governanceLevel === 'owner']);
  const target = resolved.rows[0];
  if (target === undefined) throw new Error('ROLE_ASSIGNMENT_NOT_AVAILABLE');
  if (target.target_is_owner) throw new Error('OWNER_ROLE_LEVEL_IMMUTABLE');
  const targetScope = canonicalScope(target.scope);
  const targetMembershipScope = canonicalScope(target.target_membership_scope);
  if (target.management_role) requireManagementTarget(target, targetScope);
  else if (target.target_status !== 'active') throw new Error('ROLE_ASSIGNMENT_NOT_AVAILABLE');
  const scopeDecision = targetScope === null ? null : checkScope(access.membership, 'access.scope.manage', targetScope, new Date());
  if (targetScope === null || targetMembershipScope === null || kind !== targetScope.kind
    || (!scopeContains(access.scope, targetScope) && !target.senior_role)
    || scopeDecision === null || 'reason' in scopeDecision
    || !scopesAreRelated(targetScope, targetMembershipScope)) throw new Error('CANNOT_GRANT_UNOWNED_SCOPE');
  const currentVersion = numericVersion(target.target_access_version);
  if (currentVersion !== expectedVersion) throw new Error('VERSION_CONFLICT');

  if (action === 'assign' && target.senior_role && target.target_realm_id === 'realm:l1') {
    return promoteAdministrator(database, access, membership, role, targetScope, source, currentVersion);
  }

  if (action === 'revoke') {
    const removed = await database.query<{ scope_source: string | null }>(`update access.membershiprole assignment
      set expires_at=clock_timestamp() from access.role role
      where assignment.membership_id=$1 and assignment.role_id=$2 and role.id=assignment.role_id
        and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
        and (assignment.assigned_scope_id=$3 or (assignment.assigned_scope_id is null and role.scope_id=$3))
      returning assignment.scope_source`, [membership, role, targetScope.id]);
    const removedScope = target.senior_role && removed.rows.length > 0 ? await database.query(`update access.scopegrant scopegrant
      set expires_at=clock_timestamp() where scopegrant.membership_id=$1 and scopegrant.scope_kind=$2
        and scopegrant.scope_id=$3 and scopegrant.effect='allow' and scopegrant.effective_at<=clock_timestamp()
        and (scopegrant.expires_at is null or scopegrant.expires_at>clock_timestamp())
        and not exists(select 1 from access.membershiprole assignment join access.role assigned_role on assigned_role.id=assignment.role_id
          where assignment.membership_id=$1 and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            and coalesce(assignment.assigned_scope_id,assigned_role.scope_id)=$3)
      returning scopegrant.id`, [membership, targetScope.kind, targetScope.id]) : { rows: [] };
    const changed = removed.rows.length > 0 || removedScope.rows.length > 0;
    if (changed && target.senior_role) await updateOperatorGovernanceName(database, membership, 'administrator');
    const accessVersion = changed ? await raiseMembershipVersion(database, membership, currentVersion) : currentVersion;
    return { status: 200, body: Object.freeze({ action, changed, role, membership,
      scope: targetScope, scope_source: removed.rows[0]?.scope_source ?? source, access_version: accessVersion }) };
  }

  let scopeAdded = false;
  if (source === 'inherited') {
    const inherited = await database.query(`select id from access.scopegrant where membership_id=$1 and scope_kind=$2 and scope_id=$3
      and effect='allow' and access_version>0 and access_version<=$4 and effective_at<=clock_timestamp()
      and (expires_at is null or expires_at>clock_timestamp()) limit 1`, [membership, targetScope.kind, targetScope.id, currentVersion]);
    if (inherited.rows[0] === undefined) throw new Error('INHERITED_SCOPE_NOT_FOUND');
  } else {
    const inserted = await database.query(`insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,expires_at,access_version)
      select $1,$2,$3,$4,$5,'allow',clock_timestamp(),null,$6
      where not exists(select 1 from access.scopegrant existing where existing.membership_id=$2
        and existing.scope_kind=$3 and existing.scope_id=$4 and existing.effect='allow'
        and existing.effective_at<=clock_timestamp() and (existing.expires_at is null or existing.expires_at>clock_timestamp()))
      returning id`, [`scope:${randomUUID()}`, membership, targetScope.kind, targetScope.id,
      canonicalScopePath(targetScope), currentVersion + 1]);
    scopeAdded = inserted.rows.length > 0;
  }
  const assigned = await database.query(`insert into access.membershiprole(
    membership_id,role_id,effective_at,expires_at,delegated_by,assigned_scope_kind,assigned_scope_id,assigned_scope_path,scope_source)
    select $1,$2,clock_timestamp(),null,$3,$4,$5,$6,$7
    where not exists(select 1 from access.membershiprole existing where existing.membership_id=$1 and existing.role_id=$2
      and coalesce(existing.assigned_scope_id,$5)=$5 and existing.effective_at<=clock_timestamp()
      and (existing.expires_at is null or existing.expires_at>clock_timestamp()))
    returning role_id`, [membership, role, access.membership.id, targetScope.kind, targetScope.id,
    canonicalScopePath(targetScope), source]);
  const changed = scopeAdded || assigned.rows.length > 0;
  if (changed && target.senior_role) await updateOperatorGovernanceName(database, membership, 'senior_administrator');
  const accessVersion = changed ? await raiseMembershipVersion(database, membership, currentVersion) : currentVersion;
  return { status: 200, body: Object.freeze({ action, changed, role, membership, scope: targetScope,
    scope_source: source, access_version: accessVersion }) };
}

async function updateOperatorGovernanceName(database: OperationDatabase, membership: string,
  level: 'administrator' | 'senior_administrator'): Promise<void> {
  const label = level === 'senior_administrator' ? '高级管理员' : '管理员';
  await database.query(`update access.membership membership set operator_display_name=case
      when coalesce(membership.operator_display_name,profile.display_name) ~ '^(高级管理员|管理员) · .+$'
        or profile.display_name ~ '^L([0-9]|10|11)消费者[0-9]{4}$'
        then $2||' · '||coalesce(nullif(right(profile.mobile_masked,4),''),right(profile.display_name,4))
      else coalesce(membership.operator_display_name,profile.display_name) end
    from member.profile profile where membership.id=$1 and membership.member_id=profile.id
      and membership.client='operator'`, [membership, label]);
}

async function raiseMembershipVersion(database: OperationDatabase, membership: string, expectedVersion: number): Promise<number> {
  const raised = await database.query<{ access_version: string | number }>(`update access.membership set access_version=access_version+1
    where id=$1 and access_version=$2 returning access_version`, [membership, expectedVersion]);
  const version = raised.rows[0]?.access_version;
  if (version === undefined) throw new Error('VERSION_CONFLICT');
  return numericVersion(version);
}

export function requireManagementTarget(target: ManagementTargetRow, grantScope: Scope | null): void {
  if (target.target_membership_id === null || target.target_client !== 'operator' || target.target_status !== 'active') {
    throw new Error('MANAGEMENT_PERMISSION_TARGET_NOT_ACTIVE_OPERATOR');
  }
  if (target.target_realm_id === null || target.actor_realm_id === null
    || target.target_realm_id !== target.actor_realm_id || !target.target_realm_binding) {
    throw new Error('MANAGEMENT_PERMISSION_REALM_MISMATCH');
  }
  const membershipScope = canonicalScope(target.target_membership_scope);
  if (!target.target_organization_binding || grantScope === null || membershipScope === null
    || governanceOrganization(grantScope) !== governanceOrganization(membershipScope)) {
    throw new Error('MANAGEMENT_PERMISSION_ORGANIZATION_MISMATCH');
  }
}

function governanceOrganization(scope: Scope): string {
  if (scope.kind === 'platform' || scope.kind === 'tenant') return scope.id;
  return scope.tenant ?? [...scope.path].reverse().find(({ kind }) => kind === 'tenant')?.id ?? scope.id;
}

function scopesAreRelated(left: Scope, right: Scope): boolean {
  return scopeContains(left, right) || scopeContains(right, left);
}

function scopeContains(ancestor: Scope, descendant: Scope): boolean {
  return (ancestor.kind === descendant.kind && ancestor.id === descendant.id)
    || descendant.path.some((candidate) => candidate.kind === ancestor.kind && candidate.id === ancestor.id);
}

function canonicalScopePath(scope: Scope): string {
  return [...scope.path.map((ancestor) => ancestor.id), scope.id].join('/');
}
