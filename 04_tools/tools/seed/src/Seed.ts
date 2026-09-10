import { createHmac } from 'node:crypto';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { PasswordPolicy } from '../../../../01_core_hexin/services/commerce/src/modules/identity';
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
  const principal = await client.query<{ id: string; account_id: string; realm_id: string }>(`select principal.id,
      membership.account_id,membership.realm_id
    from access.platformowner owner
    join access.membership membership on membership.id=owner.membership_id and membership.status='active'
    join member.profile profile on profile.id=membership.member_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where owner.singleton=true and owner.state='active'
    for update of principal`);
  const principalId = principal.rows[0]?.id;
  const accountId = principal.rows[0]?.account_id;
  const realmId = principal.rows[0]?.realm_id;
  if (!principalId || !accountId || !realmId) throw new Error('LOCAL_ETHAN_PRINCIPAL_MISSING');
  await client.query("delete from identity.credential where principal_id=$1 and provider='password'", [principalId]);
  await client.query(`insert into identity.credential(
      id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at,account_id,realm_id
    ) values(
      'credential:password:ethan-local',$1,'password',$2,$3,'active',clock_timestamp(),clock_timestamp(),$4,$5
    )`, [principalId, subjectHash, passwordHash, accountId, realmId]);
  await client.query(`update identity.principal set credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1`, [principalId]);

  const operator = await client.query<{ member_id: string; organization_id: string }>(`select membership.member_id,membership.organization_id
    from access.platformowner owner
    join access.membership membership on membership.id=owner.membership_id
    join member.profile profile on profile.id=membership.member_id
    where owner.singleton=true and owner.state='active' and membership.client='operator'
      and membership.status='active' and profile.principal_id=$1
    limit 1`, [principalId]);
  const source = operator.rows[0];
  if (!source) throw new Error('LOCAL_ETHAN_OPERATOR_MEMBERSHIP_MISSING');
  const storefront = await client.query<{ id: string }>(`insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version,joined_at)
    values('membership-storefront-ethan-local',$1,'mall-zhudatuan','storefront','SW_LOCAL_ETHAN','active',1,clock_timestamp())
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,
      status='active',employee_no=excluded.employee_no,left_at=null
    returning id`, [source.member_id]);
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
  await client.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':tenant',$1,'tenant',$2,'organization-platform-root/'||$2,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`, [storefrontMembership, source.organization_id]);
  await client.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':mall',$1,'mall','mall-zhudatuan','organization-platform-root/tenant-zhudatuan/enterprise-zhudatuan/mall-zhudatuan','allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`, [storefrontMembership]);
  await removeOrphanedLocalMembershipArtifacts(client);
  await ensureLocalMallCommerce(client);
  await ensureLocalStore(client);
  await ensureLocalListings(client);
  await assertBaseline(client);
  await assertLocalMallBaseline(client);
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
    select 'listing-local:'||pool.scope_id||':'||item.sku_id,pool.scope_id,pool.id,item.sku_id,product.title,'published',
      '1970-01-01T00:00:00Z',null,0,clock_timestamp(),clock_timestamp()
    from catalog.pool pool
    join catalog.poolitem item on item.pool_id=pool.id and item.state='included'
    join catalog.sku sku on sku.id=item.sku_id and sku.status='active'
    join catalog.product product on product.id=sku.product_id and product.status='active'
    where pool.status='active'
    on conflict(scope_id,sku_id) do update set pool_id=excluded.pool_id,title=excluded.title,status='published',
      effective_at=excluded.effective_at,expires_at=null,version=catalog.listing.version+1,updated_at=clock_timestamp()`);
}

async function ensureLocalMallCommerce(database: Client): Promise<void> {
  await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version)
    values('pool-local-mall-zhudatuan','mall-zhudatuan','private','本地验收商品池','active',0)
    on conflict(id) do update set scope_id=excluded.scope_id,kind=excluded.kind,name=excluded.name,status='active'`);
  await database.query(`insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
    select 'pool-local-mall-zhudatuan',item.sku_id,'included','local:v1',clock_timestamp()
    from catalog.poolitem item join catalog.pool pool on pool.id=item.pool_id
    where pool.scope_id='mall-demo' and item.state='included'
    on conflict(pool_id,sku_id) do update set state='included',source_version='local:v1'`);
  await database.query(`insert into pricing.pricebook(id,scope_id,currency,name,status,version)
    values('pricebook:local-mall-zhudatuan','mall-zhudatuan','CNY','本地验收价格簿','active',0)
    on conflict(id) do update set scope_id=excluded.scope_id,currency=excluded.currency,name=excluded.name,status='active'`);
  await database.query(`insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
    select distinct on(price.sku_id) 'price-local:'||price.sku_id,'pricebook:local-mall-zhudatuan',price.sku_id,
      price.amount_minor,price.compare_minor,price.effective_at,price.expires_at
    from pricing.price price join pricing.pricebook book on book.id=price.book_id
    where book.scope_id='mall-demo' and book.status='active'
    order by price.sku_id,price.effective_at desc,price.id
    on conflict(id) do update set book_id=excluded.book_id,sku_id=excluded.sku_id,amount_minor=excluded.amount_minor,
      compare_minor=excluded.compare_minor,effective_at=excluded.effective_at,expires_at=excluded.expires_at`);
  await database.query(`insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
    select distinct on(stock.sku_id) 'stock-local:'||stock.sku_id,'mall-zhudatuan',stock.sku_id,'local',
      stock.onhand,stock.safety,0,'active',clock_timestamp()
    from inventory.stockitem stock where stock.scope_id='mall-demo' and stock.status='active'
    order by stock.sku_id,stock.updated_at desc,stock.id
    on conflict(id) do update set scope_id=excluded.scope_id,sku_id=excluded.sku_id,location_id=excluded.location_id,
      onhand=excluded.onhand,safety=excluded.safety,status='active',updated_at=excluded.updated_at`);
  await database.query(`insert into experience.application(id,scope_id,name,status,head_version_id,created_at,updated_at,version,code,public_slug)
    values('application:mall-zhudatuan-local','mall-zhudatuan','本地验收商城','active',null,clock_timestamp(),clock_timestamp(),0,'ZHUDATUAN_LOCAL','local')
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active',code=excluded.code,
      public_slug=excluded.public_slug,updated_at=clock_timestamp()`);
  await database.query(`insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,
      validation_state,created_by,created_at,reason)
    select '00000000-0000-4000-8000-000000000101','application:mall-zhudatuan-local',1,'1',configuration,
      encode(digest(configuration::text,'sha256'),'hex'),'valid','local-seed',clock_timestamp(),'本地商城验收版本'
    from (select jsonb_build_object('application','application:mall-zhudatuan-local','version',1,'pages',jsonb_build_array()) configuration) source
    on conflict(id) do update set schema_version=excluded.schema_version,configuration=excluded.configuration,
      configuration_hash=excluded.configuration_hash,validation_state='valid',created_by=excluded.created_by,reason=excluded.reason`);
  await database.query(`update experience.application
    set head_version_id='00000000-0000-4000-8000-000000000101',updated_at=clock_timestamp()
    where id='application:mall-zhudatuan-local'`);
  await database.query(`insert into experience.binding(application_id,domain,mall_id,pool_id)
    values('application:mall-zhudatuan-local','local','mall-zhudatuan','pool-local-mall-zhudatuan')
    on conflict(application_id,domain) do update set mall_id=excluded.mall_id,pool_id=excluded.pool_id`);
  await database.query(`insert into experience.release(id,application_id,version_id,state,effective_at,retired_at,published_by)
    values('00000000-0000-4000-8000-000000000102','application:mall-zhudatuan-local',
      '00000000-0000-4000-8000-000000000101','active',clock_timestamp(),null,'local-seed')
    on conflict(id) do update set application_id=excluded.application_id,version_id=excluded.version_id,state='active',
      retired_at=null,published_by=excluded.published_by`);
  await database.query(`insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,
      object_ref,object_hash,object_size,state,staged_at,published_at,failure_code)
    select '00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000102',
      'application:mall-zhudatuan-local',version.id,version.configuration_hash,
      'experience/application:mall-zhudatuan-local/'||version.configuration_hash||'.json',
      'local://experience/application:mall-zhudatuan-local/'||version.configuration_hash,
      version.configuration_hash,octet_length(version.configuration::text),'active',clock_timestamp(),clock_timestamp(),null
    from experience.version version where version.id='00000000-0000-4000-8000-000000000101'
    on conflict(release_id) do update set version_id=excluded.version_id,content_hash=excluded.content_hash,
      object_key=excluded.object_key,object_ref=excluded.object_ref,object_hash=excluded.object_hash,
      object_size=excluded.object_size,state='active',published_at=clock_timestamp(),failure_code=null`);
}

