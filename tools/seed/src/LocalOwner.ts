import type { Client } from 'pg';

export const LOCAL_OWNER = Object.freeze({
  principal: 'principal:zhudatuan:owner:ethan:v1',
  member: 'member:zhudatuan:owner:ethan:v1',
  membership: 'membership-platform-owner-ethan-v1',
  tenant: 'tenant-zhudatuan',
  mall: 'mall-zhudatuan',
});

export async function ensureLocalOwner(database: Client): Promise<void> {
  await database.query(
    `insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values($1,'active',1,clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active',updated_at=clock_timestamp()`,
    [LOCAL_OWNER.principal]
  );
  await database.query(
    `insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values($1,$2,'Ethan','active',clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set principal_id=excluded.principal_id,display_name=excluded.display_name,
      status='active',updated_at=clock_timestamp()`,
    [LOCAL_OWNER.member, LOCAL_OWNER.principal]
  );
  await database.query(
    `insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at,principal_id)
    values($1,$2,$3,'operator','active',1,clock_timestamp(),$4)
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,principal_id=excluded.principal_id,
      client='operator',status='active',left_at=null`,
    [LOCAL_OWNER.membership, LOCAL_OWNER.member, LOCAL_OWNER.tenant, LOCAL_OWNER.principal]
  );
  await database.query(
    `delete from access.membershiprole
    where membership_id=$1 and role_id in('role-platform-owner-v2','role:self')`,
    [LOCAL_OWNER.membership]
  );
  await database.query(
    `insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,'role-platform-owner-v2','1970-01-01T00:00:00Z'),($1,'role:self','1970-01-01T00:00:00Z')
    on conflict do nothing`,
    [LOCAL_OWNER.membership]
  );
  await database.query(
    `delete from access.rolepermission mapping using access.permission permission
    where mapping.role_id='role-platform-owner-v2' and mapping.permission_id=permission.id and mapping.effect='deny'
      and exists(select 1 from capability.operation operation where operation.permission_code=permission.code and operation.audience='console')`
  );
  await database.query(
    `insert into access.rolepermission(role_id,permission_id,effect)
    select distinct 'role-platform-owner-v2',permission.id,'allow' from capability.operation operation
    join access.permission permission on permission.code=operation.permission_code and permission.status='active'
    where operation.audience='console' on conflict do nothing`
  );
  await database.query(
    `insert into access.ownership(scope_id,role_id,membership_id)
    values($1,'role-platform-owner-v2',$2)
    on conflict(scope_id) do update set role_id=excluded.role_id,membership_id=excluded.membership_id,
      version=access.ownership.version+1,updated_at=clock_timestamp()`,
    [LOCAL_OWNER.tenant, LOCAL_OWNER.membership]
  );
  await database.query(
    `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:membership-platform-owner-ethan-v1:platform',$1,'platform','organization-platform-root','organization-platform-root','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:tenant',$1,'tenant',$2,$2,'allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:self',$1,'self','self:'||$3,'self:'||$3,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set membership_id=excluded.membership_id,scope_kind=excluded.scope_kind,
      scope_id=excluded.scope_id,scope_path=excluded.scope_path,effect='allow',effective_at=excluded.effective_at,
      expires_at=null,access_version=excluded.access_version`,
    [LOCAL_OWNER.membership, LOCAL_OWNER.tenant, LOCAL_OWNER.principal]
  );
}

export async function assertLocalOwnership(database: Client): Promise<void> {
  const result = await database.query<{
    active_count: number;
    client: string | null;
    membership_id: string | null;
    organization_id: string | null;
    ownership_role: string | null;
    role_scope: string;
    status: string | null;
  }>(
    `select role.scope_id role_scope,ownership.role_id ownership_role,ownership.membership_id,
      membership.organization_id,membership.status,membership.client,
      (select count(*)::integer from access.membershiprole assignment join access.membership owner_membership
        on owner_membership.id=assignment.membership_id and owner_membership.status='active'
        where assignment.role_id=role.id and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) active_count
    from access.role role left join access.ownership ownership on ownership.role_id=role.id
    left join access.membership membership on membership.id=ownership.membership_id
    where role.id='role-platform-owner-v2' and role.kind='owner' and role.status='active'`
  );
  const row = result.rows[0];
  if (
    !row ||
    row.role_scope !== LOCAL_OWNER.tenant ||
    row.ownership_role !== 'role-platform-owner-v2' ||
    row.membership_id !== LOCAL_OWNER.membership ||
    row.organization_id !== LOCAL_OWNER.tenant ||
    row.status !== 'active' ||
    row.client !== 'operator' ||
    row.active_count !== 1
  )
    throw new Error(`LOCAL_OWNER_INTEGRITY_INVALID:${JSON.stringify(row)}`);
}
