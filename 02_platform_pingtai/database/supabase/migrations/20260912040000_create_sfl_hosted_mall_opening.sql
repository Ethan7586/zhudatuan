begin;

select pg_advisory_xact_lock(hashtext('sfl:hosted-mall-opening:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912030000' and checksum='697017d7e4f14820baa7be131b8f894fd62c9389795ad4d2989ae2560810f0a0') then
    raise exception 'SFL_HOSTED_MALL_OPENING_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table identity.realm drop constraint identity_realm_node_profile_shape;
alter table identity.realm add constraint identity_realm_node_profile_shape check(
  (node_profile='operating_mall' and mall_id is not null and (
    (host_node_id is null and host_node_profile is null)
    or (host_node_id is not null and host_node_profile='operating_mall' and host_node_id<>node_id)
  ))
  or (node_profile='consumer' and mall_id is null and host_node_id is not null
    and host_node_profile='operating_mall' and host_node_id<>node_id)
);
alter table identity.realmtarget drop constraint identity_realmtarget_realm_profile;
alter table identity.realmtarget add constraint identity_realmtarget_realm_profile
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile)
  deferrable initially deferred;
alter table access.membership drop constraint access_membership_realm_profile;
alter table access.membership add constraint access_membership_realm_profile
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile)
  deferrable initially deferred;

create table organization.nodecapabilityversion(
  node_id text not null,
  line_id text not null,
  capability_version bigint not null check(capability_version>0),
  capabilities text[] not null check(cardinality(capabilities)>0 and capabilities<@array['consumer','operating_mall']::text[]),
  prior_node_profile text not null check(prior_node_profile in('consumer','operating_mall')),
  node_profile text not null check(node_profile in('consumer','operating_mall')),
  relation_version bigint not null check(relation_version>0),
  source_operation_id text not null,
  opening_id text,
  effective_at timestamptz not null,
  created_at timestamptz not null,
  primary key(node_id,capability_version),
  unique(opening_id),
  foreign key(node_id,line_id) references organization.node(id,line_id),
  foreign key(line_id,node_id,relation_version) references organization.noderelation(line_id,node_id,relation_version),
  check((opening_id is null and capability_version=1) or opening_id is not null)
);

insert into organization.nodecapabilityversion(
  node_id,line_id,capability_version,capabilities,prior_node_profile,node_profile,relation_version,
  source_operation_id,effective_at,created_at
)
select node.id,node.line_id,1,array[node.node_profile],node.node_profile,node.node_profile,
  relation.relation_version,'sfl.node-capability.baseline',relation.effective_at,clock_timestamp()
from organization.node node
join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
  and relation.superseded_at is null;

create function organization.initialize_node_capability_version()
returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
declare v_node organization.node%rowtype;
begin
  select node.* into v_node from organization.node node
  where node.line_id=new.line_id and node.id=new.node_id;
  if found then
    insert into organization.nodecapabilityversion(
      node_id,line_id,capability_version,capabilities,prior_node_profile,node_profile,relation_version,
      source_operation_id,effective_at,created_at
    ) values(
      v_node.id,v_node.line_id,1,array[v_node.node_profile],v_node.node_profile,v_node.node_profile,new.relation_version,
      'sfl.node-capability.baseline',new.effective_at,clock_timestamp()
    ) on conflict(node_id,capability_version) do nothing;
  end if;
  return new;
end
$function$;

create trigger node_capability_version_initialize
after insert on organization.noderelation
for each row when(new.relation_version=1)
execute function organization.initialize_node_capability_version();

create table organization.hostedmallopening(
  idempotency_key text primary key,
  request_hash char(64) not null,
  opening_id text not null unique,
  business_number text not null unique,
  node_id text not null unique,
  line_id text not null,
  realm_id text not null,
  membership_id text not null,
  principal_id text not null,
  mall_id text not null unique,
  operating_entity_id text not null unique,
  parent_node_id text,
  original_parent_node_id text,
  signed_level text not null,
  host_sovereign_node_id text not null,
  sovereignty_tier text not null check(sovereignty_tier='hosted'),
  node_profile text not null check(node_profile='operating_mall'),
  capability_version bigint not null,
  relation_version bigint not null,
  mall_version bigint not null check(mall_version=1),
  entity_binding_version bigint not null check(entity_binding_version=1),
  configuration_version bigint not null check(configuration_version=1),
  payment_configuration_version bigint not null check(payment_configuration_version=1),
  status text not null check(status='active'),
  mall_name text not null,
  operating_entity_name text not null,
  opened_at timestamptz not null,
  trace_id text not null,
  foreign key(node_id,line_id) references organization.node(id,line_id),
  foreign key(node_id,capability_version) references organization.nodecapabilityversion(node_id,capability_version),
  foreign key(line_id,node_id,relation_version) references organization.noderelation(line_id,node_id,relation_version),
  foreign key(realm_id) references identity.realm(id),
  foreign key(membership_id) references access.membership(id),
  foreign key(principal_id) references identity.principal(id),
  foreign key(mall_id) references organization.organization(id),
  foreign key(operating_entity_id) references organization.organization(id)
);

