-- Promote the fixed acceptance catalog into the fufu.wang production presentation.
-- Run only after SandboxCatalogDatabase.sql in the isolated production database.

begin;
set constraints all deferred;
select pg_advisory_xact_lock(hashtextextended('production:acceptance-catalog:fufu:v1',0));
select pg_advisory_xact_lock(hashtextextended('audit:mall-zhudatuan',0));

do $boundary$
begin
  if current_database()<>'zhudatuan_registration'
    or session_user<>'postgres'
    or current_setting('shop.production_bootstrap_approval',true)<>'fufu-acceptance-catalog-v1' then
    raise exception 'PRODUCTION_ACCEPTANCE_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from organization.organization
      where id='mall-zhudatuan' and kind='mall' and status='active')
    or not exists(select 1 from experience.application
      where id='application:zhudatuan:sandbox:v1' and scope_id='mall-zhudatuan' and status='active')
    or not exists(select 1 from experience.binding
      where application_id='application:zhudatuan:sandbox:v1'
        and domain in('sandbox.zhudatuan.invalid','fufu.wang')
        and mall_id='mall-zhudatuan' and pool_id='pool:zhudatuan:sandbox') then
    raise exception 'PRODUCTION_ACCEPTANCE_SOURCE_INVALID';
  end if;
  if exists(select 1 from experience.binding
      where lower(domain)='fufu.wang' and application_id<>'application:zhudatuan:sandbox:v1') then
    raise exception 'PRODUCTION_ACCEPTANCE_DOMAIN_CONFLICT';
  end if;
end
$boundary$;

update catalog.category set name='智慧翼验收专区'
where id='category:zhudatuan:sandbox';
update catalog.product set title='智慧翼员工福利礼',
  attributes=jsonb_build_object('acceptance',true,'subtitle','生产验收专用商品'),
  updated_at=clock_timestamp(),version=greatest(version,1)
where id='product:zhudatuan:sandbox:welcome';
update catalog.pool set name='智慧翼验收商品池',version=greatest(version,1)
where id='pool:zhudatuan:sandbox';
update catalog.listing set title='智慧翼员工福利礼',updated_at=clock_timestamp(),version=greatest(version,1)
where id='listing:zhudatuan:sandbox:welcome';
update pricing.pricebook set name='智慧翼验收价目表',version=greatest(version,1)
where id='pricebook:zhudatuan:sandbox';
update experience.application set name='智慧翼企业福利商城',updated_at=clock_timestamp(),version=greatest(version,1)
where id='application:zhudatuan:sandbox:v1';
update experience.binding set domain='fufu.wang'
where application_id='application:zhudatuan:sandbox:v1'
  and domain='sandbox.zhudatuan.invalid';

with source as(
  select replace(version.configuration::text,'application:mall-demo','application:zhudatuan:sandbox:v1')::jsonb document
  from experience.application application
  join experience.version version on version.id=application.head_version_id
  where application.id='application:mall-demo' and version.validation_state='valid'
), changed as(
  update experience.version version set configuration=source.document,
    configuration_hash=encode(public.digest(source.document::text,'sha256'),'hex'),
    validation_state='valid',reason='production acceptance presentation'
  from source where version.id='version:zhudatuan:sandbox:v1'
  returning version.configuration,version.configuration_hash
)
update experience.publication publication set
  content_hash=changed.configuration_hash,
  object_key='experience/application:zhudatuan:sandbox:v1/'||changed.configuration_hash||'.json',
  object_ref='acceptance://experience/application:zhudatuan:sandbox:v1/'||changed.configuration_hash,
  object_hash=changed.configuration_hash,
  object_size=octet_length(changed.configuration::text)
from changed where publication.id='publication:zhudatuan:sandbox:v1';

with recorded as(select clock_timestamp() occurred_at), previous as(
  select record_hash from(
    select record_hash,recorded_at occurred_at from audit.record where scope_id='mall-zhudatuan'
    union all select record_hash,accessed_at from audit.accessrecord where scope_id='mall-zhudatuan'
    union all select last_record_hash,through_at from audit.archiveref where scope_id='mall-zhudatuan'
  ) chain order by occurred_at desc limit 1
), hashes as(
  select recorded.occurred_at,previous.record_hash previous_hash,
    encode(public.digest('application:zhudatuan:sandbox:v1:fufu.wang:active','sha256'),'hex') after_hash
  from recorded left join previous on true
)
insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,
  trace_id,previous_hash,record_hash,recorded_at)
select 'audit:zhudatuan:production-acceptance:v1','mall-zhudatuan','deployment:production-acceptance','system',
  'experience.acceptance.promoted','experience.application','application:zhudatuan:sandbox:v1',null,hashes.after_hash,
  jsonb_build_object('bootstrap','fufu-production-acceptance-v1','acceptanceOnly',true,'productionData',false,
    'domain','fufu.wang','mall','mall-zhudatuan','pool','pool:zhudatuan:sandbox','paymentMutation',false),
  'bootstrap:fufu-production-acceptance-v1',hashes.previous_hash,
  encode(public.digest('audit:zhudatuan:production-acceptance:v1:'||coalesce(hashes.previous_hash,'')||':'
    ||hashes.after_hash||':'||hashes.occurred_at::text,'sha256'),'hex'),hashes.occurred_at
from hashes where not exists(select 1 from audit.record where id='audit:zhudatuan:production-acceptance:v1');

do $assert$
begin
  if (select count(*) from experience.resolve_storefront_host('fufu.wang'))<>1
    or not exists(select 1 from experience.resolve_storefront_host('fufu.wang')
      where application='application:zhudatuan:sandbox:v1' and mall='mall-zhudatuan'
        and pool='pool:zhudatuan:sandbox' and release='release:zhudatuan:sandbox:v1'
        and version='version:zhudatuan:sandbox:v1' and tenant='tenant-zhudatuan') then
    raise exception 'PRODUCTION_ACCEPTANCE_HOST_INVALID';
  end if;
  if not exists(select 1 from catalog.listing listing
      join pricing.price price on price.sku_id=listing.sku_id
      join inventory.stockitem stock on stock.sku_id=listing.sku_id and stock.scope_id=listing.scope_id
      where listing.id='listing:zhudatuan:sandbox:welcome' and listing.scope_id='mall-zhudatuan'
        and listing.status='published' and price.amount_minor=100 and stock.onhand>stock.safety)
    or not exists(select 1 from experience.publication publication
      join experience.version version on version.id=publication.version_id
      where publication.id='publication:zhudatuan:sandbox:v1' and publication.state='active'
        and publication.content_hash=version.configuration_hash and publication.object_hash=publication.content_hash)
    or (select count(*) from audit.record where id='audit:zhudatuan:production-acceptance:v1'
      and evidence->>'domain'='fufu.wang' and evidence->>'paymentMutation'='false')<>1 then
    raise exception 'PRODUCTION_ACCEPTANCE_INTEGRITY_INVALID';
  end if;
end
$assert$;

commit;
