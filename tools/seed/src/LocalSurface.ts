import type { Client } from 'pg';
import { LOCAL_OWNER } from './LocalOwner';
import { grantAudiencePermissions } from './RolePermissions';

export const LOCAL_SURFACE_ACCESS = Object.freeze({
  store: Object.freeze({ membership: 'membership-store-ethan-local', role: 'role-local-store-operator', scope: LOCAL_OWNER.store }),
  supplier: Object.freeze({ membership: 'membership-supplier-ethan-local', role: 'role-local-supplier-operator', scope: LOCAL_OWNER.supplier }),
});

export async function ensureLocalSurfaceAccess(database: Client): Promise<void> {
  await database.query(
    `insert into access.role(id,scope_id,name,kind,status,version) values
      ($1,$2,'门店操作员','custom','active',1),
      ($3,$4,'供应商操作员','custom','active',1)
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,kind='custom',status='active'`,
    [LOCAL_SURFACE_ACCESS.store.role, LOCAL_SURFACE_ACCESS.store.scope, LOCAL_SURFACE_ACCESS.supplier.role, LOCAL_SURFACE_ACCESS.supplier.scope]
  );
  await database.query('delete from access.rolepermission where role_id=any($1::text[])', [[LOCAL_SURFACE_ACCESS.store.role, LOCAL_SURFACE_ACCESS.supplier.role]]);
  await grantAudiencePermissions(database, LOCAL_SURFACE_ACCESS.store.role, 'store');
  await grantAudiencePermissions(database, LOCAL_SURFACE_ACCESS.supplier.role, 'supplier');
  await database.query(
    `insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version,joined_at,principal_id) values
      ($1,$2,$3,'store','ZDT_LOCAL_STORE','active',1,clock_timestamp(),$4),
      ($5,$2,$3,'supplier','ZDT_LOCAL_SUPPLIER','active',1,clock_timestamp(),$4)
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,
      principal_id=excluded.principal_id,client=excluded.client,employee_no=excluded.employee_no,status='active',left_at=null`,
    [LOCAL_SURFACE_ACCESS.store.membership, LOCAL_OWNER.member, LOCAL_OWNER.tenant, LOCAL_OWNER.principal, LOCAL_SURFACE_ACCESS.supplier.membership]
  );
  await database.query('delete from access.membershiprole where membership_id=any($1::text[])', [[LOCAL_SURFACE_ACCESS.store.membership, LOCAL_SURFACE_ACCESS.supplier.membership]]);
  await database.query(
    `insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,'1970-01-01T00:00:00Z'),($3,$4,'1970-01-01T00:00:00Z')`,
    [LOCAL_SURFACE_ACCESS.store.membership, LOCAL_SURFACE_ACCESS.store.role, LOCAL_SURFACE_ACCESS.supplier.membership, LOCAL_SURFACE_ACCESS.supplier.role]
  );
  await database.query('delete from access.scopegrant where membership_id=any($1::text[])', [[LOCAL_SURFACE_ACCESS.store.membership, LOCAL_SURFACE_ACCESS.supplier.membership]]);
  await database.query(
    `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:membership-store-ethan-local:store',$1,'store',$2,$3,'allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-supplier-ethan-local:supplier',$4,'supplier',$5,$6,'allow','1970-01-01T00:00:00Z',1)`,
    [
      LOCAL_SURFACE_ACCESS.store.membership,
      LOCAL_SURFACE_ACCESS.store.scope,
      `${LOCAL_OWNER.tenant}/${LOCAL_OWNER.mall}/${LOCAL_SURFACE_ACCESS.store.scope}`,
      LOCAL_SURFACE_ACCESS.supplier.membership,
      LOCAL_SURFACE_ACCESS.supplier.scope,
      `${LOCAL_OWNER.tenant}/${LOCAL_SURFACE_ACCESS.supplier.scope}`,
    ]
  );
}

export async function assertLocalSurfaceAccess(database: Client): Promise<void> {
  const result = await database.query<{ client: string; membership: string; operations: number; scopes: number }>(
    `select membership.client,membership.id membership,
      (select count(*)::integer from capability.membership_operations(membership.id)) operations,
      (select count(*)::integer from access.scopegrant grantrow where grantrow.membership_id=membership.id
        and grantrow.effect='allow' and grantrow.scope_kind=membership.client) scopes
    from access.membership membership
    where membership.id=any($1::text[]) and membership.status='active'
    order by membership.client`,
    [[LOCAL_SURFACE_ACCESS.store.membership, LOCAL_SURFACE_ACCESS.supplier.membership]]
  );
  if (result.rows.length !== 2 || result.rows.some(({ client, membership, operations, scopes }) => membership !== LOCAL_SURFACE_ACCESS[client as 'store' | 'supplier']?.membership || operations < 1 || scopes !== 1)) {
    throw new Error(`LOCAL_SURFACE_ACCESS_INVALID:${JSON.stringify(result.rows)}`);
  }
}