create table organization.malloperatingentitybinding(
  binding_id text primary key,
  opening_id text not null unique references organization.hostedmallopening(opening_id),
  operating_entity_id text not null references organization.organization(id),
  mall_id text not null unique references organization.organization(id),
  node_id text not null,
  membership_id text not null references access.membership(id),
  binding_role text not null check(binding_role='operator'),
  binding_version bigint not null check(binding_version=1),
  effective_at timestamptz not null,
  unique(operating_entity_id,mall_id,binding_version),
  foreign key(node_id) references organization.node(id)
);

create table organization.hostedmallconfiguration(
  configuration_id text primary key,
  opening_id text not null unique references organization.hostedmallopening(opening_id),
  node_id text not null unique references organization.node(id),
  mall_id text not null unique references organization.organization(id),
  host_sovereign_node_id text not null references organization.node(id),
  configuration_version bigint not null check(configuration_version=1),
  capability_version bigint not null,
  infrastructure_mode text not null check(infrastructure_mode='shared_host'),
  entry_mode text not null check(entry_mode='hosted_path'),
  payment_mode text not null check(payment_mode='host_shared_reference'),
  payment_configuration_version bigint not null check(payment_configuration_version=1),
  shared_payment_binding_ref text not null,
  effective_at timestamptz not null,
  foreign key(node_id,capability_version) references organization.nodecapabilityversion(node_id,capability_version)
);

