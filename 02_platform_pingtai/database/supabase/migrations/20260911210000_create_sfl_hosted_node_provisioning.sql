begin;

select pg_advisory_xact_lock(hashtext('sfl:hosted-node-provisioning:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260911200000' and checksum='274fbae4f0176717cba91b800040d830952b9326b1a629f2af1f73ad5de4f419') then
    raise exception 'SFL_HOSTED_NODE_PROVISIONING_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create table organization.hostednodeprovisioning(
  idempotency_key text primary key,
  request_hash char(64) not null,
  node_id text not null unique,
  line_id text not null,
  parent_node_id text not null,
  realm_id text not null,
  node_profile text not null check(node_profile in('operating_mall','consumer')),
  mall_id text,
  signed_level text not null check(signed_level~'^L([1-9]|10|11)$'),
  host_sovereign_node_id text not null,
  relation_version bigint not null check(relation_version=1),
  effective_at timestamptz not null,
  requested_by text not null,
  trace_id text not null,
  created_at timestamptz not null,
  foreign key(node_id,line_id) references organization.node(id,line_id),
  foreign key(line_id,node_id,relation_version) references organization.noderelation(line_id,node_id,relation_version),
  check((node_profile='operating_mall' and mall_id is not null) or (node_profile='consumer' and mall_id is null))
);

