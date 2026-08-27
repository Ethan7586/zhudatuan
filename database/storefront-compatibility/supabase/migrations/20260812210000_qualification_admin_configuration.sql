-- Administrator write model for commercial resources and employee qualification.
-- Drafts are mall-owned, mutations are optimistic, and every change is audited.

alter table public.catalog_pools add column if not exists version bigint not null default 1 check (version > 0);
alter table public.city_zones add column if not exists mall_id text references public.malls(id) on delete cascade;
alter table public.city_zones add column if not exists version bigint not null default 1 check (version > 0);
alter table public.entitlement_policies add column if not exists mall_id text references public.malls(id) on delete cascade;
alter table public.purchase_limit_templates add column if not exists mall_id text references public.malls(id) on delete cascade;
alter table public.mall_supplier_agreements add column if not exists version bigint not null default 1 check (version > 0);
alter table public.brands add column if not exists version bigint not null default 1 check (version > 0);
alter table public.stores add column if not exists version bigint not null default 1 check (version > 0);

create index if not exists city_zones_mall_lookup on public.city_zones (tenant_id, mall_id, status, updated_at desc);
create index if not exists entitlement_policies_mall_lookup on public.entitlement_policies (tenant_id, mall_id, status, updated_at desc);
create index if not exists purchase_limit_templates_mall_lookup on public.purchase_limit_templates (tenant_id, mall_id, status, updated_at desc);

