import { requireAccess, rowResult, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { numericVersion, requireExpectedVersion } from './AccessOperationValues';
import { requireManagementTarget, type ManagementTargetRow } from './OperatorGrantOperations';

export async function upsertRoleTemplate(request: OperationRequest, database: OperationDatabase,
  access: ReturnType<typeof requireAccess>, role: string) {
  const body = bodyRecord(request);
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
}

export async function deleteCustomRole(request: OperationRequest, database: OperationDatabase,
  access: ReturnType<typeof requireAccess>, role: string): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
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
