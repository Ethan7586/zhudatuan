import { createHash, randomUUID } from 'node:crypto';
import { checkScope, SCOPE_KINDS, type Scope } from '@shop/authz';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { accessPort, type OwnershipProofSnapshot, type OwnershipTransferInput } from '../01_public_gongkai/AccessPort';
import { accessOperatorReadActions } from './AccessReadOperations';
import type { OwnerAction, OwnerActionProofPayload } from '../02_domain_yewu/AccessOwnership';
import { OwnerActionProof } from './OwnerActionProof';
import { administratorSegmentWriteActions } from './AdministratorSegmentOperations';

export function accessOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const proofs = new OwnerActionProof(context.container.get(IDENTITY_SECURITY_KEYS).session);
  return new ModuleOperations('access', pool, context.container.get(AUDIT_SINK), {
    ...accessOperatorReadActions(),
    ...administratorSegmentWriteActions(),
    'access.roles.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const role = request.input.path.roleid!;
      if (body.action === 'assign' || body.action === 'revoke') {
        return manageRoleAssignment(request, database, access, role, body.action);
      }
      if (body.action === 'delete') return deleteCustomRole(request, database, access, role);
      if (body.action !== undefined) throw new Error('VALIDATION_FAILED:action');
      const permissions = body.permissions;
      if (!Array.isArray(permissions) || permissions.some((item) => typeof item !== 'string')) throw new Error('VALIDATION_FAILED:permissions');
      const assignedTargets = await database.query<ManagementTargetRow>(`select target.id target_membership_id,
        target.client target_client,target.status target_status,target.realm_id target_realm_id,
        actor.realm_id actor_realm_id,access.scope_object(target.organization_id) target_membership_scope,
        exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
          and realm_target.surface='admin' and realm_target.membership_client='operator') target_realm_binding,
        exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
          and realm_target.surface='admin' and realm_target.membership_client='operator'
          and realm_target.membership_organization_id=target.organization_id) target_organization_binding
        from access.membershiprole assignment
        join access.membership target on target.id=assignment.membership_id
        join access.membership actor on actor.id=$3 and actor.status='active' and actor.client='operator'
        where assignment.role_id=$1 and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
          and exists(select 1 from access.permission permission
            join capability.operation operation on operation.permission_code=permission.code and operation.audience='operator'
            where permission.code=any($2::text[]) and permission.status='active'
              and not exists(select 1 from capability.operation other where other.permission_code=permission.code
                and other.audience<>'operator'))
        order by target.id for update of target`, [role, permissions, access.membership.id]);
      for (const target of assignedTargets.rows) requireManagementTarget(target, access.scope);
      const result = await database.query(`with target as (
          insert into access.role(id,scope_id,name,status,version) values($1,$2,$3,'active',0)
          on conflict(id) do update set name=excluded.name,status='active',version=access.role.version+1
          where access.role.scope_id=$2 and ($5::bigint is null or access.role.version=$5) returning *
        ), removed as (delete from access.rolepermission mapping using target
          where mapping.role_id=target.id and mapping.effect='allow' returning mapping.role_id), ready as (
          select distinct target.id from target left join removed on removed.role_id=target.id
        ), added as (
          insert into access.rolepermission(role_id,permission_id,effect)
          select ready.id,permission.id,'allow' from ready cross join access.permission permission
          where permission.code=any($4::text[]) returning role_id
        ) select * from target`, [role, access.scope.id, textField(body, 'name'), permissions, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      const affected = (await database.query<{ id: string; access_version: string | number }>(`update access.membership membership
        set access_version=membership.access_version+1 from (
          select distinct assignment.membership_id from access.membershiprole assignment
          where assignment.role_id=$1 and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
        ) assignment where membership.id=assignment.membership_id returning membership.id,membership.access_version`, [role]))
        .rows.map((row) => ({ membership: row.id, access_version: numericVersion(row.access_version) }));
      const saved = rowResult(result);
      return { ...saved, body: Object.freeze({ ...(saved.body as Readonly<Record<string, unknown>>), affected_memberships: affected }) };
    },
    'access.scopes.manage': async (request, database) => {
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
    },
    'access.ownership.read': async (request, database) => {
      const access = requireAccess(request);
      return { status: 200, body: await accessPort.ownership(database, access.membership.id) };
    },
    'access.ownership.transfers.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const snapshot = await accessPort.createProofSnapshot(database, access.membership.id, transferInput(request), expectedVersion);
      const issued = proofs.issue(proofInput('create', request, snapshot, null));
      await accessPort.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.create': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const snapshot = await accessPort.createProofSnapshot(database, access.membership.id, transferInput(request), expectedVersion);
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('create', request, snapshot, null));
      const transfer = await accessPort.createOwnerTransfer(database, `owner-transfer:${randomUUID()}`, payload);
      await publishOwnerEvent(database, 'access.owner.transfer.initiated', String(transfer.id), access.trace, transfer);
      return { status: 201, body: transfer, headers: { etag: `"${String(transfer.version)}"` } };
    },
    'access.ownership.transfers.accept.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'accept');
      const issued = proofs.issue(proofInput('accept', request, snapshot, null));
      await accessPort.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.accept': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'accept');
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('accept', request, snapshot, null));
      const accepted = await accessPort.acceptOwnerTransfer(database, transfer, payload);
      await publishOwnerEvent(database, 'access.owner.transferred', transfer, access.trace, {
        transfer, previousOwnerMembership: payload.sourceMembership, ownerMembership: payload.targetMembership,
        ownershipVersion: accepted.ownershipVersion,
      });
      const ownership = await accessPort.ownership(database, payload.targetMembership);
      return { status: 200, body: { ...ownership, transfer: accepted }, headers: { etag: `"${String(accepted.version)}"` } };
    },
    'access.ownership.transfers.cancel.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const reason = transferReason(request);
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'cancel');
      const issued = proofs.issue(proofInput('cancel', request, snapshot, reasonHash(reason)));
      await accessPort.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.cancel': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const reason = transferReason(request);
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'cancel');
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('cancel', request, snapshot, reasonHash(reason)));
      const cancelled = await accessPort.cancelOwnerTransfer(database, transfer, payload, reason);
      await publishOwnerEvent(database, 'access.owner.transfer.cancelled', transfer, access.trace, cancelled);
      return { status: 200, body: cancelled, headers: { etag: `"${String(cancelled.version)}"` } };
    },
  });
}

