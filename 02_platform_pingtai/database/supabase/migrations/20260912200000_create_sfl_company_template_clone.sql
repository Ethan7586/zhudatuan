begin;

select pg_advisory_xact_lock(hashtext('sfl:company-template-clone:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912190000' and checksum='ed34c5c7137ce60aaf6995781f9a0e7a3f0792bb1a3bcefb27a8c6486a808515') then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create table organization.operatingline(
  id text primary key,
  template_line_id text,
  root_node_id text unique,
  status text not null check(status in('active','retired')),
  created_at timestamptz not null,
  check(id<>template_line_id)
);

insert into organization.operatingline(id,template_line_id,root_node_id,status,created_at)
select distinct node.line_id,null,
  (select relation.node_id from organization.noderelation relation
    where relation.line_id=node.line_id and relation.signed_level='L0' and relation.superseded_at is null
    order by relation.effective_at,relation.node_id limit 1),
  'active',min(node.created_at)
from organization.node node group by node.line_id;

alter table organization.noderelation drop constraint noderelation_host_node_fkey;
alter table organization.noderelation add constraint noderelation_host_node_fkey
  foreign key(host_sovereign_node_id) references organization.node(id);

alter table organization.hostedmallopening drop constraint hostedmallopening_status_check;
alter table organization.hostedmallopening add constraint hostedmallopening_status_check
  check(status in('active','pending_bindings'));
alter table organization.hostedmallconfiguration drop constraint hostedmallconfiguration_payment_mode_check;
alter table organization.hostedmallconfiguration alter column shared_payment_binding_ref drop not null;
alter table organization.hostedmallconfiguration add constraint hostedmallconfiguration_payment_mode_check check(
  (payment_mode='host_shared_reference' and shared_payment_binding_ref is not null)
  or (payment_mode='pending_independent_binding' and shared_payment_binding_ref is null)
);

create table organization.companyclone(
  idempotency_key text primary key,
  request_hash char(64) not null,
  clone_id text not null unique,
  business_number text not null unique,
  source_realm_id text not null references identity.realm(id),
  source_mall_id text not null references organization.organization(id),
  source_operating_entity_id text not null references organization.organization(id),
  source_line_id text not null,
  source_node_id text not null references organization.node(id),
  source_membership_id text not null references access.membership(id),
  target_realm_id text not null unique references identity.realm(id),
  target_mall_id text not null unique references organization.organization(id),
  target_operating_entity_id text not null unique references organization.organization(id),
  target_line_id text not null unique references organization.operatingline(id),
  target_node_id text not null unique references organization.node(id),
  target_membership_id text not null unique references access.membership(id),
  target_application_id text not null unique references experience.application(id),
  target_pool_id text not null unique references catalog.pool(id),
  host_sovereign_node_id text not null references organization.node(id),
  template_snapshot jsonb not null check(jsonb_typeof(template_snapshot)='object'),
  status text not null check(status='pending_bindings'),
  infrastructure_action_count integer not null default 0 check(infrastructure_action_count=0),
  requested_by text not null references identity.principal(id),
  trace_id text not null,
  created_at timestamptz not null
);

create table organization.companyuniquebinding(
  clone_id text not null references organization.companyclone(clone_id),
  target_realm_id text not null references identity.realm(id),
  binding_kind text not null check(binding_kind in('domain','legal_identity','payment_merchant','payment_secret')),
  status text not null check(status in('pending','bound')),
  binding_ref text,
  binding_version bigint not null check(binding_version>0),
  created_at timestamptz not null,
  bound_at timestamptz,
  primary key(clone_id,binding_kind),
  unique(target_realm_id,binding_kind,binding_version),
  check((status='pending' and binding_ref is null and bound_at is null)
    or (status='bound' and binding_ref is not null and bound_at is not null))
);

create function organization.clone_company_template(p_request jsonb)
returns table(
  clone_id text,business_number text,source_realm_id text,source_mall_id text,source_line_id text,
  source_node_id text,target_realm_id text,target_mall_id text,target_operating_entity_id text,
  target_line_id text,target_node_id text,target_membership_id text,target_application_id text,
  target_pool_id text,host_sovereign_node_id text,status text,infrastructure_action_count integer,
  created_at text,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_idempotency_key text:=p_request->>'idempotency_key';
  v_source_realm_id text:=p_request->>'source_realm_id';
  v_source_membership_id text:=p_request->>'source_membership_id';
  v_company_name text:=p_request->>'company_name';
  v_mall_name text:=p_request->>'mall_name';
  v_requested_by text:=p_request->>'requested_by';
  v_trace_id text:=p_request->>'trace_id';
  v_request_hash text;
  v_identity_hash text;
  v_clone_id text;
  v_business_number text;
  v_target_realm_id text;
  v_target_mall_id text;
  v_target_operating_entity_id text;
  v_target_line_id text;
  v_target_node_id text;
  v_target_account_id text;
  v_target_membership_id text;
  v_target_application_id text;
  v_target_version_id text;
  v_target_pool_id text;
  v_target_opening_id text;
  v_target_binding_id text;
  v_target_configuration_id text;
  v_target_code text;
  v_target_slug text;
  v_configuration jsonb;
  v_now timestamptz:=transaction_timestamp();
  v_source record;
  v_existing organization.companyclone%rowtype;
  v_interrupt text:=current_setting('sfl.company_template_clone_interrupt',true);
begin
  if jsonb_typeof(p_request)<>'object'
    or (select array_agg(key order by key) from jsonb_object_keys(p_request) key)
      <>array['company_name','idempotency_key','mall_name','requested_by','source_membership_id',
        'source_realm_id','trace_id']::text[]
    or v_idempotency_key is null or v_idempotency_key='' or v_idempotency_key<>btrim(v_idempotency_key)
    or length(v_idempotency_key)>255
    or v_source_realm_id is null or v_source_realm_id='' or v_source_realm_id<>btrim(v_source_realm_id)
    or v_source_membership_id is null or v_source_membership_id=''
    or v_company_name is null or v_company_name='' or v_company_name<>btrim(v_company_name) or length(v_company_name)>128
    or v_mall_name is null or v_mall_name='' or v_mall_name<>btrim(v_mall_name) or length(v_mall_name)>128
    or v_requested_by is null or v_requested_by='' or v_trace_id is null or v_trace_id='' then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_REQUEST_INVALID';
  end if;

  v_request_hash:=encode(public.digest(convert_to(jsonb_build_object(
    'source_realm_id',v_source_realm_id,'source_membership_id',v_source_membership_id,
    'company_name',v_company_name,'mall_name',v_mall_name,'requested_by',v_requested_by
  )::text,'UTF8'),'sha256'),'hex');
  v_identity_hash:=encode(public.digest(convert_to(v_source_realm_id||':'||v_idempotency_key,'UTF8'),'sha256'),'hex');
  v_clone_id:='company-clone:'||substr(v_identity_hash,1,32);
  v_business_number:='SFLCOMPANY-'||upper(substr(v_identity_hash,1,20));
  v_target_realm_id:='realm:clone-'||substr(v_identity_hash,1,32);
  v_target_mall_id:='mall:clone-'||substr(v_identity_hash,1,32);
  v_target_operating_entity_id:='enterprise:clone-'||substr(v_identity_hash,1,32);
  v_target_line_id:='line:clone-'||substr(v_identity_hash,1,32);
  v_target_node_id:='node:clone-'||substr(v_identity_hash,1,24)||':l0';
  v_target_account_id:='account:clone:'||substr(v_identity_hash,1,32);
  v_target_membership_id:='membership:clone:'||substr(v_identity_hash,1,32);
  v_target_application_id:='application:clone:'||substr(v_identity_hash,1,32);
  v_target_version_id:='version:clone:'||substr(v_identity_hash,1,32)||':v1';
  v_target_pool_id:='pool:clone:'||substr(v_identity_hash,1,32);
  v_target_opening_id:='opening:clone:'||substr(v_identity_hash,1,32);
  v_target_binding_id:='entity-binding:clone:'||substr(v_identity_hash,1,32);
  v_target_configuration_id:='hosted-config:clone:'||substr(v_identity_hash,1,32);
  v_target_code:='CLONE_'||upper(substr(v_identity_hash,1,20));
  v_target_slug:='clone-'||substr(v_identity_hash,1,24);

  perform pg_advisory_xact_lock(hashtextextended('sfl:company-template-clone:idempotency:'||v_idempotency_key,0));
  select cloned.* into v_existing from organization.companyclone cloned
  where cloned.idempotency_key=v_idempotency_key;
  if found then
    if v_existing.request_hash<>v_request_hash then
      raise exception 'SFL_COMPANY_TEMPLATE_CLONE_IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select cloned.clone_id,cloned.business_number,cloned.source_realm_id,cloned.source_mall_id,
      cloned.source_line_id,cloned.source_node_id,cloned.target_realm_id,cloned.target_mall_id,
      cloned.target_operating_entity_id,cloned.target_line_id,cloned.target_node_id,
      cloned.target_membership_id,cloned.target_application_id,cloned.target_pool_id,
      cloned.host_sovereign_node_id,cloned.status,cloned.infrastructure_action_count,
      to_char(cloned.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),true
    from organization.companyclone cloned where cloned.idempotency_key=v_idempotency_key;
    return;
  end if;

  select realm.id realm_id,realm.mall_id,realm.node_id,node.line_id,node.id node_id,
    relation.host_sovereign_node_id,host_node.realm_id host_realm_id,
    mall.parent_id operating_entity_id,operating_entity.parent_id operating_entity_parent_id,
    mall.timezone,mall.name source_mall_name,membership.member_id,account.legacy_principal_id,
    capability.capabilities,capability.capability_version,
    pool.id pool_id,pool.kind pool_kind,pool_binding.listing_kind,
    application.id application_id,application.head_version_id,version.schema_version,version.configuration
  into v_source
  from identity.realm realm
  join organization.node node on node.id=realm.node_id and node.realm_id=realm.id and node.status='active'
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  join organization.node host_node on host_node.id=relation.host_sovereign_node_id
    and host_node.sovereignty_tier='sovereign' and host_node.node_profile='operating_mall' and host_node.status='active'
  join organization.organization mall on mall.id=realm.mall_id and mall.kind='mall' and mall.status='active'
  join organization.organization operating_entity on operating_entity.id=mall.parent_id
    and operating_entity.kind='enterprise' and operating_entity.status='active'
  join access.membership membership on membership.id=v_source_membership_id
    and membership.organization_id=mall.id and membership.client='operator' and membership.status='active'
    and membership.realm_id=realm.id and membership.node_profile='operating_mall'
  join identity.account account on account.id=membership.account_id and account.realm_id=realm.id
    and account.status='active' and account.legacy_principal_id=v_requested_by
  join lateral(select current_capability.* from organization.nodecapabilityversion current_capability
    where current_capability.node_id=node.id order by current_capability.capability_version desc limit 1) capability on true
  join lateral(select current_binding.* from catalog.poolbinding current_binding
    where current_binding.mall_id=mall.id and current_binding.status='active'
    order by current_binding.pool_id limit 1) pool_binding on true
  join catalog.pool pool on pool.id=pool_binding.pool_id and pool.status='active'
  join lateral(select current_application.* from experience.binding application_binding
    join experience.application current_application on current_application.id=application_binding.application_id
    where application_binding.mall_id=mall.id and application_binding.pool_id=pool.id
    order by current_application.id limit 1) application on true
  join experience.version version on version.id=application.head_version_id
  where realm.id=v_source_realm_id and realm.status='active' and realm.node_profile='operating_mall'
  for update of realm,node,mall,operating_entity,membership,account;
  if not found then raise exception 'SFL_COMPANY_TEMPLATE_CLONE_SOURCE_INVALID'; end if;

  v_configuration:=replace(v_source.configuration::text,
    to_jsonb(v_source.application_id::text)::text,to_jsonb(v_target_application_id)::text)::jsonb;
  v_configuration:=replace(v_configuration::text,
    to_jsonb(v_source.source_mall_name::text)::text,to_jsonb(v_mall_name)::text)::jsonb;

  insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
  values(v_target_operating_entity_id,'enterprise',v_source.operating_entity_parent_id,v_company_name,
    v_source.timezone,'active',1,v_now,v_now);
  insert into organization.unitclosure(ancestor_id,descendant_id,depth)
  select closure.ancestor_id,v_target_operating_entity_id,closure.depth+1 from organization.unitclosure closure
  where closure.descendant_id=v_source.operating_entity_parent_id
  union all select v_target_operating_entity_id,v_target_operating_entity_id,0;
  insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
  values(v_target_mall_id,'mall',v_target_operating_entity_id,v_mall_name,v_source.timezone,'active',1,v_now,v_now);
  insert into organization.unitclosure(ancestor_id,descendant_id,depth)
  select closure.ancestor_id,v_target_mall_id,closure.depth+1 from organization.unitclosure closure
  where closure.descendant_id=v_target_operating_entity_id
  union all select v_target_mall_id,v_target_mall_id,0;
  insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
  values('mall',v_target_mall_id,v_target_mall_id,v_target_code);

  insert into organization.operatingline(id,template_line_id,status,created_at)
  values(v_target_line_id,v_source.line_id,'active',v_now);
  insert into identity.realm(id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile)
  values(v_target_realm_id,v_target_node_id,'active',v_now,v_now,0,'operating_mall',v_target_mall_id,
    v_source.host_sovereign_node_id,'operating_mall');
  insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
  values(v_target_node_id,v_target_line_id,'hosted','operating_mall',v_target_realm_id,v_target_mall_id,'active',v_now,v_now);
  insert into organization.noderelation(line_id,node_id,parent_node_id,original_parent_node_id,signed_level,
    host_sovereign_node_id,relation_version,effective_at)
  values(v_target_line_id,v_target_node_id,null,null,'L0',v_source.host_sovereign_node_id,1,v_now);
  update organization.operatingline set root_node_id=v_target_node_id where id=v_target_line_id;
  update organization.nodecapabilityversion set capabilities=v_source.capabilities,
    source_operation_id='internal.company-template.clone'
  where node_id=v_target_node_id and capability_version=1;
  if v_interrupt='after-identity' then raise exception 'SFL_COMPANY_TEMPLATE_CLONE_TEST_INTERRUPT'; end if;

  insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,version)
  values(v_target_account_id,v_target_realm_id,v_requested_by,'active',1,0,v_now,v_now,0);
  insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at,
    realm_id,account_id,node_profile)
  values(v_target_membership_id,v_source.member_id,v_target_mall_id,'operator','active',1,v_now,
    v_target_realm_id,v_target_account_id,'operating_mall');
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values(v_target_membership_id,'role:self',v_now);
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values
    ('scope:'||v_target_membership_id||':mall',v_target_membership_id,'mall',v_target_mall_id,v_target_mall_id,'allow',v_now,1),
    ('scope:'||v_target_membership_id||':owner',v_target_membership_id,'owner',v_source.member_id,v_source.member_id,'allow',v_now,1),
    ('scope:'||v_target_membership_id||':self',v_target_membership_id,'self','self:'||v_requested_by,'self:'||v_requested_by,'allow',v_now,1);
  insert into access.mallowner(mall_id,organization_id,scope_id,membership_id,source_membership_id,created_at)
  values(v_target_mall_id,v_target_mall_id,v_target_mall_id,v_target_membership_id,v_source_membership_id,v_now);

  insert into catalog.pool(id,scope_id,kind,name,status,version)
  values(v_target_pool_id,v_target_mall_id,v_source.pool_kind,v_mall_name||'默认商品池','active',0);
  insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
  values(v_target_mall_id,v_target_pool_id,v_source.listing_kind,'active',v_now,v_now);
  insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
  values(v_target_application_id,v_target_mall_id,v_target_code,v_target_slug,v_mall_name,'draft',v_now,v_now,0);
  insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,
    validation_state,reason,created_by,created_at)
  values(v_target_version_id,v_target_application_id,1,v_source.schema_version,v_configuration,
    encode(public.digest(convert_to(v_configuration::text,'UTF8'),'sha256'),'hex'),'valid',
    'company template clone',v_requested_by,v_now);
  update experience.application set head_version_id=v_target_version_id where id=v_target_application_id;
  insert into experience.binding(application_id,domain,mall_id,pool_id)
  values(v_target_application_id,v_target_slug,v_target_mall_id,v_target_pool_id);

  insert into organization.hostedmallopening(
    idempotency_key,request_hash,opening_id,business_number,node_id,line_id,realm_id,membership_id,principal_id,
    mall_id,operating_entity_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    sovereignty_tier,node_profile,capability_version,relation_version,mall_version,entity_binding_version,
    configuration_version,payment_configuration_version,status,mall_name,operating_entity_name,opened_at,trace_id
  ) values(
    v_idempotency_key,v_request_hash,v_target_opening_id,v_business_number||'-OPEN',v_target_node_id,v_target_line_id,
    v_target_realm_id,v_target_membership_id,v_requested_by,v_target_mall_id,v_target_operating_entity_id,
    null,null,'L0',v_source.host_sovereign_node_id,'hosted','operating_mall',1,1,1,1,1,1,
    'pending_bindings',v_mall_name,v_company_name,v_now,v_trace_id
  );
  insert into organization.malloperatingentitybinding(binding_id,opening_id,operating_entity_id,mall_id,node_id,
    membership_id,binding_role,binding_version,effective_at)
  values(v_target_binding_id,v_target_opening_id,v_target_operating_entity_id,v_target_mall_id,v_target_node_id,
    v_target_membership_id,'operator',1,v_now);
  insert into organization.hostedmallconfiguration(configuration_id,opening_id,node_id,mall_id,host_sovereign_node_id,
    configuration_version,capability_version,infrastructure_mode,entry_mode,payment_mode,
    payment_configuration_version,shared_payment_binding_ref,effective_at)
  values(v_target_configuration_id,v_target_opening_id,v_target_node_id,v_target_mall_id,
    v_source.host_sovereign_node_id,1,1,'shared_host','hosted_path','pending_independent_binding',1,null,v_now);
  if v_interrupt='after-configuration' then raise exception 'SFL_COMPANY_TEMPLATE_CLONE_TEST_INTERRUPT'; end if;

  insert into organization.companyclone(
    idempotency_key,request_hash,clone_id,business_number,source_realm_id,source_mall_id,
    source_operating_entity_id,source_line_id,source_node_id,source_membership_id,target_realm_id,target_mall_id,
    target_operating_entity_id,target_line_id,target_node_id,target_membership_id,target_application_id,target_pool_id,
    host_sovereign_node_id,template_snapshot,status,infrastructure_action_count,requested_by,trace_id,created_at
  ) values(
    v_idempotency_key,v_request_hash,v_clone_id,v_business_number,v_source.realm_id,v_source.mall_id,
    v_source.operating_entity_id,v_source.line_id,v_source.node_id,v_source_membership_id,v_target_realm_id,
    v_target_mall_id,v_target_operating_entity_id,v_target_line_id,v_target_node_id,v_target_membership_id,
    v_target_application_id,v_target_pool_id,v_source.host_sovereign_node_id,
    jsonb_build_object('capabilities',v_source.capabilities,'capability_version',v_source.capability_version,
      'catalog_pool_kind',v_source.pool_kind,'catalog_listing_kind',v_source.listing_kind,
      'experience_schema_version',v_source.schema_version,'source_application_id',v_source.application_id),
    'pending_bindings',0,v_requested_by,v_trace_id,v_now
  );
  insert into organization.companyuniquebinding(
    clone_id,target_realm_id,binding_kind,status,binding_version,created_at
  ) select v_clone_id,v_target_realm_id,kind,'pending',1,v_now
  from unnest(array['domain','legal_identity','payment_merchant','payment_secret']::text[]) kind;
  insert into organization.change(id,organization_id,kind,before_value,after_value,actor_id,occurred_at)
  values('change:'||substr(v_identity_hash,1,32),v_target_mall_id,'sfl.company_template.cloned',
    jsonb_build_object('source_realm_id',v_source.realm_id,'source_mall_id',v_source.mall_id),
    jsonb_build_object('clone_id',v_clone_id,'business_number',v_business_number,'target_realm_id',v_target_realm_id,
      'target_mall_id',v_target_mall_id,'target_line_id',v_target_line_id,'target_node_id',v_target_node_id,
      'status','pending_bindings'),v_requested_by,v_now);
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
    occurred_at,available_at)
  values('outbox:'||substr(v_identity_hash,1,32),'runtime.operation.completed',1,'company_clone',v_clone_id,
    v_target_mall_id,jsonb_build_object('operation_id','internal.company-template.clone',
      'clone_id',v_clone_id,'business_number',v_business_number,
      'source_realm_id',v_source.realm_id,'target_realm_id',v_target_realm_id,'target_mall_id',v_target_mall_id,
      'target_operating_entity_id',v_target_operating_entity_id,'target_line_id',v_target_line_id,
      'target_node_id',v_target_node_id,'target_membership_id',v_target_membership_id,
      'status','pending_bindings'),v_trace_id,v_now,v_now);

  return query select cloned.clone_id,cloned.business_number,cloned.source_realm_id,cloned.source_mall_id,
    cloned.source_line_id,cloned.source_node_id,cloned.target_realm_id,cloned.target_mall_id,
    cloned.target_operating_entity_id,cloned.target_line_id,cloned.target_node_id,cloned.target_membership_id,
    cloned.target_application_id,cloned.target_pool_id,cloned.host_sovereign_node_id,cloned.status,
    cloned.infrastructure_action_count,
    to_char(cloned.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),false
  from organization.companyclone cloned where cloned.idempotency_key=v_idempotency_key;
end
$function$;

revoke all on organization.operatingline,organization.companyclone,organization.companyuniquebinding from public;
revoke all on function organization.clone_company_template(jsonb) from public;
grant execute on function organization.clone_company_template(jsonb) to zhudatuanwebapi;

insert into runtime.schemaversion(version,checksum)
values('20260912200000','c68b7a5a79051d781f53f9e4db32c9c52d3c3b899e776b861a96280d6355cf70');

do $assert$
begin
  if to_regclass('organization.operatingline') is null
    or to_regclass('organization.companyclone') is null
    or to_regclass('organization.companyuniquebinding') is null
    or to_regprocedure('organization.clone_company_template(jsonb)') is null
    or has_function_privilege('public','organization.clone_company_template(jsonb)','execute')
    or not has_function_privilege('zhudatuanwebapi','organization.clone_company_template(jsonb)','execute')
    or not exists(select 1 from runtime.schemaversion where version='20260912200000'
      and checksum='c68b7a5a79051d781f53f9e4db32c9c52d3c3b899e776b861a96280d6355cf70') then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