async function ensureLocalStore(database: Client): Promise<void> {
  await database.query(`insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
    values('store-local','mall-zhudatuan','store','本地验收门店','active',0,clock_timestamp(),clock_timestamp())
    on conflict(id) do update set scope_id=excluded.scope_id,kind=excluded.kind,name=excluded.name,status='active',
      version=partner.partner.version+1,updated_at=clock_timestamp()`);
  await database.query(`insert into partner.store(id,mall_id,region_code,service_radius_meters)
    values('store-local','mall-zhudatuan','310000',5000)
    on conflict(id) do update set mall_id=excluded.mall_id,region_code=excluded.region_code,
      service_radius_meters=excluded.service_radius_meters`);
}

async function assertLocalMallBaseline(database: Client): Promise<void> {
  const result = await database.query<{
    source: string; poolitems: string; listings: string; prices: string; stock: string; applications: string;
    bindings: string; releases: string; publications: string; stores: string;
  }>(`select
    (select count(*) from catalog.poolitem item join catalog.pool pool on pool.id=item.pool_id where pool.scope_id='mall-demo' and item.state='included') source,
    (select count(*) from catalog.poolitem where pool_id='pool-local-mall-zhudatuan' and state='included') poolitems,
    (select count(*) from catalog.listing where scope_id='mall-zhudatuan' and status='published') listings,
    (select count(*) from pricing.price price join pricing.pricebook book on book.id=price.book_id where book.scope_id='mall-zhudatuan' and book.status='active') prices,
    (select count(*) from inventory.stockitem where scope_id='mall-zhudatuan' and status='active') stock,
    (select count(*) from experience.application where scope_id='mall-zhudatuan' and status='active') applications,
    (select count(*) from experience.binding where application_id='application:mall-zhudatuan-local'
      and domain='local' and mall_id='mall-zhudatuan' and pool_id='pool-local-mall-zhudatuan') bindings,
    (select count(*) from experience.release where application_id='application:mall-zhudatuan-local'
      and version_id='00000000-0000-4000-8000-000000000101' and state='active' and retired_at is null) releases,
    (select count(*) from experience.publication where application_id='application:mall-zhudatuan-local'
      and version_id='00000000-0000-4000-8000-000000000101' and state='active' and published_at is not null) publications,
    (select count(*) from partner.partner partner join partner.store store on store.id=partner.id where store.mall_id='mall-zhudatuan' and partner.status='active') stores`);
  const values = result.rows[0];
  const source = Number(values?.source ?? 0);
  if (!values || source < 1 || [values.poolitems, values.listings, values.prices, values.stock].some(value => Number(value) < source)
    || Number(values.applications) < 1 || Number(values.bindings) < 1 || Number(values.releases) < 1 || Number(values.publications) < 1
    || Number(values.stores) < 1) throw new Error(`LOCAL_MALL_BASELINE_INCOMPLETE:${JSON.stringify(values)}`);
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
    (select count(*) from access.platformowner owner
      join access.membership membership on membership.id=owner.membership_id and membership.status='active'
      where owner.singleton=true and owner.state='active') ethan`);
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