async function manageRoleAssignment(request: OperationRequest, database: OperationDatabase, access: ReturnType<typeof requireAccess>,
  role: string, action: 'assign' | 'revoke'): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
  const seniorRoleRequested = role.startsWith('role-senior-administrator-v1:');
  if (seniorRoleRequested && access.governance?.governanceLevel !== 'owner') throw new Error('OWNER_REQUIRED_FOR_SENIOR_ADMINISTRATOR');
  const body = bodyRecord(request);
  const membership = textField(body, 'membership');
  const kind = textField(body, 'kind');
  const scope = textField(body, 'scope');
  const source = textField(body, 'scopeSource');
  if (source !== 'direct' && source !== 'inherited') throw new Error('VALIDATION_FAILED:scopeSource');
  const expectedVersion = requireExpectedVersion(request);
  const resolved = await database.query<{
    scope: unknown;
    target_membership_scope: unknown;
    target_access_version: string | number;
    role_id: string;
    senior_role: boolean;
    target_is_owner: boolean;
    management_role: boolean;
    target_membership_id: string | null;
    target_client: string | null;
    target_status: string | null;
    target_realm_id: string | null;
    actor_realm_id: string | null;
    target_realm_binding: boolean;
    target_organization_binding: boolean;
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

async function deleteCustomRole(request: OperationRequest, database: OperationDatabase, access: ReturnType<typeof requireAccess>,
  role: string): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
  const expectedVersion = requireExpectedVersion(request);
  const selected = await database.query<{ id: string; name: string; version: string | number }>(`select id,name,version from access.role
    where id=$1 and scope_id=$2 and id not in(
      'role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator') for update`,
  [role, access.scope.id]);
  const target = selected.rows[0];
  if (target === undefined) throw new Error('ROLE_DELETE_NOT_AVAILABLE');
  if (numericVersion(target.version) !== expectedVersion) throw new Error('VERSION_CONFLICT');
  const detached = await database.query<{ membership_id: string }>('delete from access.membershiprole where role_id=$1 returning membership_id', [role]);
  await database.query('delete from access.rolepermission where role_id=$1', [role]);
  const deleted = await database.query<{ id: string; name: string }>('delete from access.role where id=$1 and scope_id=$2 returning id,name',
    [role, access.scope.id]);
  if (deleted.rows[0] === undefined) throw new Error('ROLE_DELETE_FAILED');
  const affectedMemberships = [...new Set(detached.rows.map(({ membership_id }) => membership_id))];
  const affected = affectedMemberships.length === 0 ? [] : (await database.query<{ id: string; access_version: string | number }>(
    'update access.membership set access_version=access_version+1 where id=any($1::text[]) returning id,access_version',
    [affectedMemberships])).rows.map((row) => ({ membership: row.id, access_version: numericVersion(row.access_version) }));
  return { status: 200, body: Object.freeze({ action: 'delete', deleted: true, role: target.id, name: target.name,
    affected_memberships: affected }) };
}

