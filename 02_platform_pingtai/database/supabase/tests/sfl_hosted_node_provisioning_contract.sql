begin;

do $contract$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
  root_id text:='node:zhudatuan:l0';
  existing_l1_id text:='node:hbbtzn:l1';
  levels integer[]:=array[2,3,4,5,6,7,8,9,10,11];
  profiles text[]:=array['operating_mall','consumer','consumer','consumer','operating_mall','consumer','consumer','consumer','consumer','consumer'];
  level integer;
  profile text;
  target_id text;
  parent_id text:=existing_l1_id;
  realm_id text;
  mall_id text;
  request_key text;
  result jsonb;
  root_before jsonb;
  l1_before jsonb;
begin
  select to_jsonb(node) into root_before from organization.node node where node.id=root_id;
  select to_jsonb(node) into l1_before from organization.node node where node.id=existing_l1_id;

  for index in 1..array_length(levels,1) loop
    level:=levels[index];
    profile:=profiles[index];
    target_id:='node:contract-hosted-'||suffix||':l'||level;
    realm_id:='realm:hosted-'||suffix||'-l'||level;
    mall_id:=case when profile='operating_mall' then 'mall:contract:hosted-'||suffix||'-l'||level else null end;
    request_key:='hosted-contract-'||suffix||'-l'||level;

    insert into identity.realm(
      id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at
    ) values(
      realm_id,target_id,'active',profile,mall_id,
      case when profile='consumer' then existing_l1_id else null end,
      case when profile='consumer' then 'operating_mall' else null end,
      '2026-09-11T00:00:00Z','2026-09-11T00:00:00Z'
    );

    select to_jsonb(created) into result
    from organization.provision_hosted_node(jsonb_build_object(
      'idempotency_key',request_key,
      'node_id',target_id,
      'parent_node_id',parent_id,
      'realm_id',realm_id,
      'node_profile',profile,
      'mall_id',mall_id,
      'signed_level','L'||level,
      'effective_at','2026-09-11T00:00:00.000Z',
      'requested_by','principal:contract:hosted-provisioner',
      'trace_id','trace:contract:hosted-'||suffix
    )) created;
    if result->>'node_id'<>target_id or result->>'line_id'<>'line:zhudatuan:commerce:v1'
      or result->>'parent_node_id'<>parent_id or result->>'host_sovereign_node_id'<>existing_l1_id
      or result->>'relation_version'<>'1' or result->>'effective_at'<>'2026-09-11T00:00:00.000Z'
      or result->>'sovereignty_tier'<>'hosted' or result->>'node_profile'<>profile
      or result->>'replayed'<>'false' then
      raise exception 'SFL_HOSTED_NODE_GENERATION_RESULT_INVALID:%',level;
    end if;
    parent_id:=target_id;
  end loop;

  if (select count(*) from organization.node where id like 'node:contract-hosted-'||suffix||':l%')<>10
    or (select count(*) from organization.noderelation where node_id like 'node:contract-hosted-'||suffix||':l%')<>10
    or (select count(*) from organization.hostednodeprovisioning where node_id like 'node:contract-hosted-'||suffix||':l%')<>10
    or not exists(select 1 from organization.node where id='node:contract-hosted-'||suffix||':l2'
      and sovereignty_tier='hosted' and node_profile='operating_mall')
    or not exists(select 1 from organization.node where id='node:contract-hosted-'||suffix||':l5'
      and sovereignty_tier='hosted' and node_profile='consumer')
    or not exists(select 1 from organization.node where id='node:contract-hosted-'||suffix||':l6'
      and sovereignty_tier='hosted' and node_profile='operating_mall')
    or not exists(select 1 from organization.node where id='node:contract-hosted-'||suffix||':l11'
      and sovereignty_tier='hosted' and node_profile='consumer') then
    raise exception 'SFL_HOSTED_NODE_SAMPLE_FACTS_INVALID';
  end if;

  select to_jsonb(replayed) into result
  from organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','hosted-contract-'||suffix||'-l6',
    'node_id','node:contract-hosted-'||suffix||':l6',
    'parent_node_id','node:contract-hosted-'||suffix||':l5',
    'realm_id','realm:hosted-'||suffix||'-l6',
    'node_profile','operating_mall',
    'mall_id','mall:contract:hosted-'||suffix||'-l6',
    'signed_level','L6',
    'effective_at','2026-09-11T00:00:00.000Z',
    'requested_by','principal:contract:hosted-provisioner',
    'trace_id','trace:contract:hosted-'||suffix
  )) replayed;
  if result->>'replayed'<>'true'
    or (select count(*) from organization.node where id='node:contract-hosted-'||suffix||':l6')<>1
    or (select count(*) from organization.noderelation where node_id='node:contract-hosted-'||suffix||':l6')<>1
    or (select count(*) from organization.hostednodeprovisioning where node_id='node:contract-hosted-'||suffix||':l6')<>1 then
    raise exception 'SFL_HOSTED_NODE_REPLAY_INVALID';
  end if;

  begin
    perform organization.provision_hosted_node(jsonb_build_object(
      'idempotency_key','hosted-contract-'||suffix||'-l6',
      'node_id','node:contract-hosted-'||suffix||':l6',
      'parent_node_id','node:contract-hosted-'||suffix||':l5',
      'realm_id','realm:hosted-'||suffix||'-l6',
      'node_profile','consumer','mall_id',null,'signed_level','L6',
      'effective_at','2026-09-11T00:00:00.000Z',
      'requested_by','principal:contract:hosted-provisioner','trace_id','trace:contract:hosted-'||suffix
    ));
    raise exception 'SFL_HOSTED_NODE_IDEMPOTENCY_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%SFL_HOSTED_NODE_IDEMPOTENCY_KEY_REUSED%' then raise; end if;
  end;

  begin
    perform organization.provision_hosted_node(jsonb_build_object(
      'idempotency_key','hosted-contract-'||suffix||'-l6-rival',
      'node_id','node:contract-hosted-'||suffix||':l6',
      'parent_node_id','node:contract-hosted-'||suffix||':l5',
      'realm_id','realm:hosted-'||suffix||'-l6',
      'node_profile','operating_mall','mall_id','mall:contract:hosted-'||suffix||'-l6','signed_level','L6',
      'effective_at','2026-09-11T00:00:00.000Z',
      'requested_by','principal:contract:hosted-provisioner','trace_id','trace:contract:hosted-'||suffix
    ));
    raise exception 'SFL_HOSTED_NODE_SECOND_KEY_ALLOWED';
  exception when others then
    if sqlerrm not like '%SFL_HOSTED_NODE_ID_CONFLICT%' then raise; end if;
  end;

  if root_before is distinct from (select to_jsonb(node) from organization.node node where node.id=root_id)
    or l1_before is distinct from (select to_jsonb(node) from organization.node node where node.id=existing_l1_id)
    or exists(select 1 from information_schema.columns
      where table_schema='organization' and table_name in('node','noderelation','hostednodeprovisioning')
        and column_name~'(manifest|domain|port|process|runtime|release|directory|path)') then
    raise exception 'SFL_HOSTED_NODE_COMPATIBILITY_OR_DATA_ONLY_INVALID';
  end if;
end
$contract$;

rollback;
