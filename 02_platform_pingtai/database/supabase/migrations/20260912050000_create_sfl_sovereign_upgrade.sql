begin;

select pg_advisory_xact_lock(hashtext('sfl:sovereign-upgrade:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912040000' and checksum='7df56d02388c9ee15562b3a3b64da7dc69ce516d2bce0f0a46587a3b7a5199e4') then
    raise exception 'SFL_SOVEREIGN_UPGRADE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

do $drop_host_tier_fk$
declare v_constraint text;
begin
  select constraint_name into v_constraint
  from information_schema.constraint_column_usage
  where table_schema='organization' and table_name='node' and column_name='sovereignty_tier'
    and constraint_name in(select constraint_name from information_schema.table_constraints
      where table_schema='organization' and table_name='noderelation' and constraint_type='FOREIGN KEY')
  limit 1;
  if v_constraint is not null then
    execute format('alter table organization.noderelation drop constraint %I',v_constraint);
  end if;
end
$drop_host_tier_fk$;
alter table organization.noderelation add constraint noderelation_host_node_fkey
  foreign key(host_sovereign_node_id,line_id) references organization.node(id,line_id);

create table organization.sovereignupgrade(
  idempotency_key text primary key,
  request_hash char(64) not null,
  upgrade_id text not null unique,
  business_number text not null unique,
  node_id text not null unique,
  line_id text not null,
  realm_id text not null,
  mall_id text not null,
  operating_entity_id text not null,
  membership_id text not null,
  principal_id text not null,
  parent_node_id text,
  original_parent_node_id text,
  signed_level text not null,
  previous_host_sovereign_node_id text not null,
  previous_relation_version bigint not null check(previous_relation_version>0),
  active_relation_version bigint not null check(active_relation_version>previous_relation_version),
  source_tier text not null check(source_tier='hosted'),
  target_tier text not null check(target_tier='sovereign'),
  node_profile text not null check(node_profile='operating_mall'),
  status text not null check(status in('planned','resources_ready','bindings_complete','upgraded','failed','rolled_back')),
  sovereignty_version bigint not null check(sovereignty_version>0),
  domain_binding_set_id text not null unique,
  domain_binding_set_version bigint not null check(domain_binding_set_version>0),
  resource_binding_set_id text not null unique,
  resource_binding_version bigint not null check(resource_binding_version>0),
  manifest_id text not null unique,
  manifest_version bigint not null check(manifest_version>0),
  manifest_digest text not null check(manifest_digest~'^sha256:[0-9a-f]{64}$'),
  manifest_summary jsonb not null,
  recoverable boolean not null,
  upgraded_at timestamptz not null,
  rolled_back_at timestamptz,
  rollback_reason text,
  trace_id text not null,
  foreign key(node_id,line_id) references organization.node(id,line_id),
  foreign key(realm_id) references identity.realm(id),
  foreign key(mall_id) references organization.organization(id),
  foreign key(operating_entity_id) references organization.organization(id),
  foreign key(membership_id) references access.membership(id),
  foreign key(principal_id) references identity.principal(id)
);

create table organization.nodesovereigntyversion(
  node_id text not null,
  sovereignty_version bigint not null,
  upgrade_id text not null unique references organization.sovereignupgrade(upgrade_id),
  source_tier text not null check(source_tier='hosted'),
  target_tier text not null check(target_tier='sovereign'),
  previous_host_sovereign_node_id text not null,
  host_sovereign_node_id text not null,
  previous_relation_version bigint not null,
  active_relation_version bigint not null,
  status text not null check(status in('planned','upgraded','rolled_back')),
  effective_at timestamptz not null,
  rolled_back_at timestamptz,
  primary key(node_id,sovereignty_version),
  foreign key(node_id) references organization.node(id),
  check(host_sovereign_node_id=node_id)
);

create table organization.domainbindingset(
  binding_set_id text not null,
  binding_version bigint not null,
  upgrade_id text not null unique references organization.sovereignupgrade(upgrade_id),
  node_id text not null,
  realm_id text not null,
  status text not null check(status in('candidate','active','rolled_back')),
  activated_at timestamptz,
  rolled_back_at timestamptz,
  primary key(binding_set_id,binding_version),
  foreign key(node_id) references organization.node(id),
  foreign key(realm_id) references identity.realm(id)
);

create table organization.domainbinding(
  binding_set_id text not null,
  binding_version bigint not null,
  surface text not null check(surface in('public_api','storefront','accounts','console','payment_callback')),
  host text not null,
  binding_ref text not null,
  status text not null check(status in('candidate','active','rolled_back')),
  primary key(binding_set_id,binding_version,surface),
  unique(host),
  foreign key(binding_set_id,binding_version) references organization.domainbindingset(binding_set_id,binding_version)
);

create table organization.noderesourcebindingset(
  resource_binding_set_id text not null,
  resource_binding_version bigint not null,
  upgrade_id text not null unique references organization.sovereignupgrade(upgrade_id),
  node_id text not null,
  edge_binding_ref text not null unique,
  tunnel_ref text not null unique,
  gateway_ref text not null unique,
  runtime_identity_ref text not null unique,
  realm_ref text not null unique,
  data_scope_ref text not null unique,
  secret_binding_set_ref text not null unique,
  payment_binding_ref text not null unique,
  callback_binding_ref text not null unique,
  runtime_config_ref text not null unique,
  status text not null check(status in('ready','active','rolled_back')),
  activated_at timestamptz,
  rolled_back_at timestamptz,
  primary key(resource_binding_set_id,resource_binding_version),
  foreign key(node_id) references organization.node(id)
);

create table organization.nodemanifestversion(
  manifest_id text not null,
  manifest_version bigint not null,
  upgrade_id text not null unique references organization.sovereignupgrade(upgrade_id),
  node_id text not null,
  domain_binding_set_id text not null,
  domain_binding_set_version bigint not null,
  resource_binding_set_id text not null,
  resource_binding_version bigint not null,
  manifest_digest text not null check(manifest_digest~'^sha256:[0-9a-f]{64}$'),
  manifest jsonb not null,
  status text not null check(status in('candidate','active','rolled_back')),
  generated_at timestamptz not null,
  activated_at timestamptz,
  rolled_back_at timestamptz,
  primary key(manifest_id,manifest_version),
  foreign key(node_id) references organization.node(id),
  foreign key(domain_binding_set_id,domain_binding_set_version)
    references organization.domainbindingset(binding_set_id,binding_version),
  foreign key(resource_binding_set_id,resource_binding_version)
    references organization.noderesourcebindingset(resource_binding_set_id,resource_binding_version)
);

create unique index organization_nodemanifest_one_active
  on organization.nodemanifestversion(node_id) where status='active';

create table organization.sovereignupgradestep(
  upgrade_id text not null references organization.sovereignupgrade(upgrade_id),
  step text not null check(step in('planned','resources_ready','bindings_complete','upgraded','rolled_back')),
  ordinal smallint not null check(ordinal between 1 and 5),
  completed_at timestamptz not null,
  receipt jsonb not null,
  primary key(upgrade_id,step),
  unique(upgrade_id,ordinal)
);

insert into runtime.operation(id,owner,method,path,contract_version)
values('member.sovereignty.upgrade','member','POST','/api/v1/members/me/sovereignty','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,
  contract_version=excluded.contract_version;
insert into capability.capability(id,kind,name,version,status)
values('member.sovereignty.upgrade','operation','member.sovereignty.upgrade',1,'active')
on conflict(id) do update set status='active';
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('member.sovereignty.upgrade','member.sovereignty.upgrade','member.profile.read','member')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'member-sovereignty-upgrade:'||substr(encode(public.digest(
    entitlement.scope_id||':'||entitlement.effective_at::text,'sha256'),'hex'),1,32),
  entitlement.scope_id,'member.sovereignty.upgrade','enabled',null,entitlement.effective_at,entitlement.expires_at,0
from capability.entitlement entitlement
where entitlement.capability_id='member.malls.open' and entitlement.state='enabled'
on conflict(scope_id,capability_id,effective_at) do nothing;

insert into runtime.event(type,version,owner,schema_ref)
values('sfl.node.sovereignty_upgraded',1,'organization','contract://sfl/node-sovereignty-upgraded/v1')
on conflict(type,version) do nothing;

create function organization.upgrade_hosted_mall_to_sovereign(
  p_membership_id text,p_node_id text,p_request jsonb
)
returns table(
  business_number text,upgrade_id text,idempotency_key text,request_hash text,node_id text,
  membership_id text,principal_id text,mall_id text,operating_entity_id text,realm_id text,line_id text,
  signed_level text,parent_node_id text,original_parent_node_id text,previous_host_sovereign_node_id text,
  host_sovereign_node_id text,source_tier text,target_tier text,node_profile text,status text,
  previous_relation_version bigint,active_relation_version bigint,sovereignty_version bigint,
  domain_binding_set_version bigint,resource_binding_version bigint,manifest_version bigint,
  manifest_digest text,manifest_summary jsonb,recoverable boolean,upgraded_at text,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_key text:=p_request->>'idempotency_key';
  v_hash text;
  v_identity text;
  v_upgrade text;
  v_business text;
  v_binding_set text;
  v_resource_set text;
  v_manifest_id text;
  v_manifest jsonb;
  v_manifest_digest text;
  v_now timestamptz:=clock_timestamp();
  v_context record;
  v_existing organization.sovereignupgrade%rowtype;
  v_interrupt text:=current_setting('sfl.sovereign_upgrade_interrupt',true);
  v_expected_keys text[]:=array[
    'accounts_host','brand_ref','callback_binding_ref','console_host','data_scope_ref','edge_binding_ref',
    'gateway_ref','idempotency_key','payment_binding_ref','payment_callback_host','public_api_host',
    'runtime_config_ref','runtime_identity_ref','secret_binding_set_ref','storefront_host','tunnel_ref'
  ];
begin
  if jsonb_typeof(p_request)<>'object'
    or (select array_agg(key order by key) from jsonb_object_keys(p_request) key)<>v_expected_keys
    or p_membership_id is null or p_membership_id='' or p_node_id is null or p_node_id=''
    or exists(select 1 from jsonb_each_text(p_request) item where item.value='' or item.value<>btrim(item.value))
    or exists(select 1 from unnest(array[p_request->>'public_api_host',p_request->>'storefront_host',
      p_request->>'accounts_host',p_request->>'console_host',p_request->>'payment_callback_host']) host
      where host!~'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')
    or (select count(distinct host) from unnest(array[p_request->>'public_api_host',p_request->>'storefront_host',
      p_request->>'accounts_host',p_request->>'console_host',p_request->>'payment_callback_host']) host)<>5 then
    raise exception 'SFL_SOVEREIGN_UPGRADE_REQUEST_INVALID';
  end if;

  v_hash:=encode(public.digest(convert_to(jsonb_build_object(
    'membership_id',p_membership_id,'node_id',p_node_id,'configuration',p_request-'idempotency_key'
  )::text,'UTF8'),'sha256'),'hex');
  v_identity:=encode(public.digest(convert_to(p_node_id||':'||v_key,'UTF8'),'sha256'),'hex');
  v_upgrade:='sovereign-upgrade:'||substr(v_identity,1,32);
  v_business:='SFLSOV-'||upper(substr(v_identity,1,20));
  v_binding_set:='domain-binding-set:'||substr(v_identity,1,32);
  v_resource_set:='resource-binding-set:'||substr(v_identity,1,32);
  v_manifest_id:='node-manifest:'||substr(v_identity,1,32);

  perform pg_advisory_xact_lock(hashtextextended('sfl:sovereign-upgrade:key:'||v_key,0));
  select upgrade.* into v_existing from organization.sovereignupgrade upgrade where upgrade.idempotency_key=v_key;
  if found then
    if v_existing.request_hash<>v_hash then raise exception 'SFL_SOVEREIGN_UPGRADE_IDEMPOTENCY_KEY_REUSED'; end if;
    return query select upgrade.business_number,upgrade.upgrade_id,upgrade.idempotency_key,upgrade.request_hash::text,
      upgrade.node_id,upgrade.membership_id,upgrade.principal_id,upgrade.mall_id,upgrade.operating_entity_id,
      upgrade.realm_id,upgrade.line_id,upgrade.signed_level,upgrade.parent_node_id,upgrade.original_parent_node_id,
      upgrade.previous_host_sovereign_node_id,upgrade.node_id,upgrade.source_tier,upgrade.target_tier,
      upgrade.node_profile,upgrade.status,upgrade.previous_relation_version,upgrade.active_relation_version,
      upgrade.sovereignty_version,upgrade.domain_binding_set_version,upgrade.resource_binding_version,
      upgrade.manifest_version,upgrade.manifest_digest,upgrade.manifest_summary,upgrade.recoverable,
      to_char(upgrade.upgraded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),true
    from organization.sovereignupgrade upgrade where upgrade.idempotency_key=v_key;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sfl:sovereign-upgrade:node:'||p_node_id,0));
  if exists(select 1 from organization.sovereignupgrade upgrade where upgrade.node_id=p_node_id) then
    raise exception 'SFL_SOVEREIGN_UPGRADE_NODE_ALREADY_CLAIMED';
  end if;

  select node.id node_id,node.line_id,node.realm_id,node.mall_id,node.sovereignty_tier,node.node_profile,
    relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,
    relation.host_sovereign_node_id,relation.relation_version,membership.id membership_id,
    account.legacy_principal_id principal_id,binding.operating_entity_id
  into v_context
  from organization.node node
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  join organization.hostedmallopening opening on opening.node_id=node.id and opening.mall_id=node.mall_id
    and opening.status='active'
  join organization.malloperatingentitybinding binding on binding.opening_id=opening.opening_id
  join access.membership membership on membership.id=p_membership_id and membership.realm_id=node.realm_id
    and membership.status='active' and membership.client='storefront'
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
    and account.status='active'
  where node.id=p_node_id and node.status='active'
  for update of node,relation,membership,account;
  if not found or v_context.sovereignty_tier<>'hosted' or v_context.node_profile<>'operating_mall'
    or v_context.mall_id is null or v_context.host_sovereign_node_id=v_context.node_id then
    raise exception 'SFL_SOVEREIGN_UPGRADE_CONTEXT_INVALID';
  end if;

  v_manifest:=jsonb_build_object(
    'schema_version','sfl.node-manifest.sovereign.v2','manifest_id',v_manifest_id,'manifest_version',1,
    'node_id',v_context.node_id,'line_id',v_context.line_id,'realm_id',v_context.realm_id,
    'mall_id',v_context.mall_id,'operating_entity_id',v_context.operating_entity_id,
    'parent_node_id',v_context.parent_node_id,'original_parent_node_id',v_context.original_parent_node_id,
    'signed_level',v_context.signed_level,'node_profile','operating_mall','sovereignty_tier','sovereign',
    'brand_ref',p_request->>'brand_ref','domain_binding_set_ref',v_binding_set,
    'resource_binding_set_ref',v_resource_set,'realm_ref','realm:'||v_context.realm_id,
    'data_scope_ref',p_request->>'data_scope_ref','secret_binding_set_ref',p_request->>'secret_binding_set_ref',
    'payment_binding_ref',p_request->>'payment_binding_ref','callback_binding_ref',p_request->>'callback_binding_ref',
    'runtime_identity_ref',p_request->>'runtime_identity_ref','runtime_config_ref',p_request->>'runtime_config_ref',
    'release_pointer_ref',null,
    'domain_bindings',jsonb_build_object(
      'public_api',p_request->>'public_api_host','storefront',p_request->>'storefront_host',
      'accounts',p_request->>'accounts_host','console',p_request->>'console_host',
      'payment_callback',p_request->>'payment_callback_host'));
  v_manifest_digest:='sha256:'||encode(public.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');

  insert into organization.sovereignupgrade(
    idempotency_key,request_hash,upgrade_id,business_number,node_id,line_id,realm_id,mall_id,operating_entity_id,
    membership_id,principal_id,parent_node_id,original_parent_node_id,signed_level,previous_host_sovereign_node_id,
    previous_relation_version,active_relation_version,source_tier,target_tier,node_profile,status,sovereignty_version,
    domain_binding_set_id,domain_binding_set_version,resource_binding_set_id,resource_binding_version,
    manifest_id,manifest_version,manifest_digest,manifest_summary,recoverable,upgraded_at,trace_id
  ) values(
    v_key,v_hash,v_upgrade,v_business,p_node_id,v_context.line_id,v_context.realm_id,v_context.mall_id,
    v_context.operating_entity_id,p_membership_id,v_context.principal_id,v_context.parent_node_id,
    v_context.original_parent_node_id,v_context.signed_level,v_context.host_sovereign_node_id,
    v_context.relation_version,v_context.relation_version+1,'hosted','sovereign','operating_mall','planned',1,
    v_binding_set,1,v_resource_set,1,v_manifest_id,1,v_manifest_digest,
    jsonb_build_object('schema_version','sfl.node-manifest.sovereign.v2','surface_count',5,
      'domain_binding_set_id',v_binding_set,'resource_binding_set_id',v_resource_set,
      'release_pointer_ref',null),true,v_now,
    coalesce(current_setting('request.trace_id',true),'sovereign-upgrade:'||v_upgrade)
  );
  insert into organization.nodesovereigntyversion values(
    p_node_id,1,v_upgrade,'hosted','sovereign',v_context.host_sovereign_node_id,p_node_id,
    v_context.relation_version,v_context.relation_version+1,'planned',v_now,null);
  insert into organization.sovereignupgradestep values(
    v_upgrade,'planned',1,v_now,jsonb_build_object('source_tier','hosted','target_tier','sovereign'));
  if v_interrupt='after-plan' then raise exception 'SFL_SOVEREIGN_UPGRADE_TEST_INTERRUPT'; end if;

  insert into organization.domainbindingset values(v_binding_set,1,v_upgrade,p_node_id,v_context.realm_id,'candidate',null,null);
  insert into organization.domainbinding(binding_set_id,binding_version,surface,host,binding_ref,status)
  select v_binding_set,1,binding.surface,binding.host,
    'domain-binding:'||substr(v_identity,1,16)||':'||binding.surface,'candidate'
  from (values
    ('public_api',p_request->>'public_api_host'),('storefront',p_request->>'storefront_host'),
    ('accounts',p_request->>'accounts_host'),('console',p_request->>'console_host'),
    ('payment_callback',p_request->>'payment_callback_host')
  ) binding(surface,host);
  insert into organization.noderesourcebindingset values(
    v_resource_set,1,v_upgrade,p_node_id,p_request->>'edge_binding_ref',p_request->>'tunnel_ref',
    p_request->>'gateway_ref',p_request->>'runtime_identity_ref','realm:'||v_context.realm_id,
    p_request->>'data_scope_ref',p_request->>'secret_binding_set_ref',p_request->>'payment_binding_ref',
    p_request->>'callback_binding_ref',p_request->>'runtime_config_ref','ready',null,null);
  update organization.sovereignupgrade upgrade set status='resources_ready' where upgrade.upgrade_id=v_upgrade;
  insert into organization.sovereignupgradestep values(
    v_upgrade,'resources_ready',2,v_now,jsonb_build_object('domain_binding_set_id',v_binding_set,'resource_binding_set_id',v_resource_set));
  if v_interrupt='after-resources' then raise exception 'SFL_SOVEREIGN_UPGRADE_TEST_INTERRUPT'; end if;

  insert into organization.nodemanifestversion values(
    v_manifest_id,1,v_upgrade,p_node_id,v_binding_set,1,v_resource_set,1,v_manifest_digest,v_manifest,
    'candidate',v_now,null,null);
  update organization.sovereignupgrade upgrade set status='bindings_complete' where upgrade.upgrade_id=v_upgrade;
  insert into organization.sovereignupgradestep values(
    v_upgrade,'bindings_complete',3,v_now,jsonb_build_object('manifest_id',v_manifest_id,'manifest_digest',v_manifest_digest));
  if v_interrupt='after-manifest' then raise exception 'SFL_SOVEREIGN_UPGRADE_TEST_INTERRUPT'; end if;

  update organization.node node set sovereignty_tier='sovereign',updated_at=v_now where node.id=p_node_id;
  update organization.noderelation relation set superseded_at=v_now
  where relation.line_id=v_context.line_id and relation.node_id=p_node_id
    and relation.relation_version=v_context.relation_version;
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    relation_version,effective_at
  ) values(
    v_context.line_id,p_node_id,v_context.parent_node_id,v_context.original_parent_node_id,
    v_context.signed_level,p_node_id,v_context.relation_version+1,v_now);
  update identity.realm set host_node_id=null,host_node_profile=null,updated_at=v_now,version=version+1
  where id=v_context.realm_id;
  if v_interrupt='before-finalize' then raise exception 'SFL_SOVEREIGN_UPGRADE_TEST_INTERRUPT'; end if;

  update organization.domainbindingset binding_set set status='active',activated_at=v_now where binding_set.upgrade_id=v_upgrade;
  update organization.domainbinding binding set status='active'
    where binding.binding_set_id=v_binding_set and binding.binding_version=1;
  update organization.noderesourcebindingset binding_set set status='active',activated_at=v_now where binding_set.upgrade_id=v_upgrade;
  update organization.nodemanifestversion manifest set status='active',activated_at=v_now where manifest.upgrade_id=v_upgrade;
  update organization.nodesovereigntyversion version set status='upgraded' where version.upgrade_id=v_upgrade;
  update organization.sovereignupgrade upgrade set status='upgraded' where upgrade.upgrade_id=v_upgrade;
  insert into organization.sovereignupgradestep values(
    v_upgrade,'upgraded',4,v_now,jsonb_build_object('host_sovereign_node_id',p_node_id,'active_relation_version',v_context.relation_version+1));

  insert into organization.change(id,organization_id,kind,before_value,after_value,actor_id,occurred_at)
  values('change:'||substr(v_identity,1,32),v_context.mall_id,'sfl.node.sovereignty_upgraded',
    jsonb_build_object('sovereignty_tier','hosted','host_sovereign_node_id',v_context.host_sovereign_node_id,
      'relation_version',v_context.relation_version),
    jsonb_build_object('sovereignty_tier','sovereign','host_sovereign_node_id',p_node_id,
      'relation_version',v_context.relation_version+1,'manifest_digest',v_manifest_digest),v_context.principal_id,v_now);
  insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values(
    'outbox:'||substr(v_identity,1,32),'sfl.node.sovereignty_upgraded',1,'node',p_node_id,v_context.mall_id,
    jsonb_build_object('upgrade_id',v_upgrade,'business_number',v_business,'node_id',p_node_id,
      'mall_id',v_context.mall_id,'realm_id',v_context.realm_id,'source_tier','hosted','target_tier','sovereign',
      'manifest_id',v_manifest_id,'manifest_digest',v_manifest_digest,'resource_binding_set_id',v_resource_set),
    coalesce(current_setting('request.trace_id',true),'sovereign-upgrade:'||v_upgrade),v_now,v_now);

  return query select upgrade.business_number,upgrade.upgrade_id,upgrade.idempotency_key,upgrade.request_hash::text,
    upgrade.node_id,upgrade.membership_id,upgrade.principal_id,upgrade.mall_id,upgrade.operating_entity_id,
    upgrade.realm_id,upgrade.line_id,upgrade.signed_level,upgrade.parent_node_id,upgrade.original_parent_node_id,
    upgrade.previous_host_sovereign_node_id,upgrade.node_id,upgrade.source_tier,upgrade.target_tier,
    upgrade.node_profile,upgrade.status,upgrade.previous_relation_version,upgrade.active_relation_version,
    upgrade.sovereignty_version,upgrade.domain_binding_set_version,upgrade.resource_binding_version,
    upgrade.manifest_version,upgrade.manifest_digest,upgrade.manifest_summary,upgrade.recoverable,
    to_char(upgrade.upgraded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),false
  from organization.sovereignupgrade upgrade where upgrade.upgrade_id=v_upgrade;
end
$function$;

create function organization.rollback_sovereign_upgrade(p_upgrade_id text,p_reason text)
returns text language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare v_upgrade organization.sovereignupgrade%rowtype; v_now timestamptz:=clock_timestamp();
begin
  select * into v_upgrade from organization.sovereignupgrade where upgrade_id=p_upgrade_id for update;
  if not found then raise exception 'SFL_SOVEREIGN_UPGRADE_UNKNOWN'; end if;
  if v_upgrade.status='rolled_back' then return 'rolled_back'; end if;
  if v_upgrade.status<>'upgraded' then raise exception 'SFL_SOVEREIGN_UPGRADE_NOT_ACTIVE'; end if;
  update organization.noderelation set superseded_at=v_now
  where line_id=v_upgrade.line_id and node_id=v_upgrade.node_id and superseded_at is null;
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    relation_version,effective_at
  ) values(
    v_upgrade.line_id,v_upgrade.node_id,v_upgrade.parent_node_id,v_upgrade.original_parent_node_id,
    v_upgrade.signed_level,v_upgrade.previous_host_sovereign_node_id,v_upgrade.active_relation_version+1,v_now);
  update organization.node set sovereignty_tier='hosted',updated_at=v_now where id=v_upgrade.node_id;
  update identity.realm set host_node_id=v_upgrade.previous_host_sovereign_node_id,
    host_node_profile='operating_mall',updated_at=v_now,version=version+1 where id=v_upgrade.realm_id;
  update organization.domainbindingset set status='rolled_back',rolled_back_at=v_now where upgrade_id=p_upgrade_id;
  update organization.domainbinding set status='rolled_back'
    where binding_set_id=v_upgrade.domain_binding_set_id and binding_version=v_upgrade.domain_binding_set_version;
  update organization.noderesourcebindingset set status='rolled_back',rolled_back_at=v_now where upgrade_id=p_upgrade_id;
  update organization.nodemanifestversion set status='rolled_back',rolled_back_at=v_now where upgrade_id=p_upgrade_id;
  update organization.nodesovereigntyversion set status='rolled_back',rolled_back_at=v_now where upgrade_id=p_upgrade_id;
  update organization.sovereignupgrade set status='rolled_back',rolled_back_at=v_now,rollback_reason=p_reason
    where upgrade_id=p_upgrade_id;
  insert into organization.sovereignupgradestep values(
    p_upgrade_id,'rolled_back',5,v_now,jsonb_build_object('reason',p_reason,'restored_host_sovereign_node_id',v_upgrade.previous_host_sovereign_node_id));
  return 'rolled_back';
end
$function$;

revoke all on organization.sovereignupgrade,organization.nodesovereigntyversion,
  organization.domainbindingset,organization.domainbinding,organization.noderesourcebindingset,
  organization.nodemanifestversion,organization.sovereignupgradestep from public;
revoke all on function organization.upgrade_hosted_mall_to_sovereign(text,text,jsonb),
  organization.rollback_sovereign_upgrade(text,text) from public;
grant usage on schema organization to zhudatuanwebapi;
grant execute on function organization.upgrade_hosted_mall_to_sovereign(text,text,jsonb) to zhudatuanwebapi;

insert into runtime.schemaversion(version,checksum)
values('20260912050000','1cd685bc700d26773ffd1c5937c908cb5bff4d61d7c2c07a185da16dc7d5f899');

do $assert$
begin
  if to_regclass('organization.sovereignupgrade') is null
    or to_regclass('organization.nodesovereigntyversion') is null
    or to_regclass('organization.domainbindingset') is null
    or to_regclass('organization.domainbinding') is null
    or to_regclass('organization.noderesourcebindingset') is null
    or to_regclass('organization.nodemanifestversion') is null
    or to_regclass('organization.sovereignupgradestep') is null
    or to_regprocedure('organization.upgrade_hosted_mall_to_sovereign(text,text,jsonb)') is null
    or has_function_privilege('public','organization.upgrade_hosted_mall_to_sovereign(text,text,jsonb)','execute')
    or not has_function_privilege('zhudatuanwebapi','organization.upgrade_hosted_mall_to_sovereign(text,text,jsonb)','execute')
    or has_function_privilege('zhudatuanwebapi','organization.rollback_sovereign_upgrade(text,text)','execute')
    or not exists(select 1 from runtime.schemaversion where version='20260912050000'
      and checksum='1cd685bc700d26773ffd1c5937c908cb5bff4d61d7c2c07a185da16dc7d5f899') then
    raise exception 'SFL_SOVEREIGN_UPGRADE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