async function raiseMembershipVersion(database: OperationDatabase, membership: string, expectedVersion: number): Promise<number> {
  const raised = await database.query<{ access_version: string | number }>(`update access.membership set access_version=access_version+1
    where id=$1 and access_version=$2 returning access_version`, [membership, expectedVersion]);
  const version = raised.rows[0]?.access_version;
  if (version === undefined) throw new Error('VERSION_CONFLICT');
  return numericVersion(version);
}

function numericVersion(value: string | number): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('INVALID_ACCESS_VERSION');
  return version;
}

interface ManagementTargetRow {
  readonly target_membership_id: string | null;
  readonly target_client: string | null;
  readonly target_status: string | null;
  readonly target_realm_id: string | null;
  readonly actor_realm_id: string | null;
  readonly target_membership_scope: unknown;
  readonly target_realm_binding: boolean;
  readonly target_organization_binding: boolean;
}

function requireManagementTarget(target: ManagementTargetRow, grantScope: Scope | null): void {
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

function canonicalScope(value: unknown): Scope | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (typeof candidate.kind !== 'string' || !(SCOPE_KINDS as readonly string[]).includes(candidate.kind)
    || typeof candidate.id !== 'string' || candidate.id.length === 0
    || (candidate.tenant !== undefined && typeof candidate.tenant !== 'string')
    || !Array.isArray(candidate.path)) return null;
  const path = candidate.path.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
    const ancestor = item as Readonly<Record<string, unknown>>;
    if (typeof ancestor.kind !== 'string' || !(SCOPE_KINDS as readonly string[]).includes(ancestor.kind)
      || typeof ancestor.id !== 'string' || ancestor.id.length === 0) return null;
    return { kind: ancestor.kind as Scope['kind'], id: ancestor.id };
  });
  if (path.some((ancestor) => ancestor === null)) return null;
  return {
    kind: candidate.kind as Scope['kind'], id: candidate.id,
    ...(candidate.tenant === undefined ? {} : { tenant: candidate.tenant as string }),
    path: path as Scope['path'],
  };
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

function transferInput(request: OperationRequest): OwnershipTransferInput {
  const body = bodyRecord(request);
  const mode = textField(body, 'formerOwnerMode');
  if (mode !== 'retain_admin' && mode !== 'remove_admin') throw new Error('VALIDATION_FAILED:formerOwnerMode');
  const role = typeof body.formerOwnerRole === 'string' && body.formerOwnerRole.trim() ? body.formerOwnerRole.trim() : null;
  if ((mode === 'retain_admin') !== (role !== null)) throw new Error('OWNER_TRANSFER_ROLE_INVALID');
  return Object.freeze({ targetMembership: textField(body, 'targetMembership'), formerOwnerMode: mode, formerOwnerRole: role });
}

function requireExpectedVersion(request: OperationRequest): number {
  if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  return request.input.expectedVersion;
}

function proofInput(action: OwnerAction, request: OperationRequest, snapshot: OwnershipProofSnapshot,
  reasonHashValue: string | null): Omit<OwnerActionProofPayload, 'v' | 'nonce' | 'expiresAt'> {
  const access = requireAccess(request);
  return Object.freeze({ action, actor: access.actor.id, session: access.actor.session,
    sourceMembership: snapshot.sourceMembership, targetMembership: snapshot.targetMembership,
    formerOwnerMode: snapshot.formerOwnerMode, formerOwnerRole: snapshot.formerOwnerRole,
    formerOwnerRoleVersion: snapshot.formerOwnerRoleVersion,
    ownershipVersion: snapshot.ownershipVersion, transferVersion: snapshot.transferVersion,
    targetAccessVersion: snapshot.targetAccessVersion, reasonHash: reasonHashValue });
}

function proofResponse(proof: string, payload: OwnerActionProofPayload): Readonly<Record<string, unknown>> {
  return Object.freeze({ proof, proofExpiresAt: payload.expiresAt, ownershipVersion: payload.ownershipVersion,
    transferVersion: payload.transferVersion, targetAccessVersion: payload.targetAccessVersion,
    sourceMembership: payload.sourceMembership, targetMembership: payload.targetMembership,
    formerOwnerMode: payload.formerOwnerMode, formerOwnerRole: payload.formerOwnerRole,
    formerOwnerRoleVersion: payload.formerOwnerRoleVersion });
}

function transferReason(request: OperationRequest): string {
  const reason = textField(bodyRecord(request), 'reason').trim();
  if (reason.length < 3 || reason.length > 500) throw new Error('VALIDATION_FAILED:reason');
  return reason;
}

function reasonHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

async function publishOwnerEvent(database: OperationDatabase, type: string, aggregate: string,
  trace: string, payload: unknown): Promise<void> {
  await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,$2,1,'access',$3,'tenant-zhudatuan',$4::jsonb,$5,clock_timestamp(),clock_timestamp())`,
  [`event:${randomUUID()}`, type, aggregate, JSON.stringify(payload), trace]);
}