create or replace function public.api_apply_qualification_config(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_actor_user_id text,
  p_actor_membership_id text,
  p_kind text,
  p_entity_id text,
  p_expected_version bigint,
  p_payload jsonb,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_existing_version bigint;
  v_previous jsonb;
  v_after jsonb;
  v_now timestamptz := now();
  v_status text;
  v_count integer;
  v_existing_idempotency public.idempotency_keys%rowtype;
  v_response jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 or length(p_reason) > 500 then raise exception 'QUALIFICATION_CHANGE_REASON_REQUIRED'; end if;
  if p_kind not in ('catalog_pool','city_zone','entitlement_policy','purchase_limit','supplier_agreement','brand','store') then
    raise exception 'QUALIFICATION_CONFIG_KIND_INVALID';
  end if;
  if length(trim(coalesce(p_idempotency_key,''))) < 8 or length(p_idempotency_key) > 120
    or length(trim(coalesce(p_request_hash,''))) < 16 then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  if not exists (
    select 1 from public.memberships membership
    join public.users actor on actor.id = membership.context_user_id
    where membership.id = p_actor_membership_id and membership.context_user_id = p_actor_user_id
      and membership.tenant_id = p_tenant_id and membership.enterprise_id = p_enterprise_id
      and membership.mall_id = p_mall_id and membership.target = 'admin' and membership.status = 'active'
      and actor.status = 'active'
      and (membership.expires_at is null or membership.expires_at > v_now)
  ) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_mall_id||':qualification:config:'||p_idempotency_key,0));
  select * into v_existing_idempotency from public.idempotency_keys
  where mall_id=p_mall_id and scope='qualification:config' and idempotency_key=p_idempotency_key and expires_at>v_now;
  if found then
    if v_existing_idempotency.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing_idempotency.response_json;
  end if;

  v_id := nullif(trim(coalesce(p_entity_id, '')), '');
  v_status := trim(coalesce(p_payload ->> 'status', 'draft'));
  if v_status not in ('draft','active','disabled') then raise exception 'QUALIFICATION_STATUS_INVALID'; end if;

  if p_kind = 'catalog_pool' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or p_payload ->> 'poolKind' not in ('selected','combined')
      or jsonb_typeof(p_payload -> 'skuIds') is distinct from 'array'
      or jsonb_array_length(p_payload -> 'skuIds') > 500 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if v_status = 'active' and jsonb_array_length(p_payload -> 'skuIds') = 0 then raise exception 'QUALIFICATION_ACTIVE_RESOURCE_EMPTY'; end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_payload -> 'skuIds') requested(id)
      where not exists (select 1 from public.skus sku where sku.id = requested.id and sku.tenant_id = p_tenant_id and sku.mall_id = p_mall_id)
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;

    if v_id is null then
      v_id := 'pool-' || gen_random_uuid()::text;
      if coalesce(p_expected_version, 0) <> 0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.catalog_pools (id,tenant_id,owner_kind,owner_id,code,name,pool_kind,status,version,updated_at)
      values (v_id,p_tenant_id,'mall',p_mall_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'poolKind',v_status,1,v_now);
      v_existing_version := 1;
    else
      select version, to_jsonb(pool) into v_existing_version, v_previous from public.catalog_pools pool
      where pool.id = v_id and pool.tenant_id = p_tenant_id and pool.owner_kind = 'mall' and pool.owner_id = p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version <> v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.catalog_pools set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),pool_kind=p_payload ->> 'poolKind',status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version := v_existing_version + 1;
    end if;
    delete from public.catalog_pool_items where pool_id = v_id;
    insert into public.catalog_pool_items(pool_id,tenant_id,sku_id,status)
    select v_id,p_tenant_id,id,'active' from (select distinct value as id from jsonb_array_elements_text(p_payload -> 'skuIds')) requested;
    insert into public.mall_catalog_pool_bindings(mall_id,pool_id,tenant_id,listing_kind,status)
    values(p_mall_id,v_id,p_tenant_id,p_payload ->> 'poolKind',case when v_status='active' then 'active' else 'disabled' end)
    on conflict (mall_id,pool_id) do update set listing_kind=excluded.listing_kind,status=excluded.status;

  elsif p_kind = 'city_zone' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or p_payload ->> 'appliesTo' not in ('visible','purchasable','both')
      or jsonb_typeof(p_payload -> 'cities') is distinct from 'array' or jsonb_array_length(p_payload -> 'cities') > 500
      or jsonb_typeof(p_payload -> 'resources') is distinct from 'array' or jsonb_array_length(p_payload -> 'resources') > 500 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if v_status = 'active' and (jsonb_array_length(p_payload -> 'cities') = 0 or jsonb_array_length(p_payload -> 'resources') = 0) then raise exception 'QUALIFICATION_ACTIVE_RESOURCE_EMPTY'; end if;
    if exists (select 1 from jsonb_array_elements(p_payload -> 'cities') city where length(trim(coalesce(city ->> 'code',''))) < 2 or length(trim(coalesce(city ->> 'name',''))) < 2)
      or exists (select 1 from jsonb_array_elements(p_payload -> 'resources') resource where resource ->> 'kind' not in ('product','sku')) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'resources') resource
      where (resource ->> 'kind'='product' and not exists(select 1 from public.products product where product.id=resource ->> 'id' and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id))
         or (resource ->> 'kind'='sku' and not exists(select 1 from public.skus sku where sku.id=resource ->> 'id' and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id))
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;

    if v_id is null then
      v_id := 'zone-' || gen_random_uuid()::text;
      if coalesce(p_expected_version, 0) <> 0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.city_zones(id,tenant_id,mall_id,code,name,applies_to,status,version,updated_at)
      values(v_id,p_tenant_id,p_mall_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'appliesTo',v_status,1,v_now);
      v_existing_version := 1;
    else
      select version,to_jsonb(zone) into v_existing_version,v_previous from public.city_zones zone where zone.id=v_id and zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.city_zones set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),applies_to=p_payload ->> 'appliesTo',status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version := v_existing_version+1;
    end if;
    delete from public.city_zone_cities where zone_id=v_id;
    insert into public.city_zone_cities(zone_id,city_code,city_name,city_key)
    select distinct on (city_key) v_id,city_code,city_name,city_key from (
      select trim(city ->> 'code') city_code,trim(city ->> 'name') city_name,
        lower(regexp_replace(regexp_replace(trim(city ->> 'name'),'[[:space:]]+','','g'),'市$','')) city_key
      from jsonb_array_elements(p_payload -> 'cities') city
    ) normalized order by city_key,city_code;
    delete from public.city_zone_catalog_items where zone_id=v_id;
    insert into public.city_zone_catalog_items(zone_id,tenant_id,product_id,sku_id)
    select distinct v_id,p_tenant_id,case when resource ->> 'kind'='product' then resource ->> 'id' end,case when resource ->> 'kind'='sku' then resource ->> 'id' end
    from jsonb_array_elements(p_payload -> 'resources') resource;

  elsif p_kind = 'entitlement_policy' then
    if length(trim(coalesce(p_payload ->> 'name',''))) < 2 or p_payload ->> 'action' not in ('visible','purchasable')
      or p_payload ->> 'effect' not in ('allow','deny') or coalesce(p_payload ->> 'priority','') !~ '^[0-9]{1,5}$'
      or (p_payload ->> 'priority')::integer > 10000 or jsonb_typeof(p_payload -> 'subjects') is distinct from 'array'
      or jsonb_typeof(p_payload -> 'resources') is distinct from 'array' or jsonb_array_length(p_payload -> 'subjects') > 200
      or jsonb_array_length(p_payload -> 'resources') > 500 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if jsonb_array_length(p_payload -> 'subjects')=0 or jsonb_array_length(p_payload -> 'resources')=0 then raise exception 'QUALIFICATION_ACTIVE_RESOURCE_EMPTY'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload -> 'subjects') item where item ->> 'kind' not in ('all','enterprise','department','user','membership','tag') or length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*')))
      or exists(select 1 from jsonb_array_elements(p_payload -> 'resources') item where item ->> 'kind' not in ('all','catalog_pool','product','sku','city_zone') or length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*'))) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'resources') resource
      where (resource ->> 'kind'='catalog_pool' and not exists(select 1 from public.catalog_pools pool where pool.id=resource ->> 'id' and pool.tenant_id=p_tenant_id and pool.owner_kind='mall' and pool.owner_id=p_mall_id))
         or (resource ->> 'kind'='product' and not exists(select 1 from public.products product where product.id=resource ->> 'id' and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id))
         or (resource ->> 'kind'='sku' and not exists(select 1 from public.skus sku where sku.id=resource ->> 'id' and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id))
         or (resource ->> 'kind'='city_zone' and not exists(select 1 from public.city_zones zone where zone.id=resource ->> 'id' and zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id))
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'policy-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.entitlement_policies(id,tenant_id,mall_id,name,action,effect,priority,reason_code,status,version,created_by_membership_id,updated_by_membership_id,updated_at)
      values(v_id,p_tenant_id,p_mall_id,trim(p_payload ->> 'name'),p_payload ->> 'action',p_payload ->> 'effect',(p_payload ->> 'priority')::integer,coalesce(nullif(trim(p_payload ->> 'reasonCode'),''),'POLICY_RULE'),v_status,1,p_actor_membership_id,p_actor_membership_id,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(policy) into v_existing_version,v_previous from public.entitlement_policies policy where policy.id=v_id and policy.tenant_id=p_tenant_id and policy.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.entitlement_policies set name=trim(p_payload ->> 'name'),action=p_payload ->> 'action',effect=p_payload ->> 'effect',priority=(p_payload ->> 'priority')::integer,reason_code=coalesce(nullif(trim(p_payload ->> 'reasonCode'),''),'POLICY_RULE'),status=v_status,version=version+1,updated_by_membership_id=p_actor_membership_id,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.entitlement_policy_subjects where policy_id=v_id;
    insert into public.entitlement_policy_subjects(policy_id,subject_kind,subject_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'subjects') item;
    delete from public.entitlement_policy_resources where policy_id=v_id;
    insert into public.entitlement_policy_resources(policy_id,resource_kind,resource_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'resources') item;

  elsif p_kind = 'purchase_limit' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2 or p_payload ->> 'countScope' not in ('sku','product')
      or jsonb_typeof(p_payload -> 'subjects') is distinct from 'array' or jsonb_typeof(p_payload -> 'resources') is distinct from 'array'
      or jsonb_array_length(p_payload -> 'subjects')=0 or jsonb_array_length(p_payload -> 'resources')=0 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if not exists (
      select 1 from jsonb_each_text(p_payload) pair
      where pair.key in ('maxPerOrderQty','maxDailyQty','maxMonthlyQty','maxLifetimeQty','maxPerOrderAmountCents','maxDailyAmountCents','maxMonthlyAmountCents','maxLifetimeAmountCents')
        and nullif(pair.value,'') is not null and pair.value ~ '^[1-9][0-9]{0,11}$'
    ) then raise exception 'QUALIFICATION_LIMIT_REQUIRED'; end if;
    if exists (
      select 1 from jsonb_each_text(p_payload) pair
      where pair.key in ('maxPerOrderQty','maxDailyQty','maxMonthlyQty','maxLifetimeQty','maxPerOrderAmountCents','maxDailyAmountCents','maxMonthlyAmountCents','maxLifetimeAmountCents')
        and nullif(pair.value,'') is not null and pair.value !~ '^[1-9][0-9]{0,11}$'
    ) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload -> 'subjects') item where item ->> 'kind' not in ('all','enterprise','department','user','membership','tag') or length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*')))
      or exists(select 1 from jsonb_array_elements(p_payload -> 'resources') item where length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*'))) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'resources') resource
      where resource ->> 'kind' not in ('all','catalog_pool','product','sku','city_zone')
         or (resource ->> 'kind'='catalog_pool' and not exists(select 1 from public.catalog_pools pool where pool.id=resource ->> 'id' and pool.tenant_id=p_tenant_id and pool.owner_kind='mall' and pool.owner_id=p_mall_id))
         or (resource ->> 'kind'='product' and not exists(select 1 from public.products product where product.id=resource ->> 'id' and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id))
         or (resource ->> 'kind'='sku' and not exists(select 1 from public.skus sku where sku.id=resource ->> 'id' and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id))
         or (resource ->> 'kind'='city_zone' and not exists(select 1 from public.city_zones zone where zone.id=resource ->> 'id' and zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id))
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'limit-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.purchase_limit_templates(id,tenant_id,mall_id,code,name,count_scope,max_per_order_qty,max_daily_qty,max_monthly_qty,max_lifetime_qty,max_per_order_amount_cents,max_daily_amount_cents,max_monthly_amount_cents,max_lifetime_amount_cents,status,version,updated_at)
      values(v_id,p_tenant_id,p_mall_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'countScope',nullif(p_payload ->> 'maxPerOrderQty','')::integer,nullif(p_payload ->> 'maxDailyQty','')::integer,nullif(p_payload ->> 'maxMonthlyQty','')::integer,nullif(p_payload ->> 'maxLifetimeQty','')::integer,nullif(p_payload ->> 'maxPerOrderAmountCents','')::bigint,nullif(p_payload ->> 'maxDailyAmountCents','')::bigint,nullif(p_payload ->> 'maxMonthlyAmountCents','')::bigint,nullif(p_payload ->> 'maxLifetimeAmountCents','')::bigint,v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(template) into v_existing_version,v_previous from public.purchase_limit_templates template where template.id=v_id and template.tenant_id=p_tenant_id and template.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.purchase_limit_templates set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),count_scope=p_payload ->> 'countScope',max_per_order_qty=nullif(p_payload ->> 'maxPerOrderQty','')::integer,max_daily_qty=nullif(p_payload ->> 'maxDailyQty','')::integer,max_monthly_qty=nullif(p_payload ->> 'maxMonthlyQty','')::integer,max_lifetime_qty=nullif(p_payload ->> 'maxLifetimeQty','')::integer,max_per_order_amount_cents=nullif(p_payload ->> 'maxPerOrderAmountCents','')::bigint,max_daily_amount_cents=nullif(p_payload ->> 'maxDailyAmountCents','')::bigint,max_monthly_amount_cents=nullif(p_payload ->> 'maxMonthlyAmountCents','')::bigint,max_lifetime_amount_cents=nullif(p_payload ->> 'maxLifetimeAmountCents','')::bigint,status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.purchase_limit_subjects where template_id=v_id;
    insert into public.purchase_limit_subjects(template_id,subject_kind,subject_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'subjects') item;
    delete from public.purchase_limit_resources where template_id=v_id;
    insert into public.purchase_limit_resources(template_id,resource_kind,resource_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'resources') item;

  elsif p_kind = 'supplier_agreement' then
    if length(trim(coalesce(p_payload ->> 'agreementCode',''))) < 2 or length(trim(coalesce(p_payload ->> 'supplierId',''))) < 2 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if not exists(select 1 from public.suppliers supplier where supplier.id=p_payload ->> 'supplierId' and supplier.tenant_id=p_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'agreement-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.mall_supplier_agreements(id,tenant_id,mall_id,supplier_id,agreement_code,settlement_mode,status,version,updated_at)
      values(v_id,p_tenant_id,p_mall_id,p_payload ->> 'supplierId',trim(p_payload ->> 'agreementCode'),coalesce(nullif(trim(p_payload ->> 'settlementMode'),''),'manual'),v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(agreement) into v_existing_version,v_previous from public.mall_supplier_agreements agreement where agreement.id=v_id and agreement.tenant_id=p_tenant_id and agreement.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.mall_supplier_agreements set supplier_id=p_payload ->> 'supplierId',agreement_code=trim(p_payload ->> 'agreementCode'),settlement_mode=coalesce(nullif(trim(p_payload ->> 'settlementMode'),''),'manual'),status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;

  elsif p_kind = 'brand' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$' or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or jsonb_typeof(p_payload -> 'supplierIds') is distinct from 'array'
      or jsonb_typeof(p_payload -> 'productIds') is distinct from 'array'
      or jsonb_typeof(p_payload -> 'authorizedInMall') is distinct from 'boolean' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload -> 'supplierIds') supplier_id where not exists(select 1 from public.suppliers supplier where supplier.id=supplier_id and supplier.tenant_id=p_tenant_id)) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload -> 'productIds') product_id where not exists(select 1 from public.products product where product.id=product_id and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id)) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'brand-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.brands(id,tenant_id,code,name,status,version,updated_at) values(v_id,p_tenant_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(brand) into v_existing_version,v_previous from public.brands brand where brand.id=v_id and brand.tenant_id=p_tenant_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.brands set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.supplier_brand_bindings where brand_id=v_id;
    insert into public.supplier_brand_bindings(tenant_id,supplier_id,brand_id,relationship_kind,status)
    select p_tenant_id,supplier.value,v_id,'authorized',case when v_status='active' then 'active' else 'disabled' end
    from jsonb_array_elements_text(p_payload -> 'supplierIds') supplier(value);
    if coalesce((p_payload ->> 'authorizedInMall')::boolean,false) then
      insert into public.mall_brand_authorizations(id,tenant_id,mall_id,brand_id,status)
      values('brand-auth-'||p_mall_id||'-'||v_id,p_tenant_id,p_mall_id,v_id,case when v_status='active' then 'active' else 'disabled' end)
      on conflict(mall_id,brand_id) do update set status=excluded.status,updated_at=v_now;
    else
      delete from public.mall_brand_authorizations where mall_id=p_mall_id and brand_id=v_id;
    end if;
    update public.products set brand_id=null,updated_at=v_now where tenant_id=p_tenant_id and mall_id=p_mall_id and brand_id=v_id
      and id not in (select value from jsonb_array_elements_text(p_payload -> 'productIds'));
    update public.products set brand_id=v_id,updated_at=v_now where tenant_id=p_tenant_id and mall_id=p_mall_id
      and id in (select value from jsonb_array_elements_text(p_payload -> 'productIds'));

  else
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or p_payload ->> 'storeType' not in ('online','offline','hybrid')
      or jsonb_typeof(p_payload -> 'brandIds') is distinct from 'array' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload -> 'brandIds') brand_id where not exists(select 1 from public.brands brand where brand.id=brand_id and brand.tenant_id=p_tenant_id)) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id:='store-'||gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.stores(id,tenant_id,code,name,store_type,province_code,city_code,address_text,status,version,updated_at)
      values(v_id,p_tenant_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'storeType',nullif(trim(p_payload ->> 'provinceCode'),''),nullif(trim(p_payload ->> 'cityCode'),''),nullif(trim(p_payload ->> 'addressText'),''),v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(store_row) into v_existing_version,v_previous from public.stores store_row where store_row.id=v_id and store_row.tenant_id=p_tenant_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.stores set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),store_type=p_payload ->> 'storeType',province_code=nullif(trim(p_payload ->> 'provinceCode'),''),city_code=nullif(trim(p_payload ->> 'cityCode'),''),address_text=nullif(trim(p_payload ->> 'addressText'),''),status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.brand_store_bindings where store_id=v_id;
    insert into public.brand_store_bindings(tenant_id,brand_id,store_id,relationship_kind,status)
    select p_tenant_id,brand.value,v_id,'authorized',case when v_status='active' then 'active' else 'disabled' end
    from (select distinct value from jsonb_array_elements_text(p_payload -> 'brandIds')) brand;
  end if;

  execute format('select to_jsonb(row_value) from public.%I row_value where id=$1', case p_kind when 'catalog_pool' then 'catalog_pools' when 'city_zone' then 'city_zones' when 'entitlement_policy' then 'entitlement_policies' when 'purchase_limit' then 'purchase_limit_templates' when 'supplier_agreement' then 'mall_supplier_agreements' when 'brand' then 'brands' else 'stores' end)
  into v_after using v_id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.'||p_kind||'.save',p_kind,v_id,p_request_id,left(coalesce(p_user_agent,''),300),v_previous,v_after||jsonb_build_object('changeReason',trim(p_reason),'config',p_payload),p_actor_membership_id,p_granted_via,v_now);
  v_response:=jsonb_build_object('kind',p_kind,'id',v_id,'version',v_existing_version,'status',v_status,'updatedAt',v_now);
  insert into public.idempotency_keys(tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,created_at,expires_at)
  values(p_tenant_id,p_mall_id,'qualification:config',p_idempotency_key,p_request_hash,v_id,v_response,v_now,v_now+interval '24 hours');
  return v_response;
