import { createHash, createHmac } from 'node:crypto';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { PasswordPolicy } from '../../../services/commerce/src/modules/identity/domain/policy/PasswordPolicy';
import { KmsClient } from '../../../services/commerce/src/foundation/infrastructure/KmsClient';
import { localSecret } from './LocalSecrets';
import { assertLocalOwnership, ensureLocalOwner, LOCAL_OWNER } from './LocalOwner';
import { ensureLocalChecker } from './LocalChecker';
import { ensureLocalBenefits } from './LocalBenefits';

const environment = localSeedEnvironment();
const [connectionString, password, identityKey] = await Promise.all([localSecret(environment.adminDatabaseConnectionRef), localSecret(environment.ethanPasswordRef), localSecret(environment.identityKeyRef)]);
const passwordHash = await new PasswordPolicy().hash(password);
const subjectHash = createHmac('sha256', identityKey).update('ethan').digest('hex');
const mobile = '+8613800138000';
const mobileSubjectHash = createHmac('sha256', identityKey).update(mobile).digest('hex');
const kms = new KmsClient(environment.kmsEndpoint, environment.kmsBearerToken);
const mobileEnvelope = await kms.encrypt('pii', 'identity/mobile', mobile, { principal: LOCAL_OWNER.principal });
const EMPLOYEE_PERMISSIONS = Object.freeze([
  'catalog.listing.read',
  'pricing.offer.read',
  'inventory.read',
  'cart.read',
  'cart.manage',
  'checkout.create',
  'order.create',
  'order.read',
  'order.aftersale.apply',
  'benefit.read',
  'voucher.binding.read',
  'voucher.redemption.read',
  'support.case.create',
  'observability.clienterror.create',
] as const);
const client = new Client({ connectionString });
await client.connect();

try {
  await client.query('begin');
  await removeReplayFixtures(client);
  await ensureLocalOwner(client);
  await ensureLocalChecker(client, { passwordHash, identityKey, kms });
  const principalId = LOCAL_OWNER.principal;
  await client.query(
    `update member.profile set mobile_ciphertext=$2,mobile_token=$3,mobile_masked='138****8000',updated_at=clock_timestamp(),version=version+1
    where id=$1 and principal_id=$4`,
    [LOCAL_OWNER.member, mobileEnvelope.ciphertext, mobileEnvelope.fingerprint, principalId]
  );
  await client.query("delete from identity.credential where principal_id=$1 and provider in('password','otp')", [principalId]);
  await client.query(
    `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at)
    values('credential:password:zhudatuan-owner-ethan:v1',$1,'password',$2,$3,'active',clock_timestamp(),clock_timestamp())`,
    [principalId, subjectHash, passwordHash]
  );
  await client.query(
    `insert into identity.credential(id,principal_id,provider,subject_hash,status,created_at)
    values('credential:otp:zhudatuan-owner-ethan:v1',$1,'otp',$2,'active',clock_timestamp())`,
    [principalId, mobileSubjectHash]
  );
  await client.query(`update identity.principal set credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1`, [principalId]);

  const storefront = await client.query<{ id: string }>(
    `insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version,joined_at,principal_id)
    values('membership-storefront-ethan-local',$1,$2,'storefront','SW_LOCAL_ETHAN','active',1,clock_timestamp(),$3)
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,
      principal_id=excluded.principal_id,status='active',employee_no=excluded.employee_no,left_at=null
    returning id`,
    [LOCAL_OWNER.member, LOCAL_OWNER.mall, LOCAL_OWNER.principal]
  );
  const storefrontMembership = storefront.rows[0]?.id;
  if (!storefrontMembership) throw new Error('LOCAL_ETHAN_STOREFRONT_MEMBERSHIP_MISSING');
  await client.query(
    `insert into access.membershiprole(membership_id,role_id,effective_at)
    values($1,'role:self','1970-01-01T00:00:00Z') on conflict do nothing`,
    [storefrontMembership]
  );
  await client.query(
    `insert into access.role(id,scope_id,name,status,version)
    values('role-employee',$1,'员工','active',0)
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active'`,
    [LOCAL_OWNER.mall]
  );
  await client.query(`delete from access.rolepermission where role_id='role-employee'`);
  await client.query(
    `insert into access.rolepermission(role_id,permission_id,effect)
    select 'role-employee',permission.id,'allow' from access.permission permission where permission.code=any($1::text[])
    on conflict do nothing`,
    [EMPLOYEE_PERMISSIONS]
  );
  await client.query(
    `insert into access.membershiprole(membership_id,role_id,effective_at)
    values($1,'role-employee','1970-01-01T00:00:00Z') on conflict do nothing`,
    [storefrontMembership]
  );
  await client.query(
    `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':mall',$1,'mall',$2,$3,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`,
    [storefrontMembership, LOCAL_OWNER.mall, `${LOCAL_OWNER.tenant}/${LOCAL_OWNER.mall}`]
  );
  await client.query(
    `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':self',$1,'self','self:'||$2,'self:'||$2,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`,
    [storefrontMembership, principalId]
  );
  await client.query(
    `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:'||$1||':owner',$1,'owner',$2,$2,'allow','1970-01-01T00:00:00Z',1)
    on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
      effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null`,
    [storefrontMembership, LOCAL_OWNER.member]
  );
  await removeOrphanedLocalMembershipArtifacts(client);
  await ensureLocalStore(client);
  await ensureLocalSupport(client);
  await ensureLocalBenefits(client);
  await ensureLocalMallCatalog(client);
  await ensureLocalQualification(client);
  await ensureLocalListings(client);
  await ensureLocalCommercialCatalog(client);
  await assertBaseline(client);
  await assertEmployeePermissions(client, storefrontMembership);
  await assertLocalOwnership(client);
  await client.query('commit');
  process.stdout.write('LOCAL_BASELINE_SEEDED tenant=1 enterprise=1 mall=1 store=1 supplier=1 ethan=1 checker=1\n');
} catch (cause) {
  await client.query('rollback');
  throw cause;
} finally {
  await client.end();
}