create function organization.provision_hosted_node(p_request jsonb)
returns table(
  line_id text,
  node_id text,
  sovereignty_tier text,
  node_profile text,
  realm_id text,
  mall_id text,
  status text,
  created_at text,
  parent_node_id text,
  original_parent_node_id text,
  signed_level text,
  host_sovereign_node_id text,
  relation_version integer,
  effective_at text,
  superseded_at text,
  idempotency_key text,
  request_hash text,
  requested_by text,
  trace_id text,
  replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_idempotency_key text:=p_request->>'idempotency_key';
  v_node_id text:=p_request->>'node_id';
  v_parent_node_id text:=p_request->>'parent_node_id';
  v_realm_id text:=p_request->>'realm_id';
  v_node_profile text:=p_request->>'node_profile';
  v_mall_id text:=p_request->>'mall_id';
  v_signed_level text:=p_request->>'signed_level';
  v_effective_at_text text:=p_request->>'effective_at';
  v_effective_at timestamptz;
  v_requested_by text:=p_request->>'requested_by';
  v_trace_id text:=p_request->>'trace_id';
  v_request_hash text;
  v_line_id text;
  v_parent_level text;
  v_host_sovereign_node_id text;
  v_target_level integer;
  v_parent_level_number integer;
  v_existing organization.hostednodeprovisioning%rowtype;
begin
  if jsonb_typeof(p_request)<>'object'
    or (select array_agg(key order by key) from jsonb_object_keys(p_request) key)
      <>array['effective_at','idempotency_key','mall_id','node_id','node_profile','parent_node_id',
        'realm_id','requested_by','signed_level','trace_id']::text[] then
    raise exception 'SFL_HOSTED_NODE_PROVISIONING_REQUEST_INVALID';
  end if;
  if v_idempotency_key is null or v_idempotency_key='' or v_idempotency_key<>btrim(v_idempotency_key)
    or v_node_id is null or v_node_id='' or v_node_id<>btrim(v_node_id)
    or v_parent_node_id is null or v_parent_node_id='' or v_parent_node_id<>btrim(v_parent_node_id)
    or v_realm_id is null or v_realm_id='' or v_realm_id<>btrim(v_realm_id)
    or v_requested_by is null or v_requested_by='' or v_requested_by<>btrim(v_requested_by)
    or v_trace_id is null or v_trace_id='' or v_trace_id<>btrim(v_trace_id)
    or v_node_id=v_parent_node_id then
    raise exception 'SFL_HOSTED_NODE_PROVISIONING_REQUEST_INVALID';
  end if;
  if v_node_profile is null or v_node_profile not in('operating_mall','consumer')
    or (v_node_profile='operating_mall')<>(v_mall_id is not null and v_mall_id<>'' and v_mall_id=btrim(v_mall_id)) then
    raise exception 'SFL_HOSTED_NODE_PROFILE_MALL_INVALID';
  end if;
  if v_signed_level is null or v_signed_level!~'^L([1-9]|10|11)$' then
    raise exception 'SFL_HOSTED_NODE_LEVEL_INVALID';
  end if;
  if v_effective_at_text is null
    or v_effective_at_text!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then
    raise exception 'SFL_HOSTED_NODE_EFFECTIVE_AT_INVALID';
  end if;
  v_effective_at:=v_effective_at_text::timestamptz;
  v_target_level:=substring(v_signed_level from 2)::integer;
  v_request_hash:=encode(public.digest(convert_to(jsonb_build_object(
    'effective_at',v_effective_at_text,
    'idempotency_key',v_idempotency_key,
    'mall_id',v_mall_id,
    'node_id',v_node_id,
    'node_profile',v_node_profile,
    'parent_node_id',v_parent_node_id,
    'realm_id',v_realm_id,
    'requested_by',v_requested_by,
    'signed_level',v_signed_level,
    'trace_id',v_trace_id
  )::text,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(hashtextextended('sfl:hosted:idempotency:'||v_idempotency_key,0));
  select provisioning.* into v_existing
  from organization.hostednodeprovisioning provisioning
  where provisioning.idempotency_key=v_idempotency_key;
  if found then
    if v_existing.request_hash<>v_request_hash then
      raise exception 'SFL_HOSTED_NODE_IDEMPOTENCY_KEY_REUSED';
    end if;
    return query
    select node.line_id,node.id,node.sovereignty_tier,node.node_profile,node.realm_id,node.mall_id,node.status,
      to_char(node.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,relation.host_sovereign_node_id,
      relation.relation_version::integer,
      to_char(relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      case when relation.superseded_at is null then null
        else to_char(relation.superseded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      v_existing.idempotency_key,v_existing.request_hash::text,v_existing.requested_by,v_existing.trace_id,true
    from organization.node node
    join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
      and relation.relation_version=v_existing.relation_version
    where node.id=v_existing.node_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sfl:hosted:node:'||v_node_id,0));
  if exists(select 1 from organization.node node where node.id=v_node_id)
    or exists(select 1 from organization.hostednodeprovisioning provisioning where provisioning.node_id=v_node_id) then
    raise exception 'SFL_HOSTED_NODE_ID_CONFLICT';
  end if;

  select parent.line_id,relation.signed_level,relation.host_sovereign_node_id
    into v_line_id,v_parent_level,v_host_sovereign_node_id
  from organization.node parent
  join organization.noderelation relation on relation.line_id=parent.line_id and relation.node_id=parent.id
    and relation.effective_at<=v_effective_at
    and (relation.superseded_at is null or v_effective_at<relation.superseded_at)
  where parent.id=v_parent_node_id
  for share of parent,relation;
  if not found or v_parent_level!~'^L([0-9]|10|11)$' then
    raise exception 'SFL_HOSTED_NODE_PARENT_INVALID';
  end if;
  v_parent_level_number:=substring(v_parent_level from 2)::integer;
  if (v_target_level between 1 and 5 and not(v_parent_level_number between 0 and v_target_level-1))
    or (v_target_level=6 and not(v_parent_level_number between 0 and 5))
    or (v_target_level between 7 and 11 and v_parent_level_number<>v_target_level-1) then
    raise exception 'SFL_HOSTED_NODE_RELATION_LEVEL_INVALID';
  end if;

  if not exists(select 1 from identity.realm realm
      where realm.id=v_realm_id and realm.node_id=v_node_id and realm.status='active'
        and realm.node_profile=v_node_profile and realm.mall_id is not distinct from v_mall_id
        and ((v_node_profile='operating_mall' and realm.host_node_id is null)
          or (v_node_profile='consumer' and realm.host_node_id=v_host_sovereign_node_id
            and realm.host_node_profile='operating_mall'))) then
    raise exception 'SFL_HOSTED_NODE_REALM_INVALID';
  end if;

  insert into organization.node(
    id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
  ) values(
    v_node_id,v_line_id,'hosted',v_node_profile,v_realm_id,v_mall_id,'active',v_effective_at,v_effective_at
  );
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
  ) values(
    v_line_id,v_node_id,v_parent_node_id,v_parent_node_id,v_signed_level,v_host_sovereign_node_id,1,v_effective_at
  );
  insert into organization.hostednodeprovisioning(
    idempotency_key,request_hash,node_id,line_id,parent_node_id,realm_id,node_profile,mall_id,signed_level,
    host_sovereign_node_id,relation_version,effective_at,requested_by,trace_id,created_at
  ) values(
    v_idempotency_key,v_request_hash,v_node_id,v_line_id,v_parent_node_id,v_realm_id,v_node_profile,v_mall_id,v_signed_level,
    v_host_sovereign_node_id,1,v_effective_at,v_requested_by,v_trace_id,clock_timestamp()
  );

  return query
  select node.line_id,node.id,node.sovereignty_tier,node.node_profile,node.realm_id,node.mall_id,node.status,
    to_char(node.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    relation.parent_node_id,relation.original_parent_node_id,relation.signed_level,relation.host_sovereign_node_id,
    relation.relation_version::integer,
    to_char(relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    null::text,v_idempotency_key,v_request_hash,v_requested_by,v_trace_id,false
  from organization.node node
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.relation_version=1
  where node.id=v_node_id;
end
$function$;

revoke all on function organization.provision_hosted_node(jsonb) from public;
grant usage on schema organization to zhudatuanprovisioningapi;
grant execute on function organization.provision_hosted_node(jsonb) to zhudatuanprovisioningapi;

insert into runtime.schemaversion(version,checksum)
values('20260911210000','2b4f5c28f492da1e4969b791a9dabcbcb43a27f321a08ad4bbc1af5243bc9a70');

do $assert$
begin
  if to_regclass('organization.hostednodeprovisioning') is null
    or to_regprocedure('organization.provision_hosted_node(jsonb)') is null
    or has_function_privilege('public','organization.provision_hosted_node(jsonb)','execute')
    or not has_schema_privilege('zhudatuanprovisioningapi','organization','usage')
    or not has_function_privilege('zhudatuanprovisioningapi','organization.provision_hosted_node(jsonb)','execute')
    or has_table_privilege('zhudatuanprovisioningapi','organization.hostednodeprovisioning','select,insert,update,delete')
    or not exists(select 1 from runtime.schemaversion where version='20260911210000'
      and checksum='2b4f5c28f492da1e4969b791a9dabcbcb43a27f321a08ad4bbc1af5243bc9a70') then
    raise exception 'SFL_HOSTED_NODE_PROVISIONING_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
