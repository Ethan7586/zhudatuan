begin;

do $contract$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
  target_line_id text:='line:contract:sfl:'||suffix;
  root_id text:='node:contract-sfl-'||suffix||':l0';
  l5_id text:='node:contract-sfl-'||suffix||':l5';
  l6_id text:='node:contract-sfl-'||suffix||':l6';
  foreign_line_id text:='line:contract:sfl-foreign:'||suffix;
  foreign_root_id text:='node:contract-sfl-foreign-'||suffix||':l0';
  previous_id text;
  current_id text;
  parent_id text;
  profile text;
  level integer;
  effective_at timestamptz:='2026-09-01T00:00:00Z';
  changed_at timestamptz:='2026-09-10T00:00:00Z';
begin
  for level in 0..11 loop
    current_id:='node:contract-sfl-'||suffix||':l'||level;
    profile:=case when level<=6 then 'operating_mall' else 'consumer' end;
    insert into identity.realm(id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at)
    values(
      'realm:sfl-'||suffix||'-l'||level,current_id,'active',profile,
      case when profile='operating_mall' then 'mall:contract:'||suffix||':l'||level else null end,
      case when profile='consumer' then root_id else null end,
      case when profile='consumer' then 'operating_mall' else null end,effective_at,effective_at
    );
    insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
    values(
      current_id,target_line_id,case when level=0 then 'sovereign' else 'hosted' end,profile,
      'realm:sfl-'||suffix||'-l'||level,
      case when profile='operating_mall' then 'mall:contract:'||suffix||':l'||level else null end,
      'active',effective_at,effective_at
    );
    parent_id:=case when level=0 then null else previous_id end;
    insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) values(target_line_id,current_id,parent_id,parent_id,'L'||level,root_id,1,effective_at);
    previous_id:=current_id;
  end loop;

  if (select count(*) from organization.node where line_id=target_line_id)<>12
    or (select count(*) from organization.noderelation
      where line_id=target_line_id and superseded_at is null and parent_node_id is not null)<>11
    or not exists(select 1 from organization.node where id=l6_id
      and sovereignty_tier='hosted' and node_profile='operating_mall')
    or not exists(select 1 from organization.node where id=previous_id and node_profile='consumer')
    or exists(select 1 from information_schema.columns where table_schema='organization' and table_name='node'
      and column_name~'^l([0-9]|10|11)_') then
    raise exception 'SFL_NODE_COMMON_MODEL_CONTRACT_FAILED';
  end if;

  update organization.noderelation set superseded_at=changed_at
  where line_id=target_line_id and node_id=l6_id and relation_version=1;
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    relation_version,effective_at
  ) values(target_line_id,l6_id,l5_id,l5_id,'L6',root_id,2,changed_at);
  if not exists(select 1 from organization.noderelation where line_id=target_line_id and node_id=l6_id
      and relation_version=1 and parent_node_id=l5_id and superseded_at=changed_at)
    or not exists(select 1 from organization.noderelation where line_id=target_line_id and node_id=l6_id
      and relation_version=2 and parent_node_id=l5_id and original_parent_node_id=l5_id and superseded_at is null) then
    raise exception 'SFL_NODE_RELATION_HISTORY_CONTRACT_FAILED';
  end if;

  begin
    update organization.noderelation set superseded_at=changed_at
    where line_id=target_line_id and node_id='node:contract-sfl-'||suffix||':l8' and relation_version=1;
    insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) values(
      target_line_id,'node:contract-sfl-'||suffix||':l8','node:contract-sfl-'||suffix||':l6',
      'node:contract-sfl-'||suffix||':l7','L8',root_id,2,changed_at
    );
    raise exception 'SFL_NODE_SKIP_LEVEL_ALLOWED';
  exception when others then
    if sqlerrm not like '%SFL_NODE_RELATION_LEVEL_ADJACENCY_INVALID%' then raise; end if;
  end;

  begin
    insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) values(
      target_line_id,'node:contract-sfl-'||suffix||':l7',l6_id,l6_id,'L7',root_id,2,changed_at
    );
    raise exception 'SFL_NODE_DUPLICATE_EFFECTIVE_PARENT_ALLOWED';
  exception when others then
    if sqlerrm not like '%SFL_NODE_RELATION_VERSION_INVALID%' and sqlstate<>'23505' then raise; end if;
  end;

  insert into identity.realm(id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at)
  values('realm:sfl-foreign-'||suffix||'-l0',foreign_root_id,'active','operating_mall',
    'mall:contract:foreign:'||suffix,null,null,effective_at,effective_at);
  insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
  values(foreign_root_id,foreign_line_id,'sovereign','operating_mall','realm:sfl-foreign-'||suffix||'-l0',
    'mall:contract:foreign:'||suffix,'active',effective_at,effective_at);
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    relation_version,effective_at
  ) values(foreign_line_id,foreign_root_id,null,null,'L0',foreign_root_id,1,effective_at);
  begin
    update organization.noderelation set superseded_at=changed_at
    where line_id=target_line_id and node_id='node:contract-sfl-'||suffix||':l7' and relation_version=1;
    insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) values(
      target_line_id,'node:contract-sfl-'||suffix||':l7',foreign_root_id,l6_id,'L7',root_id,2,changed_at
    );
    raise exception 'SFL_NODE_CROSS_LINE_ALLOWED';
  exception when others then
    if sqlerrm not like '%SFL_NODE_RELATION_CROSS_LINE_INVALID%' then raise; end if;
  end;

  begin
    update organization.node set sovereignty_tier='sovereign',node_profile='consumer',mall_id=null where id=previous_id;
    raise exception 'SFL_SOVEREIGN_CONSUMER_ALLOWED';
  exception when check_violation then null;
  end;
  begin
    insert into identity.realm(id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at)
    values('realm:sfl-'||suffix||'-l12','node:contract-sfl-'||suffix||':l12','active','consumer',null,root_id,
      'operating_mall',effective_at,effective_at);
    insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
    values('node:contract-sfl-'||suffix||':l12',target_line_id,'hosted','consumer',
      'realm:sfl-'||suffix||'-l12',null,'active',effective_at,effective_at);
    insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) values(target_line_id,'node:contract-sfl-'||suffix||':l12',previous_id,previous_id,'L12',root_id,1,effective_at);
    raise exception 'SFL_L12_ALLOWED';
  exception when check_violation then null;
  end;
end
$contract$;

rollback;