async function ensureLocalListings(database: Client): Promise<void> {
  await database.query(`update cart.item item set listing_id='listing:'||listing.scope_id||':'||listing.sku_id
    from catalog.listing listing where item.listing_id=listing.id and listing.id like 'listing-local:%'`);
  await database.query(`update member.favorite favorite set listing_id='listing:'||listing.scope_id||':'||listing.sku_id
    from catalog.listing listing where favorite.listing_id=listing.id and listing.id like 'listing-local:%'`);
  await database.query(`update ordering.line line set listing_id='listing:'||listing.scope_id||':'||listing.sku_id
    from catalog.listing listing where line.listing_id=listing.id and listing.id like 'listing-local:%'`);
  await database.query(`update ordering.aftersaleline line set listing_id='listing:'||listing.scope_id||':'||listing.sku_id
    from catalog.listing listing where line.listing_id=listing.id and listing.id like 'listing-local:%'`);
  await database.query(`update catalog.listing set id='listing:'||scope_id||':'||sku_id where id like 'listing-local:%'`);
  await database.query(`insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
    select distinct on(pool.scope_id,item.sku_id)
      'listing:'||pool.scope_id||':'||item.sku_id,pool.scope_id,pool.id,item.sku_id,product.title,'published',
      '1970-01-01T00:00:00Z',null,0,clock_timestamp(),clock_timestamp()
    from catalog.pool pool
    join catalog.poolitem item on item.pool_id=pool.id and item.state='included'
    join catalog.sku sku on sku.id=item.sku_id and sku.status='active'
    join catalog.product product on product.id=sku.product_id and product.status='active'
    where pool.status='active'
    order by pool.scope_id,item.sku_id,case when pool.id='pool-local-zhudatuan' then 0 else 1 end,pool.id
    on conflict(scope_id,sku_id) do update set pool_id=excluded.pool_id,title=excluded.title,status='published',
      effective_at=excluded.effective_at,expires_at=null,
      version=catalog.listing.version+case when (catalog.listing.pool_id,catalog.listing.title,catalog.listing.status,catalog.listing.effective_at,catalog.listing.expires_at)
        is distinct from (excluded.pool_id,excluded.title,excluded.status,excluded.effective_at,excluded.expires_at) then 1 else 0 end,
      updated_at=case when (catalog.listing.pool_id,catalog.listing.title,catalog.listing.status,catalog.listing.effective_at,catalog.listing.expires_at)
        is distinct from (excluded.pool_id,excluded.title,excluded.status,excluded.effective_at,excluded.expires_at) then clock_timestamp() else catalog.listing.updated_at end`);
  await database.query(`update cart.item item set listing_version=listing.version::text,version=item.version+1
    from catalog.listing listing where item.listing_id=listing.id and item.listing_version<>listing.version::text`);
}

