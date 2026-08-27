-- Mall application schema version 2. The existing application head/version
-- tables remain the only storefront authority; version 1 is read through a
-- deterministic projector and every new snapshot is version 2.

create or replace function public.api_mall_application_component_registry()
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'schemaVersion',2,
    'pageTypes',jsonb_build_array('home','micro_page','topic'),
    'componentTypes',jsonb_build_array(
      jsonb_build_object('type','hero','label','主视觉','maximum',4),
      jsonb_build_object('type','notice','label','公告','maximum',6),
      jsonb_build_object('type','shortcut','label','快捷入口','maximum',4),
      jsonb_build_object('type','product_collection','label','商品集合','maximum',16),
      jsonb_build_object('type','rich_text','label','富文本','maximum',8)
    ),
    'actionTypes',jsonb_build_array(
      'none','link','product','category','collection','exchangeable_product','micro_page','marketing_activity'
    ),
    'limits',jsonb_build_object('pages',20,'blocksPerPage',30,'shortcutItems',8)
  );
$$;

create or replace function public.api_mall_application_bounded_text_is_valid(
  p_value jsonb,p_minimum integer,p_maximum integer
) returns boolean language sql immutable set search_path=public,pg_temp as $$
  select coalesce(
    jsonb_typeof(p_value)='string'
    and char_length(trim(p_value#>>'{}')) between p_minimum and p_maximum,
    false
  );
$$;

create or replace function public.api_mall_application_action_v2_is_valid(p_action jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare v_type text; v_target text; v_url text;
begin
  if jsonb_typeof(p_action) is distinct from 'object'
     or jsonb_typeof(p_action->'type') is distinct from 'string'
  then return false; end if;
  v_type:=p_action->>'type';
  if v_type='none' then
    return p_action ?& array['type'] and not exists(
      select 1 from jsonb_object_keys(p_action) key where key<>all(array['type'])
    );
  elsif v_type='link' then
    v_url:=p_action->>'url';
    return p_action ?& array['type','url']
      and not exists(select 1 from jsonb_object_keys(p_action) key where key<>all(array['type','url']))
      and public.api_mall_application_bounded_text_is_valid(p_action->'url',2,500)
      and (
        v_url ~ '^https://[^[:space:]]+$'
        or (v_url ~ '^/[A-Za-z0-9][A-Za-z0-9_/?=&%#.-]*$' and v_url !~ '^//')
      );
  elsif v_type in ('product','category','collection','exchangeable_product','micro_page','marketing_activity') then
    v_target:=p_action->>'targetId';
    return p_action ?& array['type','targetId']
      and not exists(select 1 from jsonb_object_keys(p_action) key where key<>all(array['type','targetId']))
      and public.api_mall_application_bounded_text_is_valid(p_action->'targetId',1,180)
      and v_target ~ '^[A-Za-z0-9][A-Za-z0-9:_-]*$';
  end if;
  return false;
end;
$$;

create or replace function public.api_mall_application_block_v2_is_valid(p_block jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare v_type text; v_item jsonb;
begin
  if jsonb_typeof(p_block) is distinct from 'object'
     or jsonb_typeof(p_block->'visible') is distinct from 'boolean'
     or jsonb_typeof(p_block->'id') is distinct from 'string'
     or jsonb_typeof(p_block->'type') is distinct from 'string'
     or coalesce(p_block->>'id','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'
  then return false; end if;
  v_type:=p_block->>'type';
  if v_type='hero' then
    return p_block ?& array['id','type','visible','title','subtitle','action']
      and not exists(select 1 from jsonb_object_keys(p_block) key where key<>all(array['id','type','visible','title','subtitle','action']))
      and public.api_mall_application_bounded_text_is_valid(p_block->'title',2,80)
      and public.api_mall_application_bounded_text_is_valid(p_block->'subtitle',0,160)
      and public.api_mall_application_action_v2_is_valid(p_block->'action');
  elsif v_type='notice' then
    return p_block ?& array['id','type','visible','text','action']
      and not exists(select 1 from jsonb_object_keys(p_block) key where key<>all(array['id','type','visible','text','action']))
      and public.api_mall_application_bounded_text_is_valid(p_block->'text',0,300)
      and public.api_mall_application_action_v2_is_valid(p_block->'action');
  elsif v_type='shortcut' then
    if not (
      p_block ?& array['id','type','visible','title','items']
      and not exists(select 1 from jsonb_object_keys(p_block) key where key<>all(array['id','type','visible','title','items']))
      and public.api_mall_application_bounded_text_is_valid(p_block->'title',1,40)
      and jsonb_typeof(p_block->'items')='array'
      and jsonb_array_length(p_block->'items') between 1 and 8
    ) then return false; end if;
    for v_item in select value from jsonb_array_elements(p_block->'items') loop
      if jsonb_typeof(v_item) is distinct from 'object'
         or not (v_item ?& array['id','label','icon','visible','action'])
         or exists(select 1 from jsonb_object_keys(v_item) key where key<>all(array['id','label','icon','visible','action']))
         or jsonb_typeof(v_item->'id') is distinct from 'string'
         or jsonb_typeof(v_item->'icon') is distinct from 'string'
         or coalesce(v_item->>'id','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'
         or not public.api_mall_application_bounded_text_is_valid(v_item->'label',1,20)
         or coalesce(v_item->>'icon','') not in ('building','map-pin','ticket','store','gift','star','grid','link')
         or jsonb_typeof(v_item->'visible') is distinct from 'boolean'
         or not public.api_mall_application_action_v2_is_valid(v_item->'action')
      then return false; end if;
    end loop;
    return (
      select count(*)=count(distinct item->>'id')
      from jsonb_array_elements(p_block->'items') item
    );
  elsif v_type='product_collection' then
    return p_block ?& array['id','type','visible','title','subtitle','collectionId','displayLimit','action']
      and not exists(select 1 from jsonb_object_keys(p_block) key where key<>all(array['id','type','visible','title','subtitle','collectionId','displayLimit','action']))
      and public.api_mall_application_bounded_text_is_valid(p_block->'title',1,80)
      and public.api_mall_application_bounded_text_is_valid(p_block->'subtitle',0,160)
      and jsonb_typeof(p_block->'collectionId')='string'
      and coalesce(p_block->>'collectionId','') ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,179}$'
      and p_block->>'displayLimit' in ('2','4','6','8')
      and jsonb_typeof(p_block->'displayLimit')='number'
      and public.api_mall_application_action_v2_is_valid(p_block->'action');
  elsif v_type='rich_text' then
    return p_block ?& array['id','type','visible','title','content','action']
      and not exists(select 1 from jsonb_object_keys(p_block) key where key<>all(array['id','type','visible','title','content','action']))
      and public.api_mall_application_bounded_text_is_valid(p_block->'title',1,80)
      and public.api_mall_application_bounded_text_is_valid(p_block->'content',0,2000)
      and public.api_mall_application_action_v2_is_valid(p_block->'action');
  end if;
  return false;
end;
$$;

create or replace function public.api_mall_application_config_v2_is_valid(p_config jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare v_page jsonb; v_block jsonb; v_page_ids text[];
begin
  if jsonb_typeof(p_config) is distinct from 'object'
     or not (p_config ?& array['schemaVersion','mallDisplayName','themePreset','pages','memberCodeCta'])
     or exists(select 1 from jsonb_object_keys(p_config) key where key<>all(array['schemaVersion','mallDisplayName','themePreset','pages','memberCodeCta']))
     or jsonb_typeof(p_config->'schemaVersion')<>'number'
     or p_config->>'schemaVersion'<>'2'
     or not public.api_mall_application_bounded_text_is_valid(p_config->'mallDisplayName',2,40)
     or jsonb_typeof(p_config->'themePreset') is distinct from 'string'
     or coalesce(p_config->>'themePreset','') not in ('smart-blue','city-blue','festival-blue')
     or jsonb_typeof(p_config->'memberCodeCta') is distinct from 'object'
     or not ((p_config->'memberCodeCta') ?& array['title','description'])
     or exists(select 1 from jsonb_object_keys(p_config->'memberCodeCta') key where key<>all(array['title','description']))
     or jsonb_typeof(p_config->'memberCodeCta'->'title') is distinct from 'string'
     or jsonb_typeof(p_config->'memberCodeCta'->'description') is distinct from 'string'
     or p_config->'memberCodeCta'->>'title'<>'到店出示会员码'
     or p_config->'memberCodeCta'->>'description'<>'合作门店身份与权益核验 · 不是支付码'
     or jsonb_typeof(p_config->'pages') is distinct from 'array'
     or jsonb_array_length(p_config->'pages') not between 1 and 20
  then return false; end if;

  select array_agg(page->>'id') into v_page_ids from jsonb_array_elements(p_config->'pages') page;
  if cardinality(v_page_ids)<>cardinality(array(select distinct unnest(v_page_ids)))
     or (select count(*) from jsonb_array_elements(p_config->'pages') page where page->>'pageType'='home')<>1
     or not exists(
       select 1 from jsonb_array_elements(p_config->'pages') page
       where page->>'id'='home' and page->>'slug'='home' and page->>'pageType'='home'
     )
     or (select count(*) from jsonb_array_elements(p_config->'pages'))<>(
       select count(distinct page->>'slug') from jsonb_array_elements(p_config->'pages') page
     )
  then return false; end if;

  for v_page in select value from jsonb_array_elements(p_config->'pages') loop
    if jsonb_typeof(v_page) is distinct from 'object'
       or not (v_page ?& array['id','slug','name','pageType','blocks'])
       or exists(select 1 from jsonb_object_keys(v_page) key where key<>all(array['id','slug','name','pageType','blocks']))
       or jsonb_typeof(v_page->'id') is distinct from 'string'
       or jsonb_typeof(v_page->'slug') is distinct from 'string'
       or jsonb_typeof(v_page->'pageType') is distinct from 'string'
       or coalesce(v_page->>'id','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'
       or coalesce(v_page->>'slug','') !~ '^[a-z0-9][a-z0-9-]{0,79}$'
       or not public.api_mall_application_bounded_text_is_valid(v_page->'name',1,80)
       or coalesce(v_page->>'pageType','') not in ('home','micro_page','topic')
       or jsonb_typeof(v_page->'blocks') is distinct from 'array'
       or jsonb_array_length(v_page->'blocks') not between 1 and 30
       or (select count(*) from jsonb_array_elements(v_page->'blocks'))<>(
         select count(distinct block->>'id') from jsonb_array_elements(v_page->'blocks') block
       )
       or (select count(*) from jsonb_array_elements(v_page->'blocks') block where block->>'type'='hero')>4
       or (select count(*) from jsonb_array_elements(v_page->'blocks') block where block->>'type'='notice')>6
       or (select count(*) from jsonb_array_elements(v_page->'blocks') block where block->>'type'='shortcut')>4
       or (select count(*) from jsonb_array_elements(v_page->'blocks') block where block->>'type'='product_collection')>16
       or (select count(*) from jsonb_array_elements(v_page->'blocks') block where block->>'type'='rich_text')>8
    then return false; end if;
    for v_block in select value from jsonb_array_elements(v_page->'blocks') loop
      if not public.api_mall_application_block_v2_is_valid(v_block) then return false; end if;
    end loop;
  end loop;

  if (
    select count(*) from (
      select block->>'id' block_id
      from jsonb_array_elements(p_config->'pages') page
      cross join lateral jsonb_array_elements(page->'blocks') block
    ) ids
  )<>(select count(distinct block->>'id')
       from jsonb_array_elements(p_config->'pages') page
       cross join lateral jsonb_array_elements(page->'blocks') block)
  then return false; end if;

  if exists(
    with actions as (
      select block->'action' action
      from jsonb_array_elements(p_config->'pages') page
      cross join lateral jsonb_array_elements(page->'blocks') block
      where block->>'type'<>'shortcut'
      union all
      select item->'action'
      from jsonb_array_elements(p_config->'pages') page
      cross join lateral jsonb_array_elements(page->'blocks') block
      cross join lateral jsonb_array_elements(block->'items') item
      where block->>'type'='shortcut'
    )
    select 1 from actions where action->>'type'='micro_page'
      and not (action->>'targetId'=any(v_page_ids))
  ) then return false; end if;
  return true;
end;
$$;

create or replace function public.api_mall_application_config_v1_is_valid(p_config jsonb)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select jsonb_typeof(p_config)='object'
    and p_config ?& array['schemaVersion','mallDisplayName','themePreset','announcement','hero','entries','partners','segments','memberCodeCta','recommendationLimit']
    and not exists(
      select 1 from jsonb_object_keys(p_config) key
      where key<>all(array['schemaVersion','mallDisplayName','themePreset','announcement','hero','entries','partners','segments','memberCodeCta','recommendationLimit'])
    )
    and jsonb_typeof(p_config->'schemaVersion')='number' and p_config->>'schemaVersion'='1'
    and public.api_mall_application_bounded_text_is_valid(p_config->'mallDisplayName',2,40)
    and jsonb_typeof(p_config->'themePreset')='string'
    and p_config->>'themePreset' in ('smart-blue','city-blue','festival-blue')
    and public.api_mall_application_bounded_text_is_valid(p_config->'announcement',0,80)
    and jsonb_typeof(p_config->'hero')='object'
    and (p_config->'hero') ?& array['title','subtitle']
    and not exists(select 1 from jsonb_object_keys(p_config->'hero') key where key<>all(array['title','subtitle']))
    and public.api_mall_application_bounded_text_is_valid(p_config->'hero'->'title',2,24)
    and public.api_mall_application_bounded_text_is_valid(p_config->'hero'->'subtitle',0,40)
    and p_config->'memberCodeCta'=jsonb_build_object(
      'title','到店出示会员码','description','合作门店身份与权益核验 · 不是支付码'
    )
    and jsonb_typeof(p_config->'recommendationLimit')='number'
    and p_config->>'recommendationLimit' in ('2','4','6')
    and jsonb_typeof(p_config->'entries')='array'
    and jsonb_array_length(p_config->'entries')=4
    and not exists(
      select 1 from jsonb_array_elements(p_config->'entries') entry
      where jsonb_typeof(entry)<>'object'
        or not (entry ?& array['key','label','visible','sortOrder'])
        or exists(select 1 from jsonb_object_keys(entry) key where key<>all(array['key','label','visible','sortOrder']))
        or jsonb_typeof(entry->'key')<>'string'
        or entry->>'key' not in ('enterprise','city','voucher','partner')
        or not public.api_mall_application_bounded_text_is_valid(entry->'label',2,8)
        or jsonb_typeof(entry->'visible')<>'boolean'
        or jsonb_typeof(entry->'sortOrder')<>'number'
        or entry->>'sortOrder' not in ('1','2','3','4')
    )
    and (select count(distinct entry->>'key') from jsonb_array_elements(p_config->'entries') entry)=4
    and (select count(distinct entry->>'sortOrder') from jsonb_array_elements(p_config->'entries') entry)=4
    and jsonb_typeof(p_config->'partners')='array'
    and jsonb_array_length(p_config->'partners') between 1 and 8
    and not exists(
      select 1 from jsonb_array_elements(p_config->'partners') partner
      where jsonb_typeof(partner)<>'string'
        or not public.api_mall_application_bounded_text_is_valid(partner,1,12)
    )
    and (select count(*) from jsonb_array_elements(p_config->'partners'))=(
      select count(distinct partner#>>'{}') from jsonb_array_elements(p_config->'partners') partner
    )
    and jsonb_typeof(p_config->'segments')='array'
    and jsonb_array_length(p_config->'segments')=4
    and not exists(
      select 1 from jsonb_array_elements(p_config->'segments') segment
      where jsonb_typeof(segment)<>'object'
        or not (segment ?& array['key','title','description','visible','sortOrder'])
        or exists(select 1 from jsonb_object_keys(segment) key where key<>all(array['key','title','description','visible','sortOrder']))
        or jsonb_typeof(segment->'key')<>'string'
        or segment->>'key' not in ('grocery','life','digital','dining')
        or not public.api_mall_application_bounded_text_is_valid(segment->'title',2,12)
        or not public.api_mall_application_bounded_text_is_valid(segment->'description',0,24)
        or jsonb_typeof(segment->'visible')<>'boolean'
        or jsonb_typeof(segment->'sortOrder')<>'number'
        or segment->>'sortOrder' not in ('1','2','3','4')
    )
    and (select count(distinct segment->>'key') from jsonb_array_elements(p_config->'segments') segment)=4
    and (select count(distinct segment->>'sortOrder') from jsonb_array_elements(p_config->'segments') segment)=4;
$$;

create or replace function public.api_mall_application_config_to_v2(p_config jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare v_result jsonb; v_shortcuts jsonb; v_collections jsonb; v_partners text;
begin
  if public.api_mall_application_config_v2_is_valid(p_config) then return p_config; end if;
  if not public.api_mall_application_config_v1_is_valid(p_config) then return null; end if;

  select jsonb_agg(jsonb_build_object(
    'id',entry->>'key',
    'label',entry->>'label',
    'icon',case entry->>'key'
      when 'enterprise' then 'building' when 'city' then 'map-pin'
      when 'voucher' then 'ticket' else 'store' end,
    'visible',(entry->>'visible')::boolean,
    'action',case entry->>'key'
      when 'enterprise' then jsonb_build_object('type','collection','targetId','enterprise')
      when 'city' then jsonb_build_object('type','category','targetId','city')
      when 'voucher' then jsonb_build_object('type','marketing_activity','targetId','voucher')
      else jsonb_build_object('type','collection','targetId','partner') end
  ) order by (entry->>'sortOrder')::integer)
  into v_shortcuts from jsonb_array_elements(p_config->'entries') entry;

  select jsonb_agg(jsonb_build_object(
    'id','collection-'||(segment->>'key'),'type','product_collection',
    'visible',(segment->>'visible')::boolean,'title',segment->>'title',
    'subtitle',segment->>'description','collectionId',segment->>'key',
    'displayLimit',(p_config->>'recommendationLimit')::integer,
    'action',jsonb_build_object('type','collection','targetId',segment->>'key')
  ) order by (segment->>'sortOrder')::integer)
  into v_collections from jsonb_array_elements(p_config->'segments') segment;

  select string_agg(partner#>>'{}',' · ' order by ordinal)
  into v_partners
  from jsonb_array_elements(p_config->'partners') with ordinality source(partner,ordinal);

  v_result:=jsonb_build_object(
    'schemaVersion',2,
    'mallDisplayName',p_config->>'mallDisplayName',
    'themePreset',p_config->>'themePreset',
    'pages',jsonb_build_array(jsonb_build_object(
      'id','home','slug','home','name','首页','pageType','home',
      'blocks',jsonb_build_array(
        jsonb_build_object('id','hero-main','type','hero','visible',true,
          'title',p_config->'hero'->>'title','subtitle',p_config->'hero'->>'subtitle',
          'action',jsonb_build_object('type','none')),
        jsonb_build_object('id','notice-main','type','notice',
          'visible',char_length(p_config->>'announcement')>0,
          'text',p_config->>'announcement','action',jsonb_build_object('type','none')),
        jsonb_build_object('id','shortcut-main','type','shortcut','visible',true,
          'title','快捷入口','items',v_shortcuts)
      ) || v_collections || jsonb_build_array(
        jsonb_build_object('id','richtext-partners','type','rich_text',
          'visible',true,'title','合作卖场','content',v_partners,
          'action',jsonb_build_object('type','none'))
      )
    )),
    'memberCodeCta',jsonb_build_object(
      'title','到店出示会员码','description','合作门店身份与权益核验 · 不是支付码'
    )
  );
  if not public.api_mall_application_config_v2_is_valid(v_result) then return null; end if;
  return v_result;
end;
$$;

create or replace function public.api_default_mall_application_config(p_name text)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'schemaVersion',2,
    'mallDisplayName',case
      when char_length(trim(coalesce(p_name,''))) between 2 and 40 then trim(p_name)
      else '智慧翼福利商城'
    end,
    'themePreset','smart-blue',
    'pages',jsonb_build_array(jsonb_build_object(
      'id','home','slug','home','name','首页','pageType','home',
      'blocks',jsonb_build_array(
        jsonb_build_object('id','hero-main','type','hero','visible',true,
          'title','员工专享福利季','subtitle','精选好物 · 专属惠上',
          'action',jsonb_build_object('type','none')),
        jsonb_build_object('id','notice-main','type','notice','visible',true,
          'text','登录后识别企业福利与可购资格','action',jsonb_build_object('type','none')),
        jsonb_build_object('id','shortcut-main','type','shortcut','visible',true,'title','快捷入口',
          'items',jsonb_build_array(
            jsonb_build_object('id','enterprise','label','企业专区','icon','building','visible',true,'action',jsonb_build_object('type','collection','targetId','enterprise')),
            jsonb_build_object('id','city','label','城市专区','icon','map-pin','visible',true,'action',jsonb_build_object('type','category','targetId','city')),
            jsonb_build_object('id','voucher','label','电子卡券','icon','ticket','visible',true,'action',jsonb_build_object('type','marketing_activity','targetId','voucher')),
            jsonb_build_object('id','partner','label','合作商','icon','store','visible',true,'action',jsonb_build_object('type','collection','targetId','partner'))
          )),
        jsonb_build_object('id','collection-recommended','type','product_collection','visible',true,
          'title','精选福利','subtitle','为你推荐的福利商品','collectionId','recommended',
          'displayLimit',4,'action',jsonb_build_object('type','collection','targetId','recommended'))
      )
    )),
    'memberCodeCta',jsonb_build_object(
      'title','到店出示会员码','description','合作门店身份与权益核验 · 不是支付码'
    )
  );
$$;

do $$
begin
  if not exists(
    select 1 from pg_constraint where conname='mall_application_versions_supported_schema'
      and conrelid='public.mall_application_versions'::regclass
  ) then
    alter table public.mall_application_versions
      add constraint mall_application_versions_supported_schema
      check (public.api_mall_application_config_to_v2(config_json) is not null) not valid;
  end if;
end;
$$;

create or replace function public.api_mall_application_authorization_scope(p_mall_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'tenant_id',mall.tenant_id,'enterprise_id',mall.enterprise_id,'mall_id',mall.id,
    'org_unit_path',public.api_org_unit_scope_path('mall',mall.id)
  ) from public.malls mall where mall.id=p_mall_id;
$$;

drop function if exists public.api_mall_application_center(text,text,text);
create function public.api_mall_application_center(
  p_tenant_id text,p_enterprise_id text,p_context_mall_id text,p_actor_user_id text,
  p_actor_membership_id text,p_permission_code text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_response jsonb;
begin
  if p_permission_code<>'mall.read'
     or not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',
       p_tenant_id,p_enterprise_id,p_context_mall_id
     )
     or not public.api_membership_has_permission(p_actor_membership_id,p_permission_code)
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_actor_membership_id,p_permission_code,false
     )
  then raise exception 'MALL_APPLICATION_SCOPE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'componentRegistry',public.api_mall_application_component_registry(),
    'malls',coalesce(jsonb_agg(item order by item->>'name'),'[]'::jsonb)
  ) into v_response
  from (
    select jsonb_build_object(
      'id',mall.id,'code',mall.code,'publicSlug',mall.public_slug,
      'name',mall.name,'status',mall.status,'rowVersion',head.row_version,
      'draftVersion',jsonb_build_object(
        'id',draft.id,'versionNo',draft.version_no,
        'config',public.api_mall_application_config_to_v2(draft.config_json),
        'createdAt',draft.created_at,'reason',draft.reason
      ),
      'publishedVersion',jsonb_build_object(
        'id',published.id,'versionNo',published.version_no,
        'config',public.api_mall_application_config_to_v2(published.config_json),
        'createdAt',published.created_at,'reason',published.reason
      ),
      'history',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',version.id,'versionNo',version.version_no,
          'lifecycle',version.lifecycle,'reason',version.reason,'createdAt',version.created_at
        ) order by version.version_no desc)
        from (
          select * from public.mall_application_versions history
          where history.mall_id=mall.id order by history.version_no desc limit 20
        ) version
      ),'[]'::jsonb)
    ) item
    from public.malls mall
    join public.mall_application_heads head on head.mall_id=mall.id
    join public.mall_application_versions draft on draft.id=head.draft_version_id
    join public.mall_application_versions published on published.id=head.published_version_id
    where mall.tenant_id=p_tenant_id and mall.enterprise_id=p_enterprise_id
      and public.api_mall_application_actor_access(
        p_actor_membership_id,p_tenant_id,p_enterprise_id,mall.id,false
      )
  ) visible;
  return v_response;
end;
$$;

create or replace function public.api_mall_application_experience(p_tenant_id text,p_mall_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.api_mall_application_config_to_v2(version.config_json)
  from public.mall_application_heads head
  join public.mall_application_versions version on version.id=head.published_version_id
  join public.malls mall on mall.id=head.mall_id
  where head.tenant_id=p_tenant_id and head.mall_id=p_mall_id and mall.status='active'
    and public.api_mall_application_config_to_v2(version.config_json) is not null;
$$;

drop function if exists public.api_mutate_mall_application(
  text,text,text,text,text,text,text,jsonb,bigint,text,text,text,text,text,text
);
create function public.api_mutate_mall_application(
  p_action text,p_tenant_id text,p_enterprise_id text,p_context_mall_id text,
  p_actor_user_id text,p_actor_membership_id text,p_target_mall_id text,
  p_payload jsonb,p_expected_row_version bigint,p_source_version_id text,
  p_reason text,p_idempotency_key text,p_request_hash text,p_request_id text,
  p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare
  v_target_mall public.malls%rowtype;
  v_head public.mall_application_heads%rowtype;
  v_source public.mall_application_versions%rowtype;
  v_existing public.idempotency_keys%rowtype;
  v_permission text;
  v_config jsonb;
  v_new_version_id text;
  v_new_mall_id text;
  v_next_version bigint;
  v_response jsonb;
begin
  v_permission:=case p_action
    when 'create' then 'mall.manage'
    when 'publish' then 'mall.publish'
    when 'save' then 'mall.decorate'
    when 'restore' then 'mall.decorate'
  end;
  if v_permission is null then raise exception 'MALL_APPLICATION_ACTION_INVALID'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 4 and 500
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 8 and 120
     or char_length(trim(coalesce(p_request_hash,'')))<1
  then raise exception 'MALL_APPLICATION_INPUT_INVALID'; end if;
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',
       p_tenant_id,p_enterprise_id,p_context_mall_id
     )
     or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_actor_membership_id,v_permission,false
     )
  then raise exception 'MALL_APPLICATION_SCOPE_FORBIDDEN'; end if;

  if p_action='create' then
    if not public.api_mall_application_actor_access(
      p_actor_membership_id,p_tenant_id,p_enterprise_id,p_context_mall_id,true
    ) then raise exception 'MALL_APPLICATION_SCOPE_FORBIDDEN'; end if;
    if jsonb_typeof(p_payload) is distinct from 'object'
       or not (p_payload ?& array['code','publicSlug','name','config'])
       or exists(select 1 from jsonb_object_keys(p_payload) key where key<>all(array['code','publicSlug','name','config']))
       or jsonb_typeof(p_payload->'code') is distinct from 'string'
       or jsonb_typeof(p_payload->'publicSlug') is distinct from 'string'
       or jsonb_typeof(p_payload->'name') is distinct from 'string'
       or coalesce(p_payload->>'code','') !~ '^[A-Z][A-Z0-9_-]{2,31}$'
       or coalesce(p_payload->>'publicSlug','') !~ '^[a-z0-9][a-z0-9-]{2,47}$'
       or char_length(trim(p_payload->>'name')) not between 2 and 60
       or not public.api_mall_application_config_v2_is_valid(p_payload->'config')
    then raise exception 'MALL_APPLICATION_INPUT_INVALID'; end if;
  else
    select * into v_target_mall from public.malls
    where id=p_target_mall_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id;
    if not found then raise exception 'MALL_APPLICATION_NOT_FOUND'; end if;
    if not public.api_mall_application_actor_access(
      p_actor_membership_id,p_tenant_id,p_enterprise_id,p_target_mall_id,false
    ) then raise exception 'MALL_APPLICATION_SCOPE_FORBIDDEN'; end if;
    if p_expected_row_version<1 then raise exception 'MALL_APPLICATION_VERSION_CONFLICT'; end if;
    if p_action='save' and not public.api_mall_application_config_v2_is_valid(p_payload)
    then raise exception 'MALL_APPLICATION_INPUT_INVALID'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(
    p_tenant_id||':mall_application:'||p_action||':'||p_idempotency_key
  ));
  select * into v_existing from public.idempotency_keys
  where mall_id=p_context_mall_id and scope='mall_application:'||p_action
    and idempotency_key=p_idempotency_key and expires_at>now();
  if found then
    if v_existing.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  if p_action='create' then
    v_new_mall_id:=gen_random_uuid()::text;
    insert into public.malls(
      id,tenant_id,enterprise_id,code,public_slug,name,brand_name,status
    ) values (
      v_new_mall_id,p_tenant_id,p_enterprise_id,p_payload->>'code',
      p_payload->>'publicSlug',trim(p_payload->>'name'),'智慧翼企业福利商城','disabled'
    );
    v_new_version_id:=gen_random_uuid()::text;
    insert into public.mall_application_versions(
      id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,reason,
      created_by_user_id,created_by_membership_id
    ) values (
      v_new_version_id,p_tenant_id,p_enterprise_id,v_new_mall_id,1,'published',
      p_payload->'config',p_reason,p_actor_user_id,p_actor_membership_id
    );
    p_source_version_id:=v_new_version_id;
    v_new_version_id:=gen_random_uuid()::text;
    insert into public.mall_application_versions(
      id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,
      source_version_id,reason,created_by_user_id,created_by_membership_id
    ) values (
      v_new_version_id,p_tenant_id,p_enterprise_id,v_new_mall_id,2,'draft',
      p_payload->'config',p_source_version_id,p_reason,p_actor_user_id,p_actor_membership_id
    );
    insert into public.mall_application_heads(
      mall_id,tenant_id,enterprise_id,draft_version_id,published_version_id,updated_by_user_id
    ) values (
      v_new_mall_id,p_tenant_id,p_enterprise_id,v_new_version_id,p_source_version_id,p_actor_user_id
    );
    v_response:=jsonb_build_object(
      'mallId',v_new_mall_id,'rowVersion',1,'status','created'
    );
  else
    select * into v_head from public.mall_application_heads
    where mall_id=p_target_mall_id for update;
    if not found then raise exception 'MALL_APPLICATION_NOT_FOUND'; end if;
    if v_head.row_version<>p_expected_row_version
    then raise exception 'MALL_APPLICATION_VERSION_CONFLICT'; end if;
    select coalesce(max(version_no),0)+1 into v_next_version
    from public.mall_application_versions where mall_id=p_target_mall_id;
    v_new_version_id:=gen_random_uuid()::text;

    if p_action='save' then
      v_config:=p_payload;
      p_source_version_id:=v_head.draft_version_id;
    elsif p_action='publish' then
      select * into v_source from public.mall_application_versions
      where id=v_head.draft_version_id and mall_id=p_target_mall_id;
      v_config:=public.api_mall_application_config_to_v2(v_source.config_json);
      if v_config is null then raise exception 'MALL_APPLICATION_SCHEMA_INVALID'; end if;
      if exists(
        select 1 from public.mall_application_versions published
        where published.id=v_head.published_version_id
          and published.source_version_id=v_source.id
      ) then raise exception 'MALL_APPLICATION_ALREADY_PUBLISHED'; end if;
      p_source_version_id:=v_source.id;
    else
      select * into v_source from public.mall_application_versions
      where id=p_source_version_id and mall_id=p_target_mall_id;
      if not found then raise exception 'MALL_APPLICATION_HISTORY_NOT_FOUND'; end if;
      v_config:=public.api_mall_application_config_to_v2(v_source.config_json);
      if v_config is null then raise exception 'MALL_APPLICATION_SCHEMA_INVALID'; end if;
    end if;

    insert into public.mall_application_versions(
      id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,
      source_version_id,reason,created_by_user_id,created_by_membership_id
    ) values (
      v_new_version_id,p_tenant_id,p_enterprise_id,p_target_mall_id,v_next_version,
      case when p_action='publish' then 'published' else 'draft' end,
      v_config,p_source_version_id,p_reason,p_actor_user_id,p_actor_membership_id
    );
    if p_action='publish' then
      update public.mall_application_heads set
        published_version_id=v_new_version_id,row_version=row_version+1,
        updated_by_user_id=p_actor_user_id,updated_at=now()
      where mall_id=p_target_mall_id;
      update public.malls set status='active',updated_at=now()
      where id=p_target_mall_id;
    else
      update public.mall_application_heads set
        draft_version_id=v_new_version_id,row_version=row_version+1,
        updated_by_user_id=p_actor_user_id,updated_at=now()
      where mall_id=p_target_mall_id;
    end if;
    v_response:=jsonb_build_object(
      'mallId',p_target_mall_id,'versionId',v_new_version_id,
      'versionNo',v_next_version,'rowVersion',v_head.row_version+1,'status',p_action
    );
  end if;

  insert into public.idempotency_keys(
    tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,expires_at
  ) values (
    p_tenant_id,p_context_mall_id,'mall_application:'||p_action,p_idempotency_key,
    p_request_hash,coalesce(v_new_mall_id,p_target_mall_id),v_response,now()+interval '24 hours'
  );
  insert into public.audit_logs(
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,
    membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,
    coalesce(v_new_mall_id,p_target_mall_id),p_actor_user_id,'admin',
    'mall.application.'||p_action,'mall_application',
    coalesce(v_new_mall_id,p_target_mall_id),p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('versionId',v_new_version_id,'reason',trim(p_reason)),
    p_actor_membership_id,p_granted_via,now()
  );
  return v_response;
exception when unique_violation then
  if p_action='create' then raise exception 'MALL_APPLICATION_CODE_OR_SLUG_CONFLICT'; end if;
  raise;
end;
$$;

revoke all on function public.api_mall_application_component_registry()
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_bounded_text_is_valid(jsonb,integer,integer)
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_action_v2_is_valid(jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_block_v2_is_valid(jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_config_v2_is_valid(jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_config_v1_is_valid(jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_config_to_v2(jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_default_mall_application_config(text)
from public,anon,authenticated,service_role;
revoke all on function public.api_mall_application_authorization_scope(text)
from public,anon,authenticated;
revoke all on function public.api_mall_application_center(text,text,text,text,text,text,jsonb)
from public,anon,authenticated;
revoke all on function public.api_mall_application_experience(text,text)
from public,anon,authenticated;
revoke all on function public.api_mutate_mall_application(
  text,text,text,text,text,text,text,jsonb,bigint,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.api_mall_application_authorization_scope(text) to service_role;
grant execute on function public.api_mall_application_center(text,text,text,text,text,text,jsonb)
to service_role;
grant execute on function public.api_mall_application_experience(text,text) to service_role;
grant execute on function public.api_mutate_mall_application(
  text,text,text,text,text,text,text,jsonb,bigint,text,text,text,text,text,text,jsonb
) to service_role;
