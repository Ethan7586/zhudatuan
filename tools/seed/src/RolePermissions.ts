import type { Client } from 'pg';

export async function grantAudiencePermissions(database: Client, roleId: string, audience: string): Promise<void> {
  await database.query(
    `delete from access.rolepermission mapping
    using access.permission permission,access.separationrule rule
    where mapping.role_id=$1 and mapping.permission_id=permission.id and mapping.effect='allow'
      and rule.state='active' and permission.code=rule.right_permission
      and exists(select 1 from capability.operation operation
        where operation.audience=$2 and operation.permission_code=rule.left_permission)
      and exists(select 1 from capability.operation operation
        where operation.audience=$2 and operation.permission_code=rule.right_permission)`,
    [roleId, audience]
  );
  await database.query(
    `insert into access.rolepermission(role_id,permission_id,effect)
    select distinct $1,permission.id,'allow' from capability.operation operation
    join access.permission permission on permission.code=operation.permission_code and permission.status='active'
    where operation.audience=$2 and not exists(
      select 1 from access.separationrule rule
      where rule.state='active' and rule.right_permission=permission.code
        and exists(select 1 from capability.operation paired
          where paired.audience=operation.audience and paired.permission_code=rule.left_permission)
    ) on conflict do nothing`,
    [roleId, audience]
  );
}