async function ensureLocalQualification(database: Client): Promise<void> {
  await database.query(
    `insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
    values($1,$2,'310000','上海市','{"source":"local-acceptance"}'::jsonb,'active',1,clock_timestamp())
    on conflict(member_id) do update set scope_id=excluded.scope_id,city_code=excluded.city_code,city_name=excluded.city_name,
      attributes=excluded.attributes,status='active',
      version=qualification.profile.version+case when (qualification.profile.scope_id,qualification.profile.city_code,qualification.profile.city_name,qualification.profile.attributes,qualification.profile.status)
        is distinct from (excluded.scope_id,excluded.city_code,excluded.city_name,excluded.attributes,excluded.status) then 1 else 0 end,
      updated_at=case when (qualification.profile.scope_id,qualification.profile.city_code,qualification.profile.city_name,qualification.profile.attributes,qualification.profile.status)
        is distinct from (excluded.scope_id,excluded.city_code,excluded.city_name,excluded.attributes,excluded.status) then clock_timestamp() else qualification.profile.updated_at end`,
    [LOCAL_OWNER.member, LOCAL_OWNER.mall]
  );
}

async function ensureLocalCommercialCatalog(database: Client): Promise<void> {
  await database.query(
    `insert into pricing.pricebook(id,scope_id,currency,name,status,version)
    values('pricebook-local-zhudatuan','mall-zhudatuan','CNY','主打团福利商城验收价目表','active',1)
    on conflict(id) do update set scope_id=excluded.scope_id,currency=excluded.currency,name=excluded.name,status='active',
      version=pricing.pricebook.version+1`
  );
  await database.query(
    `insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
    select 'price-local-'||md5(item.sku_id),'pricebook-local-zhudatuan',item.sku_id,
      greatest(coalesce(source.amount_minor,10000),100) amount_minor,
      greatest(coalesce(source.compare_minor,source.amount_minor,12800),greatest(coalesce(source.amount_minor,10000),100)) compare_minor,
      '1970-01-01T00:00:00Z',null
    from catalog.poolitem item
    left join lateral(select price.amount_minor,price.compare_minor from pricing.price price
      join pricing.pricebook book on book.id=price.book_id and book.scope_id<>'mall-zhudatuan'
      where price.sku_id=item.sku_id and price.effective_at<=clock_timestamp()
        and (price.expires_at is null or price.expires_at>clock_timestamp())
      order by price.effective_at desc,price.id limit 1) source on true
    where item.pool_id='pool-local-zhudatuan' and item.state='included'
    on conflict(book_id,sku_id,effective_at) do update set amount_minor=excluded.amount_minor,
      compare_minor=excluded.compare_minor,expires_at=null`
  );
  await database.query(
    `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
    select 'stock-local-'||md5(item.sku_id),'mall-zhudatuan',item.sku_id,'local-main',
      greatest(coalesce(source.onhand,100),coalesce(source.safety,0)+10),coalesce(source.safety,0),1,'active',clock_timestamp()
    from catalog.poolitem item
    left join lateral(select stock.onhand,stock.safety from inventory.stockitem stock
      where stock.sku_id=item.sku_id and stock.scope_id<>'mall-zhudatuan' and stock.status='active'
      order by stock.updated_at desc,stock.id limit 1) source on true
    where item.pool_id='pool-local-zhudatuan' and item.state='included'
    on conflict(scope_id,sku_id,location_id) do update set onhand=excluded.onhand,safety=excluded.safety,
      version=inventory.stockitem.version+1,status='active',updated_at=clock_timestamp()`
  );
  const readiness = await database.query<{ invalid_listing: number; missing_price: number; missing_stock: number }>(
    `select
      (select count(*)::integer from catalog.listing listing where listing.pool_id='pool-local-zhudatuan'
        and listing.id!~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$') invalid_listing,
      (select count(*)::integer from catalog.poolitem item where item.pool_id='pool-local-zhudatuan' and item.state='included'
        and not exists(select 1 from pricing.price price where price.book_id='pricebook-local-zhudatuan' and price.sku_id=item.sku_id
          and price.amount_minor>0 and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp()))) missing_price,
      (select count(*)::integer from catalog.poolitem item where item.pool_id='pool-local-zhudatuan' and item.state='included'
        and not exists(select 1 from inventory.stockitem stock where stock.scope_id='mall-zhudatuan' and stock.sku_id=item.sku_id
          and stock.status='active' and stock.onhand>stock.safety)) missing_stock`
  );
  const row = readiness.rows[0];
  if (!row || row.invalid_listing !== 0 || row.missing_price !== 0 || row.missing_stock !== 0) throw new Error(`LOCAL_COMMERCIAL_CATALOG_INCOMPLETE:${JSON.stringify(row)}`);
}

