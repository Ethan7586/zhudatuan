import { createHmac } from 'node:crypto';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { PasswordPolicy } from '../../../services/commerce/src/modules/identity/domain/policy/PasswordPolicy';
import { localSecret } from './LocalSecrets';

const environment = localSeedEnvironment();
const [connectionString, password, identityKey] = await Promise.all([
  localSecret(environment.adminDatabaseConnectionRef),
  localSecret(environment.ethanPasswordRef),
  localSecret(environment.identityKeyRef),
]);
const passwordHash = await new PasswordPolicy().hash(password);
const subjectHash = createHmac('sha256', identityKey).update('ethan').digest('hex');
const EMPLOYEE_PERMISSIONS = Object.freeze([
  'catalog.listing.read', 'pricing.offer.read', 'inventory.read', 'cart.read', 'cart.manage', 'checkout.create', 'order.create',
  'order.read', 'order.aftersale.apply', 'payment.create', 'benefit.read', 'voucher.binding.read', 'support.case.create',
  'observability.clienterror.create',
] as const);
const client = new Client({ connectionString });
await client.connect();

try {
  await client.query('begin');
  await removeReplayFixtures(client);
  const principal = await client.query<{ id: string }>(`select principal.id from identity.principal principal
    join member.profile profile on profile.principal_id=principal.id where profile.id='member-fresh-replay-ethan' and principal.status='active' for update`);
  const principalId = principal.rows[0]?.id;
  if (!principalId) throw new Error('LOCAL_ETHAN_PRINCIPAL_MISSING');
  await client.query("delete from identity.credential where principal_id=$1 and provider='password'", [principalId]);
  await client.query(`insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at)
    values('credential:password:ethan-local',$1,'password',$2,$3,'active',clock_timestamp(),clock_timestamp())`, [principalId, subjectHash, passwordHash]);
  await client.query(`update identity.principal set credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1`, [principalId]);

  const operator = await client.query<{ member_id: string; organization_id: string }>(`select member_id,organization_id from access.membership
    where member_id='member-fresh-replay-ethan' and client='operator' and status='active' order by joined_at nulls last,id limit 1`);
  const source = operator.rows[0];
  if (!source) throw new Error('LOCAL_ETHAN_OPERATOR_MEMBERSHIP_MISSING');
  const storefront = await client.query<{ id: string }>(`insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version,joined_at)
    values('membership-storefront-ethan-local',$1,$2,'storefront','SW_LOCAL_ETHAN','active',1,clock_timestamp())
    on conflict(member_id,organization_id,client) do update set status='active',employee_no=excluded.employee_no,left_at=null
    returning id`, [source.member_id, source.organization_id]);
  const storefrontMembership = storefront.rows[0]?.id;
  if (!storefrontMembership) throw new Error('LOCAL_ETHAN_STOREFRONT_MEMBERSHIP_MISSING');
  await client.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
    values($1,'role:self','1970-01-01T00:00:00Z') on conflict do nothing`, [storefrontMembership]);
  await client.query(`insert into access.role(id,scope_id,name,status,version)
    values('role-employee',$1,'员工','active',0)
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active'`, [source.organization_id]);
  await client.query(`delete from access.rolepermission mapping using access.permission permission
    where mapping.role_id='role-employee' and mapping.permission_id=permission.id and mapping.effect='deny'
      and permission.code=any($1::text[])`, [EMPLOYEE_PERMISSIONS]);
  await client.query(`insert into access.rolepermission(role_id,permission_id,effect)
    select 'role-employee',permission.id,'allow' from access.permission permission where permission.code=any($1::text[])
    on conflict do nothing`, [EMPLOYEE_PERMISSIONS]);
  await client.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
    values($1,'role-employee','1970-01-01T00:00:00Z') on conflict do nothing`, [storefrontMembership]);
  await client.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':self',$1,'self','self:'||$2,'self:'||$2,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`, [storefrontMembership, principalId]);
  await client.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':owner',$1,'owner',$2,$2,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`, [storefrontMembership, source.member_id]);
  await removeOrphanedLocalMembershipArtifacts(client);
  await ensureLocalStore(client);
  await ensureLocalListings(client);
  await assertBaseline(client);
  await assertEmployeePermissions(client, storefrontMembership);
  await client.query('commit');
  process.stdout.write('LOCAL_BASELINE_SEEDED tenant=1 enterprise=1 mall=1 store=1 supplier=1 ethan=1\n');
} catch (cause) {
  await client.query('rollback');
  throw cause;
} finally {
  await client.end();
}

async function ensureLocalListings(database: Client): Promise<void> {
  await database.query(`insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
    select 'listing-local:'||item.sku_id,pool.scope_id,pool.id,item.sku_id,product.title,'published',
      '1970-01-01T00:00:00Z',null,0,clock_timestamp(),clock_timestamp()
    from catalog.pool pool
    join catalog.poolitem item on item.pool_id=pool.id and item.state='included'
    join catalog.sku sku on sku.id=item.sku_id and sku.status='active'
    join catalog.product product on product.id=sku.product_id and product.status='active'
    where pool.status='active'
    on conflict(scope_id,sku_id) do update set pool_id=excluded.pool_id,title=excluded.title,status='published',
      effective_at=excluded.effective_at,expires_at=null,version=catalog.listing.version+1,updated_at=clock_timestamp()`);
}

async function ensureLocalStore(database: Client): Promise<void> {
  await database.query(`insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
    values('store-local','tenant-smart-wing','store','本地验收门店','active',0,clock_timestamp(),clock_timestamp())
    on conflict(id) do update set scope_id=excluded.scope_id,kind=excluded.kind,name=excluded.name,status='active',
      version=partner.partner.version+1,updated_at=clock_timestamp()`);
  await database.query(`insert into partner.store(id,mall_id,region_code,service_radius_meters)
    values('store-local','mall-demo','310000',5000)
    on conflict(id) do update set mall_id=excluded.mall_id,region_code=excluded.region_code,
      service_radius_meters=excluded.service_radius_meters`);
}

async function removeReplayFixtures(database: Client): Promise<void> {
  await database.query("delete from extension.installation where extension_id='replayprovider'");
  await database.query("delete from extension.contractversion where extension_id='replayprovider'");
  await database.query("delete from extension.manifest where id='replayprovider'");
  await database.query('alter table audit.record disable trigger immutable');
  await database.query("delete from audit.record where id='audit:immutability'");
  await database.query('alter table audit.record enable trigger immutable');
}

async function removeOrphanedLocalMembershipArtifacts(database: Client): Promise<void> {
  await database.query(`delete from access.membershiprole assignment
    where assignment.membership_id='membership-storefront-ethan-local'
      and not exists(select 1 from access.membership membership where membership.id=assignment.membership_id)`);
  await database.query(`delete from access.scopegrant scopeassignment
    where scopeassignment.membership_id='membership-storefront-ethan-local'
      and not exists(select 1 from access.membership membership where membership.id=scopeassignment.membership_id)`);
}

async function assertBaseline(database: Client): Promise<void> {
  const result = await database.query<{
    accounts: string; catalog: string; enterprise: string; ethan: string; grants: string; inventory: string; listings: string;
    mall: string; meal: string; pool: string; prices: string; roles: string; store: string; supplier: string; tenant: string; welfare: string;
  }>(`select
    (select count(*) from organization.organization where kind='tenant' and status='active') tenant,
    (select count(*) from organization.organization where kind='enterprise' and status='active') enterprise,
    (select count(*) from organization.organization where kind='mall' and status='active') mall,
    (select count(*) from partner.partner where kind='store' and status='active') store,
    (select count(*) from partner.partner where kind='supplier' and status='active') supplier,
    (select count(*) from catalog.product where status='active') catalog,
    (select count(*) from catalog.pool where status='active') pool,
    (select count(*) from catalog.listing where status='published') listings,
    (select count(*) from pricing.price) prices,
    (select count(*) from inventory.stockitem) inventory,
    (select count(*) from benefit.account where status='active') accounts,
    (select count(*) from benefit.account where kind='welfare' and status='active') welfare,
    (select count(*) from benefit.account where kind='meal' and status='active') meal,
    (select count(*) from access.role where status='active') roles,
    (select count(*) from access.rolepermission) grants,
    (select count(*) from access.membership where member_id='member-fresh-replay-ethan' and status='active') ethan`);
  const values = result.rows[0];
  if (!values || Object.values(values).some(value => Number(value) < 1)) throw new Error(`LOCAL_BASELINE_INCOMPLETE:${JSON.stringify(values)}`);
}

async function assertEmployeePermissions(database: Client, membership: string): Promise<void> {
  const result = await database.query<{ code: string }>(`select requested.code from unnest($1::text[]) requested(code)
    where not exists(
      select 1 from access.membershiprole assignment
      join access.rolepermission mapping on mapping.role_id=assignment.role_id and mapping.effect='allow'
      join access.permission permission on permission.id=mapping.permission_id and permission.code=requested.code
      where assignment.membership_id=$2 and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    ) or exists(
      select 1 from access.membershiprole assignment
      join access.rolepermission mapping on mapping.role_id=assignment.role_id and mapping.effect='deny'
      join access.permission permission on permission.id=mapping.permission_id and permission.code=requested.code
      where assignment.membership_id=$2
    ) order by requested.code`, [EMPLOYEE_PERMISSIONS, membership]);
  if (result.rows.length > 0) throw new Error(`LOCAL_EMPLOYEE_PERMISSIONS_MISSING:${result.rows.map(({ code }) => code).join(',')}`);
}
