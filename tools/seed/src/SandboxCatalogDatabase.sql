-- Fixed, idempotent acceptance catalog for the independent 主打团 sandbox.
-- This is never run by a migration or a long-lived API role.

set constraints all deferred;

insert into catalog.category(id,parent_id,code,name,status,sort_order)
values('category:zhudatuan:sandbox',null,'ZHUDATUAN_SANDBOX','主打团 Sandbox', 'active',0)
on conflict do nothing;

insert into catalog.product(id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
values('product:zhudatuan:sandbox:welcome',null,null,'category:zhudatuan:sandbox','主打团 Sandbox 验收商品','physical',
  '{"sandbox":true,"subtitle":"仅用于独立测试数据库的原生商城验收"}'::jsonb,'active',1,
  '2026-08-28T00:00:00Z','2026-08-28T00:00:00Z')
on conflict do nothing;

insert into catalog.sku(id,product_id,code,specifications,status,version)
values('sku:zhudatuan:sandbox:welcome','product:zhudatuan:sandbox:welcome','ZHUDATUAN-SANDBOX-WELCOME',
  '{"sandbox":true,"unit":"件"}'::jsonb,'active',1)
on conflict do nothing;

insert into catalog.pool(id,scope_id,kind,name,status,version)
values('pool:zhudatuan:sandbox','mall-zhudatuan','private','主打团 Sandbox 商品池','active',1)
on conflict do nothing;

insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
values('pool:zhudatuan:sandbox','sku:zhudatuan:sandbox:welcome','included','sandbox:v1','2026-08-28T00:00:00Z')
on conflict do nothing;

insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,expires_at,created_at)
values('mall-zhudatuan','pool:zhudatuan:sandbox','selected','active','2026-08-28T00:00:00Z',null,'2026-08-28T00:00:00Z')
on conflict do nothing;

insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
values('listing:zhudatuan:sandbox:welcome','mall-zhudatuan','pool:zhudatuan:sandbox','sku:zhudatuan:sandbox:welcome',
  '主打团 Sandbox 验收商品','published','2026-08-28T00:00:00Z',null,1,
  '2026-08-28T00:00:00Z','2026-08-28T00:00:00Z')
on conflict do nothing;

insert into pricing.pricebook(id,scope_id,currency,name,status,version)
values('pricebook:zhudatuan:sandbox','mall-zhudatuan','CNY','主打团 Sandbox 价目表','active',1)
on conflict do nothing;

insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
values('price:zhudatuan:sandbox:welcome','pricebook:zhudatuan:sandbox','sku:zhudatuan:sandbox:welcome',100,100,
  '2026-08-28T00:00:00Z',null)
on conflict do nothing;

insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
values('stock:zhudatuan:sandbox:welcome','mall-zhudatuan','sku:zhudatuan:sandbox:welcome','sandbox:main',100,0,1,'active',
  '2026-08-28T00:00:00Z')
on conflict do nothing;

insert into experience.application(id,scope_id,code,public_slug,name,status,head_version_id,created_at,updated_at,version)
values('application:zhudatuan:sandbox:v1','mall-zhudatuan','ZHUDATUAN_SANDBOX','zhudatuan-sandbox','主打团 Sandbox 商城',
  'active','version:zhudatuan:sandbox:v1','2026-08-28T00:00:00Z','2026-08-28T00:00:00Z',1)
on conflict do nothing;

insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
select 'version:zhudatuan:sandbox:v1','application:zhudatuan:sandbox:v1',1,'2',document,
  encode(public.digest(document::text,'sha256'),'hex'),'valid','isolated sandbox acceptance catalog','sandbox-bootstrap',
  '2026-08-28T00:00:00Z'
from (values('{
  "version": 2,
  "application": "application:zhudatuan:sandbox:v1",
  "pages": [{"id":"home","path":"home","blocks":[]}]
}'::jsonb)) configuration(document)
on conflict do nothing;

insert into experience.binding(application_id,domain,mall_id,pool_id)
values('application:zhudatuan:sandbox:v1','sandbox.zhudatuan.invalid','mall-zhudatuan','pool:zhudatuan:sandbox')
on conflict do nothing;

insert into experience.release(id,application_id,version_id,state,effective_at,retired_at,published_by)
values('release:zhudatuan:sandbox:v1','application:zhudatuan:sandbox:v1','version:zhudatuan:sandbox:v1','active',
  '2026-08-28T00:00:00Z',null,'sandbox-bootstrap')
on conflict do nothing;

insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,
  object_size,state,staged_at,published_at,failure_code)
select 'publication:zhudatuan:sandbox:v1','release:zhudatuan:sandbox:v1','application:zhudatuan:sandbox:v1',version.id,
  version.configuration_hash,'experience/application:zhudatuan:sandbox:v1/'||version.configuration_hash||'.json',
  'sandbox://experience/application:zhudatuan:sandbox:v1/'||version.configuration_hash,version.configuration_hash,
  octet_length(version.configuration::text),'active','2026-08-28T00:00:00Z','2026-08-28T00:00:00Z',null