async function ensureLocalMallCatalog(database: Client): Promise<void> {
  const application = 'application:zhudatuan:local';
  const version = 'version:zhudatuan:local:v1';
  const configuration = JSON.stringify({
    application,
    pages: [{ blocks: [{ component: 'hero', content: { subtitle: '企业福利，温暖抵达', title: '主打团福利商城' }, id: `${application}:home:hero` }], id: `${application}:home`, path: 'home' }],
    version: 2,
  });
  const contentHash = createHash('sha256').update(configuration).digest('hex');
  await database.query(
    `insert into catalog.pool(id,scope_id,kind,name,status,version)
    values('pool-local-zhudatuan','mall-zhudatuan','private','主打团福利商城 · 本地验收商品池','active',0)
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active'`
  );
  await database.query(
    `insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
    select 'pool-local-zhudatuan',source.sku_id,'included',source.source_version,clock_timestamp()
    from catalog.poolitem source where source.pool_id=(select id from catalog.pool where id<>'pool-local-zhudatuan' and status='active' order by id limit 1)
    on conflict do nothing`
  );
  await database.query(
    `insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
    values('mall-zhudatuan','pool-local-zhudatuan','selected','active','1970-01-01T00:00:00Z',clock_timestamp())
    on conflict(mall_id,pool_id) do update set status='active',effective_at=excluded.effective_at,expires_at=null`
  );
  await database.query(
    `insert into experience.application(id,scope_id,code,public_slug,name,status,head_version_id,created_at,updated_at,version)
    values($1,'mall-zhudatuan','ZHUDATUAN_LOCAL','zhudatuan-local','主打团福利商城','active',$2,clock_timestamp(),clock_timestamp(),1)
    on conflict(id) do update set scope_id=excluded.scope_id,code=excluded.code,public_slug=excluded.public_slug,
      name=excluded.name,status='active',head_version_id=excluded.head_version_id,updated_at=clock_timestamp()`,
    [application, version]
  );
  await database.query(
    `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
    values($1,$2,1,'2',$3::jsonb,$4,'valid','本地验收已发布装修',$5,clock_timestamp())
    on conflict(id) do update set configuration=excluded.configuration,configuration_hash=excluded.configuration_hash,
      validation_state='valid',reason=excluded.reason`,
    [version, application, configuration, contentHash, LOCAL_OWNER.principal]
  );
  await database.query(`delete from experience.binding where application_id=$1 and domain<>'127.0.0.1'`, [application]);
  await database.query(
    `insert into experience.binding(application_id,domain,mall_id,pool_id)
    values($1,'127.0.0.1','mall-zhudatuan','pool-local-zhudatuan')
    on conflict(application_id,domain) do update set mall_id=excluded.mall_id,pool_id=excluded.pool_id`,
    [application]
  );
  await database.query(
    `insert into experience.release(id,application_id,version_id,state,effective_at,retired_at,published_by)
    values('release:zhudatuan:local:v1',$1,$2,'active','1970-01-01T00:00:00Z',null,$3)
    on conflict(id) do update set version_id=excluded.version_id,state='active',effective_at=excluded.effective_at,
      retired_at=null,published_by=excluded.published_by`,
    [application, version, LOCAL_OWNER.principal]
  );
  await database.query(
    `insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,
      object_size,state,staged_at,published_at,failure_code)
    select 'publication:zhudatuan:local:v1','release:zhudatuan:local:v1',$1,$2,$3::char(64),
      'experience/'||$1||'/'||$3::text||'.json','local://experience/'||$1||'/'||$3::text,$3::char(64),
      octet_length(version.configuration::text),'active',clock_timestamp(),clock_timestamp(),null
    from experience.version version where version.id=$2
    on conflict(id) do update set release_id=excluded.release_id,application_id=excluded.application_id,
      version_id=excluded.version_id,content_hash=excluded.content_hash,object_key=excluded.object_key,
      object_ref=excluded.object_ref,object_hash=excluded.object_hash,object_size=excluded.object_size,
      state='active',published_at=clock_timestamp(),failure_code=null`,
    [application, version, contentHash]
  );
}