exception when unique_violation then
  raise exception 'QUALIFICATION_CODE_CONFLICT';
end;
$$;

create or replace function public.api_qualification_center(p_tenant_id text,p_mall_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
select jsonb_build_object(
  'catalogPools',coalesce((select jsonb_agg(jsonb_build_object('id',pool.id,'code',pool.code,'name',pool.name,'kind',pool.pool_kind,'status',pool.status,'version',pool.version,'skuIds',coalesce((select jsonb_agg(item.sku_id order by item.sku_id) from public.catalog_pool_items item where item.pool_id=pool.id),'[]'::jsonb),'itemCount',(select count(*) from public.catalog_pool_items item where item.pool_id=pool.id and item.status='active')) order by pool.updated_at desc) from public.catalog_pools pool where pool.tenant_id=p_tenant_id and pool.owner_kind='mall' and pool.owner_id=p_mall_id),'[]'::jsonb),
  'cityZones',coalesce((select jsonb_agg(jsonb_build_object('id',zone.id,'code',zone.code,'name',zone.name,'appliesTo',zone.applies_to,'status',zone.status,'version',zone.version,'cities',coalesce((select jsonb_agg(jsonb_build_object('code',city.city_code,'name',city.city_name) order by city.city_name) from public.city_zone_cities city where city.zone_id=zone.id),'[]'::jsonb),'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',case when item.sku_id is not null then 'sku' else 'product' end,'id',coalesce(item.sku_id,item.product_id))) from public.city_zone_catalog_items item where item.zone_id=zone.id),'[]'::jsonb),'cityCount',(select count(*) from public.city_zone_cities city where city.zone_id=zone.id),'itemCount',(select count(*) from public.city_zone_catalog_items item where item.zone_id=zone.id)) order by zone.updated_at desc) from public.city_zones zone where zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id),'[]'::jsonb),
  'policies',coalesce((select jsonb_agg(jsonb_build_object('id',policy.id,'name',policy.name,'action',policy.action,'effect',policy.effect,'priority',policy.priority,'reasonCode',policy.reason_code,'status',policy.status,'version',policy.version,'subjects',coalesce((select jsonb_agg(jsonb_build_object('kind',subject.subject_kind,'id',subject.subject_id)) from public.entitlement_policy_subjects subject where subject.policy_id=policy.id),'[]'::jsonb),'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',resource.resource_kind,'id',resource.resource_id)) from public.entitlement_policy_resources resource where resource.policy_id=policy.id),'[]'::jsonb),'subjectCount',(select count(*) from public.entitlement_policy_subjects subject where subject.policy_id=policy.id),'resourceCount',(select count(*) from public.entitlement_policy_resources resource where resource.policy_id=policy.id)) order by policy.priority desc,policy.updated_at desc) from public.entitlement_policies policy where policy.tenant_id=p_tenant_id and policy.mall_id=p_mall_id),'[]'::jsonb),
  'limitTemplates',coalesce((select jsonb_agg(jsonb_build_object('id',template.id,'code',template.code,'name',template.name,'countScope',template.count_scope,'status',template.status,'version',template.version,'maxPerOrderQty',template.max_per_order_qty,'maxDailyQty',template.max_daily_qty,'maxMonthlyQty',template.max_monthly_qty,'maxLifetimeQty',template.max_lifetime_qty,'maxPerOrderAmountCents',template.max_per_order_amount_cents,'maxDailyAmountCents',template.max_daily_amount_cents,'maxMonthlyAmountCents',template.max_monthly_amount_cents,'maxLifetimeAmountCents',template.max_lifetime_amount_cents,'subjects',coalesce((select jsonb_agg(jsonb_build_object('kind',subject.subject_kind,'id',subject.subject_id)) from public.purchase_limit_subjects subject where subject.template_id=template.id),'[]'::jsonb),'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',resource.resource_kind,'id',resource.resource_id)) from public.purchase_limit_resources resource where resource.template_id=template.id),'[]'::jsonb)) order by template.updated_at desc) from public.purchase_limit_templates template where template.tenant_id=p_tenant_id and template.mall_id=p_mall_id),'[]'::jsonb),
  'commercialResources',jsonb_build_object(
    'agreements',coalesce((select jsonb_agg(jsonb_build_object('id',agreement.id,'supplierId',agreement.supplier_id,'agreementCode',agreement.agreement_code,'settlementMode',agreement.settlement_mode,'status',agreement.status,'version',agreement.version) order by agreement.updated_at desc) from public.mall_supplier_agreements agreement where agreement.tenant_id=p_tenant_id and agreement.mall_id=p_mall_id),'[]'::jsonb),
    'brands',coalesce((select jsonb_agg(jsonb_build_object('id',brand.id,'code',brand.code,'name',brand.name,'status',brand.status,'version',brand.version,'supplierIds',coalesce((select jsonb_agg(binding.supplier_id) from public.supplier_brand_bindings binding where binding.brand_id=brand.id),'[]'::jsonb),'productIds',coalesce((select jsonb_agg(product.id) from public.products product where product.mall_id=p_mall_id and product.brand_id=brand.id),'[]'::jsonb),'authorizedInMall',exists(select 1 from public.mall_brand_authorizations auth where auth.mall_id=p_mall_id and auth.brand_id=brand.id and auth.status='active')) order by brand.updated_at desc) from public.brands brand where brand.tenant_id=p_tenant_id),'[]'::jsonb),
    'stores',coalesce((select jsonb_agg(jsonb_build_object('id',store_row.id,'code',store_row.code,'name',store_row.name,'storeType',store_row.store_type,'provinceCode',store_row.province_code,'cityCode',store_row.city_code,'addressText',store_row.address_text,'status',store_row.status,'version',store_row.version,'brandIds',coalesce((select jsonb_agg(binding.brand_id) from public.brand_store_bindings binding where binding.store_id=store_row.id),'[]'::jsonb)) order by store_row.updated_at desc) from public.stores store_row where store_row.tenant_id=p_tenant_id),'[]'::jsonb)
  ),
  'selectors',jsonb_build_object(
    'enterprises',coalesce((select jsonb_agg(jsonb_build_object('id',enterprise.id,'name',enterprise.name)) from public.malls mall join public.enterprises enterprise on enterprise.id=mall.enterprise_id where mall.id=p_mall_id and mall.tenant_id=p_tenant_id),'[]'::jsonb),
    'suppliers',coalesce((select jsonb_agg(jsonb_build_object('id',supplier.id,'name',supplier.name) order by supplier.name) from public.suppliers supplier where supplier.tenant_id=p_tenant_id and supplier.status='active'),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',product.id,'name',product.name) order by product.name) from public.products product where product.tenant_id=p_tenant_id and product.mall_id=p_mall_id),'[]'::jsonb),
    'skus',coalesce((select jsonb_agg(jsonb_build_object('id',sku.id,'name',product.name||' · '||sku.sku_code,'productId',product.id) order by product.name,sku.sku_code) from public.skus sku join public.products product on product.id=sku.product_id where sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id),'[]'::jsonb),
    'departments',coalesce((select jsonb_agg(jsonb_build_object('id',department.id,'name',department.name) order by department.name) from public.departments department where department.tenant_id=p_tenant_id),'[]'::jsonb),
    'users',coalesce((select jsonb_agg(jsonb_build_object('id',user_row.id,'name',user_row.display_name||' · '||user_row.employee_no) order by user_row.display_name) from public.users user_row where user_row.tenant_id=p_tenant_id and user_row.status='active'),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',membership.id,'name',user_row.display_name||' · '||membership.target) order by user_row.display_name) from public.memberships membership join public.users user_row on user_row.id=membership.context_user_id where membership.tenant_id=p_tenant_id and membership.enterprise_id=(select enterprise_id from public.malls where id=p_mall_id) and membership.status='active'),'[]'::jsonb)
  ),
  'commercialSummary',jsonb_build_object('brands',(select count(*) from public.brands where tenant_id=p_tenant_id),'stores',(select count(*) from public.stores where tenant_id=p_tenant_id),'supplierAgreements',(select count(*) from public.mall_supplier_agreements where tenant_id=p_tenant_id and mall_id=p_mall_id and status='active'),'brandAuthorizations',(select count(*) from public.mall_brand_authorizations where tenant_id=p_tenant_id and mall_id=p_mall_id and status='active'))
);
$$;

revoke all on function public.api_apply_qualification_config(text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_apply_qualification_config(text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb) to service_role;