from experience.version version where version.id='version:zhudatuan:sandbox:v1'
on conflict do nothing;

with recorded as(select clock_timestamp() occurred_at), previous as(
  select record_hash from(
    select record_hash,recorded_at occurred_at from audit.record where scope_id='mall-zhudatuan'
    union all select record_hash,accessed_at from audit.accessrecord where scope_id='mall-zhudatuan'
    union all select last_record_hash,through_at from audit.archiveref where scope_id='mall-zhudatuan'
  ) chain order by occurred_at desc limit 1
), hashes as(
  select recorded.occurred_at,previous.record_hash previous_hash,
    encode(public.digest('application:zhudatuan:sandbox:v1:listing:zhudatuan:sandbox:welcome:price:zhudatuan:sandbox:welcome:stock:zhudatuan:sandbox:welcome',
      'sha256'),'hex') after_hash
  from recorded left join previous on true
)
insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
  previous_hash,record_hash,recorded_at)
select 'audit:zhudatuan:sandbox-catalog:v1','mall-zhudatuan','sandbox-bootstrap','migration','catalog.sandbox.bootstrapped',
  'experience.application','application:zhudatuan:sandbox:v1',null,hashes.after_hash,
  jsonb_build_object('bootstrap','zhudatuan-sandbox-catalog-v1','sandboxOnly',true,'productionData',false,
    'application','application:zhudatuan:sandbox:v1','listing','listing:zhudatuan:sandbox:welcome',
    'sku','sku:zhudatuan:sandbox:welcome','priceMinor',100,'currency','CNY','location','sandbox:main','onhand',100,
    'provider',null,'financeMutation',false,'paymentMutation',false,'orderMutation',false),
  'bootstrap:zhudatuan-sandbox-catalog-v1',hashes.previous_hash,
  encode(public.digest('audit:zhudatuan:sandbox-catalog:v1:'||coalesce(hashes.previous_hash,'')||':'||hashes.after_hash||':'||hashes.occurred_at::text,
    'sha256'),'hex'),hashes.occurred_at
from hashes where not exists(select 1 from audit.record where id='audit:zhudatuan:sandbox-catalog:v1');

with recorded as(select clock_timestamp() occurred_at), previous as(
  select record_hash from(
    select record_hash,recorded_at occurred_at from audit.record where scope_id='mall-zhudatuan'
    union all select record_hash,accessed_at from audit.accessrecord where scope_id='mall-zhudatuan'
    union all select last_record_hash,through_at from audit.archiveref where scope_id='mall-zhudatuan'
  ) chain order by occurred_at desc limit 1
), hashes as(
  select recorded.occurred_at,previous.record_hash previous_hash,
    encode(public.digest('publication:zhudatuan:sandbox:v1:release:zhudatuan:sandbox:v1:active','sha256'),'hex') after_hash
  from recorded left join previous on true
)
insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
  previous_hash,record_hash,recorded_at)
select 'audit:zhudatuan:sandbox-publication:v1','mall-zhudatuan','sandbox-bootstrap','migration','experience.sandbox.published',
  'experience.publication','publication:zhudatuan:sandbox:v1',null,hashes.after_hash,
  jsonb_build_object('bootstrap','zhudatuan-sandbox-publication-v1','sandboxOnly',true,'productionData',false,
    'application','application:zhudatuan:sandbox:v1','release','release:zhudatuan:sandbox:v1',
    'publication','publication:zhudatuan:sandbox:v1','state','active','objectRef','sandbox-only',
    'financeMutation',false,'paymentMutation',false,'orderMutation',false),
  'bootstrap:zhudatuan-sandbox-publication-v1',hashes.previous_hash,
  encode(public.digest('audit:zhudatuan:sandbox-publication:v1:'||coalesce(hashes.previous_hash,'')||':'||hashes.after_hash||':'||hashes.occurred_at::text,
    'sha256'),'hex'),hashes.occurred_at
from hashes where not exists(select 1 from audit.record where id='audit:zhudatuan:sandbox-publication:v1');