async function ensureLocalStore(database: Client): Promise<void> {
  await database.query(`insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
    values('store-local','tenant-zhudatuan','store','本地验收门店','active',0,clock_timestamp(),clock_timestamp())
    on conflict(id) do update set scope_id=excluded.scope_id,kind=excluded.kind,name=excluded.name,status='active',
      version=partner.partner.version+1,updated_at=clock_timestamp()`);
  await database.query(`insert into partner.store(id,mall_id,region_code,service_radius_meters)
    values('store-local','mall-zhudatuan','310000',5000)
    on conflict(id) do update set mall_id=excluded.mall_id,region_code=excluded.region_code,
      service_radius_meters=excluded.service_radius_meters`);
}

async function ensureLocalSupport(database: Client): Promise<void> {
  await database.query(
    `insert into support.account(id,scope_id,channel,external_ref,secret_ref,state,version)
    values('support-account-local-inapp',$1,'inapp','smartwing-local',null,'active',0)
    on conflict(id) do update set scope_id=excluded.scope_id,channel=excluded.channel,
      external_ref=excluded.external_ref,secret_ref=null,state='active'`,
    [LOCAL_OWNER.mall]
  );
  await database.query(
    `insert into support.agent(id,scope_id,membership_id,skills,capacity,state)
    values('support-agent-local',$1,$2,'["general","order","benefit"]'::jsonb,20,'available')
    on conflict(id) do update set scope_id=excluded.scope_id,membership_id=excluded.membership_id,
      skills=excluded.skills,capacity=excluded.capacity,state='available'`,
    [LOCAL_OWNER.mall, LOCAL_OWNER.membership]
  );
  await database.query(
    `insert into support.assignmentrule(id,scope_id,name,skill,priorities,weight,state,version,created_at,updated_at)
    values('support-rule-local-general',$1,'商城综合客服','general',array['low','normal','high','urgent'],100,'active',0,clock_timestamp(),clock_timestamp())
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,skill=excluded.skill,
      priorities=excluded.priorities,weight=excluded.weight,state='active',updated_at=clock_timestamp()`,
    [LOCAL_OWNER.mall]
  );
  await database.query(
    `insert into support.sla(id,scope_id,priority,response_seconds,resolution_seconds,version) values
      ('support-sla-local-low',$1,'low',14400,172800,1),
      ('support-sla-local-normal',$1,'normal',7200,86400,1),
      ('support-sla-local-high',$1,'high',1800,28800,1),
      ('support-sla-local-urgent',$1,'urgent',300,7200,1)
    on conflict(id) do update set scope_id=excluded.scope_id,priority=excluded.priority,
      response_seconds=excluded.response_seconds,resolution_seconds=excluded.resolution_seconds,
      version=greatest(support.sla.version,excluded.version)`,
    [LOCAL_OWNER.mall]
  );
}

