begin;

do $contract$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
  target_line_id text:='line:contract:sfl:'||suffix;
  root_id text:='node:contract-sfl-'||suffix||':l0';
  l5_id text:='node:contract-sfl-'||suffix||':l5';
  l6_id text:='node:contract-sfl-'||suffix||':l6';
  previous_id text;
  current_id text;
  level integer;
  effective_at timestamptz:='2026-09-01T00:00:00Z';
  changed_at timestamptz:='2026-09-10T00:00:00Z';
begin
  insert into identity.realm(id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at)
  values
    ('realm:sfl-'||suffix||'-l0',root_id,'active','operating_mall','mall:contract:'||suffix||':l0',null,null,effective_at,effective_at),
    ('realm:sfl-'||suffix||'-l5',l5_id,'active','operating_mall','mall:contract:'||suffix||':l5',null,null,effective_at,effective_at),
    ('realm:sfl-'||suffix||'-l6',l6_id,'active','operating_mall','mall:contract:'||suffix||':l6',null,null,effective_at,effective_at);

  insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
  values
    (root_id,target_line_id,'sovereign','operating_mall','realm:sfl-'||suffix||'-l0','mall:contract:'||suffix||':l0','active',effective_at,effective_at),
    (l5_id,target_line_id,'hosted','operating_mall','realm:sfl-'||suffix||'-l5','mall:contract:'||suffix||':l5','active',effective_at,effective_at),
    (l6_id,target_line_id,'hosted','operating_mall','realm:sfl-'||suffix||'-l6','mall:contract:'||suffix||':l6','active',effective_at,effective_at);
  insert into organization.noderelation(line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at)
  values
    (target_line_id,root_id,null,null,'L0',root_id,1,effective_at),
    (target_line_id,l5_id,root_id,root_id,'L5',root_id,1,effective_at),
    (target_line_id,l6_id,l5_id,l5_id,'L6',root_id,1,effective_at);

  previous_id:=l6_id;
  for level in 7..11 loop
    current_id:='node:contract-sfl-'||suffix||':l'||level;
    insert into identity.realm(id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at)
    values('realm:sfl-'||suffix||'-l'||level,current_id,'active','consumer',null,root_id,'operating_mall',effective_at,effective_at);
    insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
    values(current_id,target_line_id,'hosted','consumer','realm:sfl-'||suffix||'-l'||level,null,'active',effective_at,effective_at);
    insert into organization.noderelation(line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at)
    values(target_line_id,current_id,previous_id,previous_id,'L'||level,root_id,1,effective_at);
    previous_id:=current_id;
  end loop;

  if (select count(*) from organization.node where line_id=target_line_id)<>8
    or not exists(select 1 from organization.node where id=l6_id and sovereignty_tier='hosted' and node_profile='operating_mall')
    or not exists(select 1 from organization.node where id=previous_id and node_profile='consumer')
    or exists(select 1 from information_schema.columns where table_schema='organization' and table_name='node'
      and column_name in('manifest_id','domain_bindings','resource_binding_set_ref','runtime_instance_id','release_pointer_ref')) then
    raise exception 'SFL_NODE_COMMON_MODEL_CONTRACT_FAILED';
  end if;

  update organization.noderelation set superseded_at=changed_at
  where line_id=target_line_id and node_id=l6_id and relation_version=1;
  insert into organization.noderelation(line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at)
  values(target_line_id,l6_id,root_id,l5_id,'L6',root_id,2,changed_at);
  if not exists(select 1 from organization.noderelation where line_id=target_line_id and node_id=l6_id
      and relation_version=1 and parent_node_id=l5_id and superseded_at=changed_at)
    or not exists(select 1 from organization.noderelation where line_id=target_line_id and node_id=l6_id
      and relation_version=2 and parent_node_id=root_id and original_parent_node_id=l5_id and superseded_at is null) then
    raise exception 'SFL_NODE_RELATION_HISTORY_CONTRACT_FAILED';
  end if;

  begin
    insert into organization.noderelation(line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at)
    values(target_line_id,l6_id,root_id,l5_id,'L6',root_id,3,changed_at);
    raise exception 'SFL_NODE_DUPLICATE_EFFECTIVE_PARENT_ALLOWED';
  exception when others then
    if sqlerrm not like '%SFL_NODE_RELATION_VERSION_INVALID%' and sqlstate<>'23505' then raise; end if;
  end;
  begin
    update organization.node set sovereignty_tier='sovereign',node_profile='consumer',mall_id=null where id=previous_id;
    raise exception 'SFL_SOVEREIGN_CONSUMER_ALLOWED';
  exception when check_violation then null;
  end;
  begin
    insert into identity.realm(id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at)
    values('realm:sfl-'||suffix||'-l12','node:contract-sfl-'||suffix||':l12','active','consumer',null,root_id,'operating_mall',effective_at,effective_at);
    insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
    values('node:contract-sfl-'||suffix||':l12',target_line_id,'hosted','consumer','realm:sfl-'||suffix||'-l12',null,'active',effective_at,effective_at);
    insert into organization.noderelation(line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at)
    values(target_line_id,'node:contract-sfl-'||suffix||':l12',previous_id,previous_id,'L12',root_id,1,effective_at);
    raise exception 'SFL_L12_ALLOWED';
  exception when check_violation then null;
  end;
end
$contract$;

rollback;
