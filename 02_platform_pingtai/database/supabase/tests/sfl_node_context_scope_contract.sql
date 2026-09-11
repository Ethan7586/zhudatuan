begin;

do $contract$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
  target_line_id text:='line:zhudatuan:commerce:v1';
  root_id text:='node:zhudatuan:l0';
  hosted_l1 text:='node:scope-'||suffix||':l1';
  hosted_l5 text:='node:scope-'||suffix||':l5';
  hosted_l6 text:='node:scope-'||suffix||':l6';
  previous_id text;
  current_id text;
  profile text;
  mall_id text;
  level integer;
  context jsonb;
  before_existing_closure bigint;
  before_total_closure bigint;
  changed_at timestamptz:='2026-09-12T01:00:00Z';
begin
  previous_id:=root_id;
  for level in 1..11 loop
    if level not in(1,5,6,7,8,9,10,11) then continue; end if;
    current_id:='node:scope-'||suffix||':l'||level;
    profile:=case when level in(1,5) then 'operating_mall' else 'consumer' end;
    mall_id:=case when profile='operating_mall' then 'mall:scope:'||suffix||':l'||level else null end;
    insert into identity.realm(
      id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at
    ) values(
      'realm:scope-'||suffix||'-l'||level,current_id,'active',profile,mall_id,
      case when profile='consumer' then root_id else null end,
      case when profile='consumer' then 'operating_mall' else null end,
      '2026-09-12T00:00:00Z','2026-09-12T00:00:00Z'
    );
    perform organization.provision_hosted_node(jsonb_build_object(
      'idempotency_key','scope-contract-'||suffix||'-l'||level,
      'node_id',current_id,
      'parent_node_id',previous_id,
      'realm_id','realm:scope-'||suffix||'-l'||level,
      'node_profile',profile,
      'mall_id',mall_id,
      'signed_level','L'||level,
      'effective_at','2026-09-12T00:00:00.000Z',
      'requested_by','principal:scope-contract',
      'trace_id','trace:scope-contract-'||suffix||'-l'||level
    ));
    previous_id:=current_id;
  end loop;

  select to_jsonb(resolved) into context from organization.resolve_node_context(root_id) resolved;
  if context->>'sovereignty_tier'<>'sovereign' or context->>'node_profile'<>'operating_mall'
    or context->>'host_sovereign_node_id'<>root_id then
    raise exception 'SFL_SOVEREIGN_L0_CONTEXT_INVALID';
  end if;
  select to_jsonb(resolved) into context from organization.resolve_node_context('node:hbbtzn:l1') resolved;
  if context->>'sovereignty_tier'<>'sovereign' or context->>'signed_level'<>'L1'
    or context->>'realm_id'<>'realm:l1' then
    raise exception 'SFL_SOVEREIGN_L1_CONTEXT_INVALID';
  end if;
  select to_jsonb(resolved) into context from organization.resolve_node_context(hosted_l1) resolved;
  if context->>'line_id'<>target_line_id or context->>'parent_node_id'<>root_id
    or context->>'signed_level'<>'L1' or context->>'sovereignty_tier'<>'hosted'
    or context->>'node_profile'<>'operating_mall' or context->>'realm_id'<>'realm:scope-'||suffix||'-l1'
    or context->>'mall_id'<>'mall:scope:'||suffix||':l1' or context->>'host_sovereign_node_id'<>root_id
    or context->>'relation_version'<>'1' or context->>'effective_at'<>'2026-09-12T00:00:00.000Z'
    or context->>'status'<>'active' then
    raise exception 'SFL_HOSTED_L1_CONTEXT_INVALID';
  end if;
  select to_jsonb(resolved) into context from organization.resolve_node_context(hosted_l5) resolved;
  if context->>'node_profile'<>'operating_mall' or context->>'signed_level'<>'L5' then
    raise exception 'SFL_LEVEL_DERIVED_PROFILE_INVALID';
  end if;
  select to_jsonb(resolved) into context from organization.resolve_node_context(hosted_l6) resolved;
  if context->>'node_profile'<>'consumer' or context->'mall_id'<>'null'::jsonb
    or context->>'realm_id'<>'realm:scope-'||suffix||'-l6' then
    raise exception 'SFL_HOSTED_CONSUMER_CONTEXT_INVALID';
  end if;
  select to_jsonb(resolved) into context from organization.resolve_node_context(previous_id) resolved;
  if context->>'signed_level'<>'L11' or context->>'node_profile'<>'consumer'
    or context->>'host_sovereign_node_id'<>root_id then
    raise exception 'SFL_HOSTED_L11_CONTEXT_INVALID';
  end if;

  if (select count(*) from organization.resolve_node_scope_self(target_line_id,previous_id))<>1
    or (select count(*) from organization.resolve_node_scope_ancestors(target_line_id,previous_id))<>8
    or (select count(*) from organization.resolve_node_scope_descendants(target_line_id,root_id)
      where node_id like 'node:scope-'||suffix||':l%')<>8
    or (select count(*) from organization.resolve_node_scope_subtree(target_line_id,hosted_l5))<>7
    or not exists(select 1 from organization.resolve_node_scope_ancestors(target_line_id,previous_id)
      where node_id=hosted_l5 and distance=6) then
    raise exception 'SFL_INDEXED_SCOPE_RESULT_INVALID';
  end if;

  if pg_get_functiondef('organization.resolve_node_scope_ancestors(text,text)'::regprocedure)~*'recursive'
    or pg_get_functiondef('organization.resolve_node_scope_descendants(text,text)'::regprocedure)~*'recursive'
    or pg_get_functiondef('organization.resolve_node_scope_subtree(text,text)'::regprocedure)~*'recursive'
    or pg_get_functiondef('organization.resolve_node_scope_ancestors(text,text)'::regprocedure)!~'nodeclosure'
    or pg_get_functiondef('organization.resolve_node_scope_descendants(text,text)'::regprocedure)!~'nodeclosure' then
    raise exception 'SFL_SCOPE_REQUEST_SHAPE_INVALID';
  end if;

  before_existing_closure:=(select count(*) from organization.nodeclosure
    where descendant_node_id=previous_id and superseded_at is null);
  before_total_closure:=(select count(*) from organization.nodeclosure where superseded_at is null);
  current_id:='node:scope-'||suffix||'-alternate:l6';
  insert into identity.realm(
    id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at
  ) values(
    'realm:scope-'||suffix||'-alternate-l6',current_id,'active','consumer',null,root_id,'operating_mall',
    '2026-09-12T00:30:00Z','2026-09-12T00:30:00Z'
  );
  perform organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','scope-contract-'||suffix||'-alternate-l6',
    'node_id',current_id,'parent_node_id',hosted_l5,'realm_id','realm:scope-'||suffix||'-alternate-l6',
    'node_profile','consumer','mall_id',null,'signed_level','L6','effective_at','2026-09-12T00:30:00.000Z',
    'requested_by','principal:scope-contract','trace_id','trace:scope-contract-'||suffix||'-alternate-l6'
  ));
  if (select count(*) from organization.nodeclosure where descendant_node_id=previous_id and superseded_at is null)
      <>before_existing_closure
    or (select count(*) from organization.nodeclosure where superseded_at is null)-before_total_closure<>4 then
    raise exception 'SFL_HOSTED_CLOSURE_WRITE_AMPLIFICATION_INVALID';
  end if;

  update organization.noderelation set superseded_at=changed_at
  where line_id=target_line_id and node_id=hosted_l6 and relation_version=1;
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
  ) values(target_line_id,hosted_l6,root_id,hosted_l5,'L6',root_id,2,changed_at);
  select to_jsonb(resolved) into context from organization.resolve_node_context(hosted_l6) resolved;
  if context->>'parent_node_id'<>root_id or context->>'relation_version'<>'2'
    or context->>'effective_at'<>'2026-09-12T01:00:00.000Z'
    or not exists(select 1 from organization.noderelation where node_id=hosted_l6 and relation_version=1
      and parent_node_id=hosted_l5 and superseded_at=changed_at)
    or exists(select 1 from organization.resolve_node_scope_ancestors(target_line_id,previous_id) where node_id=hosted_l5)
    or not exists(select 1 from organization.nodeclosure where descendant_node_id=previous_id
      and ancestor_node_id=hosted_l5 and superseded_at=changed_at) then
    raise exception 'SFL_CURRENT_RELATION_VERSION_SCOPE_INVALID';
  end if;

  update organization.node set status='suspended',updated_at=changed_at where id=previous_id;
  select to_jsonb(resolved) into context from organization.resolve_node_context(previous_id) resolved;
  if context->>'status'<>'suspended' or not exists(select 1 from organization.node where id=previous_id) then
    raise exception 'SFL_SUSPENDED_NODE_FACT_DELETED';
  end if;

  if context ?| array['manifest_id','manifest_digest','resource_binding_set_ref','secret_binding_set_ref',
      'payment_binding_refs','release_pointer_ref','domain_bindings','runtime_instance_id']
    or (select count(*) from pg_proc where oid='organization.resolve_node_context(text)'::regprocedure
      and pronargs=1)<>1 then
    raise exception 'SFL_HOSTED_SOVEREIGN_RESOURCE_OR_CLIENT_AUTHORITY_LEAK';
  end if;
end
$contract$;

rollback;