async function removeReplayFixtures(database: Client): Promise<void> {
  await database.query("delete from extension.registry where installation_id like 'extension:hardcut:%'");
  await database.query("delete from extension.health where installation_id like 'extension:hardcut:%'");
  await database.query("delete from extension.activationhistory where installation_id like 'extension:hardcut:%'");
  await database.query("delete from extension.installation where id like 'extension:hardcut:%'");
  await database.query("delete from channel.connection where id like 'connection:hardcut:%'");
  await database.query("delete from extension.contractversion where extension_id in('supplier','charge','tmall')");
  await database.query("delete from extension.manifest where id in('supplier','charge','tmall')");
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
    accounts: string;
    catalog: string;
    enterprise: string;
    ethan: string;
    ethanbalance: string;
    ethanbenefits: string;
    ethanlots: string;
    grants: string;
    inventory: string;
    listings: string;
    mall: string;
    meal: string;
    pool: string;
    prices: string;
    roles: string;
    store: string;
    supplier: string;
    supportaccount: string;
    supportagent: string;
    supportrule: string;
    supportslas: string;
    tenant: string;
    welfare: string;
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
    (select count(*) from support.account where scope_id='mall-zhudatuan' and state='active') supportaccount,
    (select count(*) from support.agent where scope_id='mall-zhudatuan' and state='available') supportagent,
    (select count(*) from support.assignmentrule where scope_id='mall-zhudatuan' and state='active') supportrule,
    (select count(*) from support.sla where scope_id='mall-zhudatuan' and priority in('low','normal','high','urgent')) supportslas,
    (select count(*) from access.membership where member_id='member:zhudatuan:owner:ethan:v1' and status='active') ethan,
    (select count(*) from benefit.account where member_id='member:zhudatuan:owner:ethan:v1' and scope_id='mall-zhudatuan'
      and kind in('welfare','meal') and status='active') ethanbenefits,
    (select count(*) from benefit.lot lot join benefit.account account on account.id=lot.account_id
      where account.member_id='member:zhudatuan:owner:ethan:v1' and account.scope_id='mall-zhudatuan'
        and lot.state='active' and lot.remaining_minor>0) ethanlots,
    (select coalesce(sum(balance.balance_minor),0) from benefit.account account join benefit.balance balance on balance.account_id=account.id
      where account.member_id='member:zhudatuan:owner:ethan:v1' and account.scope_id='mall-zhudatuan') ethanbalance`);
  const values = result.rows[0];
  if (!values || Object.values(values).some((value) => Number(value) < 1)) throw new Error(`LOCAL_BASELINE_INCOMPLETE:${JSON.stringify(values)}`);
  if (Number(values.ethanbenefits) !== 2 || Number(values.ethanlots) !== 2 || Number(values.ethanbalance) !== 600_000) {
    throw new Error(`LOCAL_BENEFIT_BASELINE_INCONSISTENT:${JSON.stringify(values)}`);
  }
}

async function assertEmployeePermissions(database: Client, membership: string): Promise<void> {
  const result = await database.query<{ code: string }>(
    `select requested.code from unnest($1::text[]) requested(code)
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
    ) order by requested.code`,
    [EMPLOYEE_PERMISSIONS, membership]
  );
  if (result.rows.length > 0) throw new Error(`LOCAL_EMPLOYEE_PERMISSIONS_MISSING:${result.rows.map(({ code }) => code).join(',')}`);
}
