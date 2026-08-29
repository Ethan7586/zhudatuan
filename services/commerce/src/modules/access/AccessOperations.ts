import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function accessOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('access', pool, context.container.get(AUDIT_SINK), {
    'access.center.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 500);
      const result = await database.query(`select membership.id,membership.status,membership.access_version,
        coalesce(jsonb_agg(distinct jsonb_build_object('role',role.id,'name',role.name)) filter(where role.id is not null),'[]') roles,
        coalesce(jsonb_agg(distinct jsonb_build_object('id',grant.id,'kind',grant.scope_kind,'scope',grant.scope_id,'effect',grant.effect,'expires',grant.expires_at)) filter(where grant.id is not null),'[]') scopes
        from access.membership membership left join access.membershiprole assignment on assignment.membership_id=membership.id
        left join access.role role on role.id=assignment.role_id left join access.scopegrant grant on grant.membership_id=membership.id
        where membership.organization_id=$1 and ($2::text is null or membership.id>$2)
        group by membership.id order by membership.id limit $3`, [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
    'access.roles.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const role = request.input.path.roleid!;
      const permissions = body.permissions;
      if (!Array.isArray(permissions) || permissions.some((item) => typeof item !== 'string')) throw new Error('VALIDATION_FAILED:permissions');
      const result = await database.query(`with target as (
          insert into access.role(id,scope_id,name,status,version) values($1,$2,$3,'active',0)
          on conflict(id) do update set name=excluded.name,status='active',version=access.role.version+1
          where access.role.scope_id=$2 and ($5::bigint is null or access.role.version=$5) returning *
        ), removed as (delete from access.rolepermission where role_id=$1), added as (
          insert into access.rolepermission(role_id,permission_id,effect)
          select $1,permission.id,'allow' from access.permission permission where permission.code=any($4::text[]) returning role_id
        ) select * from target`, [role, access.scope.id, textField(body, 'name'), permissions, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
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
      const contained = await database.query(`select 1 from access.scopegrant grant
        join access.membership membership on membership.id=grant.membership_id and membership.status='active'
        where grant.membership_id=$1 and grant.effect='allow'
        and grant.scope_id=$2 and grant.scope_kind=$3 and grant.effective_at<=clock_timestamp()
        and grant.access_version>0 and grant.access_version<=membership.access_version
        and (grant.expires_at is null or grant.expires_at>clock_timestamp())`, [access.membership.id, scope, kind]);
      if (!contained.rows[0]) throw new Error('CANNOT_GRANT_UNOWNED_SCOPE');
      const result = await database.query(`with changed as (
          insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,expires_at,access_version)
          values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,(select access_version+1 from access.membership where id=$2))
          on conflict(membership_id,scope_kind,scope_id,effect,effective_at) do nothing returning *
        ), raised as (update access.membership set access_version=access_version+1 where id=$2 returning access_version)
        select changed.*,raised.access_version from changed cross join raised`, [`scope:${randomUUID()}`, membership, kind, scope, `${access.scope.id}/${scope}`, effect, body.expiresAt ?? null]);
      return rowResult(result, 200);
    },
  });
}