do $assert$
begin
  if not exists(select 1 from experience.application
    where id='application:zhudatuan:sandbox:v1' and scope_id='mall-zhudatuan' and code='ZHUDATUAN_SANDBOX'
      and public_slug='zhudatuan-sandbox' and name='主打团 Sandbox 商城' and status='active'
      and head_version_id='version:zhudatuan:sandbox:v1' and version=1) then
    raise exception 'SANDBOX_CATALOG_APPLICATION_CONFLICT';
  end if;
  if not exists(select 1 from experience.version
    where id='version:zhudatuan:sandbox:v1' and application_id='application:zhudatuan:sandbox:v1'
      and sequence=1 and schema_version='2' and validation_state='valid' and created_by='sandbox-bootstrap'
      and configuration_hash=encode(public.digest(configuration::text,'sha256'),'hex')) then
    raise exception 'SANDBOX_CATALOG_VERSION_CONFLICT';
  end if;
  if not exists(select 1 from experience.binding
    where application_id='application:zhudatuan:sandbox:v1' and domain='sandbox.zhudatuan.invalid'
      and mall_id='mall-zhudatuan' and pool_id='pool:zhudatuan:sandbox') then
    raise exception 'SANDBOX_CATALOG_BINDING_CONFLICT';
  end if;
  if not exists(select 1 from experience.release
      where id='release:zhudatuan:sandbox:v1' and application_id='application:zhudatuan:sandbox:v1'
        and version_id='version:zhudatuan:sandbox:v1' and state='active' and retired_at is null
        and published_by='sandbox-bootstrap')
    or not exists(select 1 from experience.publication publication join experience.version version
      on version.id=publication.version_id
      where publication.id='publication:zhudatuan:sandbox:v1' and publication.release_id='release:zhudatuan:sandbox:v1'
        and publication.application_id='application:zhudatuan:sandbox:v1' and publication.state='active'
        and publication.content_hash=version.configuration_hash and publication.object_hash=publication.content_hash
        and publication.object_ref like 'sandbox://%' and publication.published_at is not null) then
    raise exception 'SANDBOX_CATALOG_PUBLICATION_CONFLICT';
  end if;
  if not exists(select 1 from catalog.product
    where id='product:zhudatuan:sandbox:welcome' and category_id='category:zhudatuan:sandbox'
      and owner_partner_id is null and brand_id is null and product_type='physical' and status='active'
      and attributes->>'sandbox'='true')
    or not exists(select 1 from catalog.sku
      where id='sku:zhudatuan:sandbox:welcome' and product_id='product:zhudatuan:sandbox:welcome'
        and code='ZHUDATUAN-SANDBOX-WELCOME' and status='active')
    or not exists(select 1 from catalog.pool
      where id='pool:zhudatuan:sandbox' and scope_id='mall-zhudatuan' and kind='private' and status='active')
    or not exists(select 1 from catalog.poolitem
      where pool_id='pool:zhudatuan:sandbox' and sku_id='sku:zhudatuan:sandbox:welcome'
        and state='included' and source_version='sandbox:v1')
    or not exists(select 1 from catalog.poolbinding
      where mall_id='mall-zhudatuan' and pool_id='pool:zhudatuan:sandbox' and listing_kind='selected' and status='active')
    or not exists(select 1 from catalog.listing
      where id='listing:zhudatuan:sandbox:welcome' and scope_id='mall-zhudatuan'
        and pool_id='pool:zhudatuan:sandbox' and sku_id='sku:zhudatuan:sandbox:welcome' and status='published') then
    raise exception 'SANDBOX_CATALOG_PRODUCT_CONFLICT';
  end if;
  if not exists(select 1 from pricing.pricebook
      where id='pricebook:zhudatuan:sandbox' and scope_id='mall-zhudatuan' and currency='CNY' and status='active')
    or not exists(select 1 from pricing.price
      where id='price:zhudatuan:sandbox:welcome' and book_id='pricebook:zhudatuan:sandbox'
        and sku_id='sku:zhudatuan:sandbox:welcome' and amount_minor=100 and compare_minor=100)
    or not exists(select 1 from inventory.stockitem
      where id='stock:zhudatuan:sandbox:welcome' and scope_id='mall-zhudatuan'
        and sku_id='sku:zhudatuan:sandbox:welcome' and location_id='sandbox:main'
        and onhand=100 and safety=0 and status='active') then
    raise exception 'SANDBOX_CATALOG_OFFER_CONFLICT';
  end if;
  if (select count(*) from audit.record where id='audit:zhudatuan:sandbox-catalog:v1'
      and scope_id='mall-zhudatuan' and actor_id='sandbox-bootstrap' and action='catalog.sandbox.bootstrapped'
      and resource_id='application:zhudatuan:sandbox:v1' and evidence->>'sandboxOnly'='true'
      and evidence->>'productionData'='false' and evidence->>'financeMutation'='false'
      and evidence->>'paymentMutation'='false' and evidence->>'orderMutation'='false')<>1 then
    raise exception 'SANDBOX_CATALOG_AUDIT_CONFLICT';
  end if;
  if (select count(*) from audit.record where id='audit:zhudatuan:sandbox-publication:v1'
      and scope_id='mall-zhudatuan' and actor_id='sandbox-bootstrap' and action='experience.sandbox.published'
      and resource_id='publication:zhudatuan:sandbox:v1' and evidence->>'sandboxOnly'='true'
      and evidence->>'productionData'='false' and evidence->>'financeMutation'='false'
      and evidence->>'paymentMutation'='false' and evidence->>'orderMutation'='false')<>1 then
    raise exception 'SANDBOX_PUBLICATION_AUDIT_CONFLICT';
  end if;
end
$assert$;