insert into runtime.operation(id,owner,method,path,contract_version)
values('member.malls.open','member','POST','/api/v1/members/me/mall','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,
  contract_version=excluded.contract_version;
insert into capability.capability(id,kind,name,version,status)
values('member.malls.open','operation','member.malls.open',1,'active')
on conflict(id) do update set status='active';
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('member.malls.open','member.malls.open','member.profile.read','member')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'member-mall-open:'||substr(encode(public.digest(
    entitlement.scope_id||':'||entitlement.effective_at::text,'sha256'),'hex'),1,32),
  entitlement.scope_id,'member.malls.open','enabled',null,entitlement.effective_at,entitlement.expires_at,0
from capability.entitlement entitlement
where entitlement.capability_id='member.profile.read' and entitlement.state='enabled'
on conflict(scope_id,capability_id,effective_at) do nothing;

insert into runtime.event(type,version,owner,schema_ref)
values('sfl.hosted_mall.opened',1,'organization','contract://sfl/hosted-mall-opened/v1')
on conflict(type,version) do nothing;

create function organization.open_hosted_member_mall(
  p_membership_id text,p_node_id text,p_request jsonb
)
returns table(
  opening_id text,business_number text,idempotency_key text,request_hash text,
  node_id text,membership_id text,principal_id text,mall_id text,operating_entity_id text,
  realm_id text,line_id text,signed_level text,parent_node_id text,original_parent_node_id text,
  host_sovereign_node_id text,sovereignty_tier text,node_profile text,capabilities text[],
  capability_version bigint,relation_version bigint,mall_version bigint,entity_binding_version bigint,
  configuration_version bigint,payment_configuration_version bigint,status text,opened_at text,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_idempotency_key text:=p_request->>'idempotency_key';
  v_mall_name text:=p_request->>'mall_name';
  v_operating_entity_name text:=p_request->>'operating_entity_name';
  v_request_hash text;
  v_identity_hash text;
  v_opening_id text;
  v_business_number text;
  v_mall_id text;
  v_operating_entity_id text;
  v_binding_id text;
  v_configuration_id text;
  v_now timestamptz:=transaction_timestamp();
  v_context record;
  v_previous_capability organization.nodecapabilityversion%rowtype;
  v_capabilities text[];
  v_capability_version bigint;
  v_existing organization.hostedmallopening%rowtype;
  v_interrupt text:=current_setting('sfl.hosted_mall_opening_interrupt',true);
begin
  if jsonb_typeof(p_request)<>'object'
    or (select array_agg(key order by key) from jsonb_object_keys(p_request) key)
      <>array['idempotency_key','mall_name','operating_entity_name']::text[]
    or p_membership_id is null or p_membership_id='' or p_membership_id<>btrim(p_membership_id)
    or p_node_id is null or p_node_id='' or p_node_id<>btrim(p_node_id)
    or v_idempotency_key is null or v_idempotency_key='' or v_idempotency_key<>btrim(v_idempotency_key)
    or length(v_idempotency_key)>255
    or v_mall_name is null or v_mall_name='' or v_mall_name<>btrim(v_mall_name) or length(v_mall_name)>128
    or v_operating_entity_name is null or v_operating_entity_name=''
    or v_operating_entity_name<>btrim(v_operating_entity_name) or length(v_operating_entity_name)>128 then
    raise exception 'SFL_HOSTED_MALL_OPENING_REQUEST_INVALID';
  end if;

  v_request_hash:=encode(public.digest(convert_to(jsonb_build_object(
    'membership_id',p_membership_id,'node_id',p_node_id,'mall_name',v_mall_name,
    'operating_entity_name',v_operating_entity_name
  )::text,'UTF8'),'sha256'),'hex');
  v_identity_hash:=encode(public.digest(convert_to(p_node_id||':'||v_idempotency_key,'UTF8'),'sha256'),'hex');
  v_opening_id:='opening:'||substr(v_identity_hash,1,32);
  v_business_number:='SFLMALL-'||upper(substr(v_identity_hash,1,20));
  v_mall_id:='mall:'||substr(v_identity_hash,1,32);
  v_operating_entity_id:='enterprise:'||substr(v_identity_hash,1,32);
  v_binding_id:='entity-binding:'||substr(v_identity_hash,1,32);
  v_configuration_id:='hosted-config:'||substr(v_identity_hash,1,32);

  perform pg_advisory_xact_lock(hashtextextended('sfl:hosted-mall-opening:idempotency:'||v_idempotency_key,0));
  select opening.* into v_existing from organization.hostedmallopening opening
  where opening.idempotency_key=v_idempotency_key;
  if found then
    if v_existing.request_hash<>v_request_hash then
      raise exception 'SFL_HOSTED_MALL_OPENING_IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select opening.opening_id,opening.business_number,opening.idempotency_key,
      opening.request_hash::text,opening.node_id,opening.membership_id,opening.principal_id,opening.mall_id,
      opening.operating_entity_id,opening.realm_id,opening.line_id,opening.signed_level,opening.parent_node_id,
      opening.original_parent_node_id,opening.host_sovereign_node_id,opening.sovereignty_tier,opening.node_profile,
      capability.capabilities,opening.capability_version,opening.relation_version,opening.mall_version,
      opening.entity_binding_version,opening.configuration_version,opening.payment_configuration_version,
      opening.status,to_char(opening.opened_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),true
    from organization.hostedmallopening opening
    join organization.nodecapabilityversion capability on capability.node_id=opening.node_id
      and capability.capability_version=opening.capability_version
    where opening.idempotency_key=v_idempotency_key;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sfl:hosted-mall-opening:node:'||p_node_id,0));
  if exists(select 1 from organization.hostedmallopening opening where opening.node_id=p_node_id) then
    raise exception 'SFL_HOSTED_MALL_ALREADY_OPEN';
  end if;

  select node.id node_id,node.line_id,node.realm_id,node.sovereignty_tier,node.node_profile,node.mall_id,
    relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,
    relation.host_sovereign_node_id,relation.relation_version,membership.id membership_id,
    membership.organization_id,account.legacy_principal_id principal_id
  into v_context
  from access.membership membership
  join identity.realm realm on realm.id=membership.realm_id and realm.status='active'
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
    and account.status='active'
  join identity.principal principal on principal.id=account.legacy_principal_id and principal.status='active'
  join organization.node node on node.realm_id=realm.id and node.id=p_node_id and node.status='active'
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  where membership.id=p_membership_id and membership.status='active' and membership.client='storefront'
  for update of membership,realm,account,node;
  if not found or v_context.sovereignty_tier<>'hosted' or v_context.node_profile<>'consumer'
    or v_context.mall_id is not null or v_context.host_sovereign_node_id=v_context.node_id then
    raise exception 'SFL_HOSTED_MALL_OPENING_CONTEXT_INVALID';
  end if;

  select capability.* into v_previous_capability from organization.nodecapabilityversion capability
  where capability.node_id=p_node_id order by capability.capability_version desc limit 1 for update;
  if not found or not('consumer'=any(v_previous_capability.capabilities)) then
    raise exception 'SFL_HOSTED_MALL_OPENING_CAPABILITY_INVALID';
  end if;
  v_capability_version:=v_previous_capability.capability_version+1;
  v_capabilities:=array(select distinct capability from unnest(
    v_previous_capability.capabilities||array['operating_mall']::text[]) capability
    order by capability);

  insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
  values(v_operating_entity_id,'enterprise',v_context.organization_id,v_operating_entity_name,'Asia/Shanghai','active',1,v_now,v_now);
  insert into organization.unitclosure(ancestor_id,descendant_id,depth)
  select closure.ancestor_id,v_operating_entity_id,closure.depth+1 from organization.unitclosure closure
  where closure.descendant_id=v_context.organization_id
  union all select v_operating_entity_id,v_operating_entity_id,0;
  insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
  values(v_mall_id,'mall',v_operating_entity_id,v_mall_name,'Asia/Shanghai','active',1,v_now,v_now);
  insert into organization.unitclosure(ancestor_id,descendant_id,depth)
  select closure.ancestor_id,v_mall_id,closure.depth+1 from organization.unitclosure closure
  where closure.descendant_id=v_operating_entity_id
  union all select v_mall_id,v_mall_id,0;
  if v_interrupt='after-organizations' then raise exception 'SFL_HOSTED_MALL_OPENING_TEST_INTERRUPT'; end if;

  insert into organization.nodecapabilityversion(
    node_id,line_id,capability_version,capabilities,prior_node_profile,node_profile,relation_version,
    source_operation_id,opening_id,effective_at,created_at
  ) values(
    p_node_id,v_context.line_id,v_capability_version,v_capabilities,v_context.node_profile,'operating_mall',
    v_context.relation_version,'member.malls.open',v_opening_id,v_now,v_now
  );
  set constraints identity.identity_realmtarget_realm_profile,access.access_membership_realm_profile deferred;
  update identity.realm set node_profile='operating_mall',mall_id=v_mall_id,updated_at=v_now,version=version+1
  where id=v_context.realm_id;
  update identity.realmtarget target set node_profile='operating_mall' where target.realm_id=v_context.realm_id;
  update access.membership member_identity set node_profile='operating_mall'
  where member_identity.realm_id=v_context.realm_id;
  update organization.node set node_profile='operating_mall',mall_id=v_mall_id,updated_at=v_now where id=p_node_id;
  if v_interrupt='after-capability' then raise exception 'SFL_HOSTED_MALL_OPENING_TEST_INTERRUPT'; end if;

  insert into organization.hostedmallopening(
    idempotency_key,request_hash,opening_id,business_number,node_id,line_id,realm_id,membership_id,principal_id,
    mall_id,operating_entity_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    sovereignty_tier,node_profile,capability_version,relation_version,mall_version,entity_binding_version,
    configuration_version,payment_configuration_version,status,mall_name,operating_entity_name,opened_at,trace_id
  ) values(
    v_idempotency_key,v_request_hash,v_opening_id,v_business_number,p_node_id,v_context.line_id,v_context.realm_id,
    p_membership_id,v_context.principal_id,v_mall_id,v_operating_entity_id,v_context.parent_node_id,
    v_context.original_parent_node_id,v_context.signed_level,v_context.host_sovereign_node_id,'hosted','operating_mall',
    v_capability_version,v_context.relation_version,1,1,1,1,'active',v_mall_name,v_operating_entity_name,v_now,
    coalesce(current_setting('request.trace_id',true),'hosted-mall-opening:'||v_opening_id)
  );
  insert into organization.malloperatingentitybinding(
    binding_id,opening_id,operating_entity_id,mall_id,node_id,membership_id,binding_role,binding_version,effective_at
  ) values(v_binding_id,v_opening_id,v_operating_entity_id,v_mall_id,p_node_id,p_membership_id,'operator',1,v_now);
  insert into organization.hostedmallconfiguration(
    configuration_id,opening_id,node_id,mall_id,host_sovereign_node_id,configuration_version,capability_version,
    infrastructure_mode,entry_mode,payment_mode,payment_configuration_version,shared_payment_binding_ref,effective_at
  ) values(
    v_configuration_id,v_opening_id,p_node_id,v_mall_id,v_context.host_sovereign_node_id,1,v_capability_version,
    'shared_host','hosted_path','host_shared_reference',1,
    'host-sovereign-node:'||v_context.host_sovereign_node_id||':payment',v_now
  );
  if v_interrupt='after-config' then raise exception 'SFL_HOSTED_MALL_OPENING_TEST_INTERRUPT'; end if;

  insert into organization.change(id,organization_id,kind,before_value,after_value,actor_id,occurred_at)
  values(
    'change:'||substr(v_identity_hash,1,32),v_mall_id,'sfl.hosted_mall.opened',
    jsonb_build_object('node_profile','consumer','mall_id',null,'capability_version',v_previous_capability.capability_version),
    jsonb_build_object('node_profile','operating_mall','mall_id',v_mall_id,'capability_version',v_capability_version,
      'host_sovereign_node_id',v_context.host_sovereign_node_id),v_context.principal_id,v_now
  );
  insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values(
    'outbox:'||substr(v_identity_hash,1,32),'sfl.hosted_mall.opened',1,'node',p_node_id,v_mall_id,
    jsonb_build_object('opening_id',v_opening_id,'business_number',v_business_number,'node_id',p_node_id,
      'membership_id',p_membership_id,'mall_id',v_mall_id,'operating_entity_id',v_operating_entity_id,
      'realm_id',v_context.realm_id,'line_id',v_context.line_id,'signed_level',v_context.signed_level,
      'host_sovereign_node_id',v_context.host_sovereign_node_id,'sovereignty_tier','hosted',
      'node_profile','operating_mall','capability_version',v_capability_version),
    coalesce(current_setting('request.trace_id',true),'hosted-mall-opening:'||v_opening_id),v_now,v_now
  );

  return query select opening.opening_id,opening.business_number,opening.idempotency_key,
    opening.request_hash::text,opening.node_id,opening.membership_id,opening.principal_id,opening.mall_id,
    opening.operating_entity_id,opening.realm_id,opening.line_id,opening.signed_level,opening.parent_node_id,
    opening.original_parent_node_id,opening.host_sovereign_node_id,opening.sovereignty_tier,opening.node_profile,
    capability.capabilities,opening.capability_version,opening.relation_version,opening.mall_version,
    opening.entity_binding_version,opening.configuration_version,opening.payment_configuration_version,
    opening.status,to_char(opening.opened_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),false
  from organization.hostedmallopening opening
  join organization.nodecapabilityversion capability on capability.node_id=opening.node_id
    and capability.capability_version=opening.capability_version
  where opening.idempotency_key=v_idempotency_key;
end
$function$;

revoke all on organization.nodecapabilityversion,organization.hostedmallopening,
  organization.malloperatingentitybinding,organization.hostedmallconfiguration from public;
revoke all on function organization.open_hosted_member_mall(text,text,jsonb) from public;
grant usage on schema organization to zhudatuanwebapi;
grant execute on function organization.open_hosted_member_mall(text,text,jsonb) to zhudatuanwebapi;

insert into runtime.schemaversion(version,checksum)
values('20260912040000','7df56d02388c9ee15562b3a3b64da7dc69ce516d2bce0f0a46587a3b7a5199e4');

do $assert$
begin
  if to_regclass('organization.hostedmallopening') is null
    or to_regclass('organization.nodecapabilityversion') is null
    or to_regclass('organization.malloperatingentitybinding') is null
    or to_regclass('organization.hostedmallconfiguration') is null
    or to_regprocedure('organization.open_hosted_member_mall(text,text,jsonb)') is null
    or has_function_privilege('public','organization.open_hosted_member_mall(text,text,jsonb)','execute')
    or not has_function_privilege('zhudatuanwebapi','organization.open_hosted_member_mall(text,text,jsonb)','execute')
    or has_table_privilege('zhudatuanwebapi','organization.hostedmallopening','select,insert,update,delete')
    or not exists(select 1 from runtime.schemaversion where version='20260912040000'
      and checksum='7df56d02388c9ee15562b3a3b64da7dc69ce516d2bce0f0a46587a3b7a5199e4') then
    raise exception 'SFL_HOSTED_MALL_OPENING_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
