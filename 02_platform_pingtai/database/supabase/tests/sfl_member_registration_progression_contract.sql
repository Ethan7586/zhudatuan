begin;

do $contract$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
  root_id text:='node:zhudatuan:l0';
  target_line text:='line:zhudatuan:commerce:v1';
  direct_host text;
  inviter_node text;
  inviter_realm text;
  invite_hash text;
  identity_hash text;
  response jsonb;
  level integer;
  before_nodes bigint;
  before_relations bigint;
  before_realms bigint;
  before_history jsonb;
  request jsonb;
  foreign_root text;
  foreign_inviter text;
begin
  for level in 3..5 loop
    if level=4 then continue; end if;
    direct_host:='node:direct-'||suffix||':l'||level;
    insert into identity.realm(id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile)
    values('realm:direct-'||suffix||'-l'||level,direct_host,'active','2026-09-01T01:00:00Z','2026-09-01T01:00:00Z',
      'operating_mall','mall:direct:l'||level,null,null);
    perform organization.provision_hosted_node(jsonb_build_object(
      'idempotency_key','direct-host-'||suffix||'-l'||level,'node_id',direct_host,'parent_node_id',root_id,
      'realm_id','realm:direct-'||suffix||'-l'||level,'node_profile','operating_mall','mall_id','mall:direct:l'||level,
      'signed_level','L'||level,'effective_at','2026-09-01T01:00:00.000Z','requested_by','principal:fixture','trace_id','trace:host'
    ));
  end loop;

  for direct_host in select unnest(array[root_id,'node:direct-'||suffix||':l3','node:direct-'||suffix||':l5']) loop
    identity_hash:=encode(public.digest('direct:'||direct_host,'sha256'),'hex');
    request:=jsonb_build_object(
      'registration_id','registration:direct:'||suffix||':'||direct_host,
      'business_number','SFLREG-DIRECT-'||suffix||'-'||right(direct_host,2),
      'idempotency_key','direct-'||suffix||'-'||direct_host,
      'registration_origin','direct','registration_host_node_id',direct_host,'invitation_token_hash',null,
      'business_identity_hash',identity_hash,'node_key','direct-'||suffix||'-'||right(direct_host,2),
      'realm_id','realm:member-direct-'||suffix||'-'||right(direct_host,2),
      'membership_id','membership:direct:'||suffix||':'||right(direct_host,2),
      'requested_by','principal:direct:'||suffix,'trace_id','trace:direct:'||suffix
    );
    select to_jsonb(result) into response from organization.register_hosted_member_node(request) result;
    if response->>'outcome'<>'registered' or response->>'signed_level'<>'L6'
      or response->>'parent_node_id'<>direct_host or response->>'registration_origin'<>'direct'
      or response->'invitation_id'<>'null'::jsonb or response->'inviter_node_id'<>'null'::jsonb
      or response->'inviter_membership_id'<>'null'::jsonb then
      raise exception 'SFL_DIRECT_REGISTRATION_INVALID';
    end if;
  end loop;

  inviter_node:=root_id;
  for level in 6..11 loop
    inviter_realm:='realm:inviter-'||suffix||'-l'||level;
    inviter_node:='node:inviter-'||suffix||':l'||level;
    insert into identity.realm(id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile)
    values(inviter_realm,inviter_node,'active','2026-09-01T01:10:00Z','2026-09-01T01:10:00Z',
      'consumer',null,root_id,'operating_mall');
    perform organization.provision_hosted_node(jsonb_build_object(
      'idempotency_key','inviter-'||suffix||'-l'||level,'node_id',inviter_node,
      'parent_node_id',case when level=6 then root_id else 'node:inviter-'||suffix||':l'||(level-1) end,
      'realm_id',inviter_realm,'node_profile','consumer','mall_id',null,'signed_level','L'||level,
      'effective_at','2026-09-01T01:10:00.000Z','requested_by','principal:fixture','trace_id','trace:inviter'
    ));
    insert into access.membership(id,member_id,organization_id,client,status,realm_id,node_profile)
    values('membership:inviter:'||suffix||':l'||level,'member:inviter:'||suffix||':l'||level,
      'mall-zhudatuan','storefront','active',inviter_realm,'consumer');
    invite_hash:=encode(public.digest('invite:'||suffix||':l'||level,'sha256'),'hex');
    insert into member.invite(
      id,organization_id,token_hash,expires_at,created_by,role_id,allowed_destination_hash,max_uses,use_count,
      effective_at,status,registration_policy_id,terms_hash,target_client
    ) values(
      'invite:'||suffix||':l'||level,'mall-zhudatuan',invite_hash,'2027-09-12T00:00:00Z',
      'membership:inviter:'||suffix||':l'||level,'role:storefront',null,20,0,'2026-09-01T00:00:00Z',
      'active','policy:registration','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','storefront'
    );
  end loop;

  before_history:=(select jsonb_agg(to_jsonb(relation) order by relation.node_id,relation.relation_version)
    from organization.noderelation relation where relation.node_id like 'node:inviter-'||suffix||':l%');
  for level in 6..10 loop
    invite_hash:=encode(public.digest('invite:'||suffix||':l'||level,'sha256'),'hex');
    identity_hash:=encode(public.digest('invited:'||suffix||':l'||level,'sha256'),'hex');
    request:=jsonb_build_object(
      'registration_id','registration:invited:'||suffix||':l'||level,
      'business_number','SFLREG-INVITED-'||suffix||'-L'||level,
      'idempotency_key','invited-'||suffix||'-l'||level,
      'registration_origin','invitation','registration_host_node_id',root_id,'invitation_token_hash',invite_hash,
      'business_identity_hash',identity_hash,'node_key','invited-'||suffix||'-l'||level,
      'realm_id','realm:member-invited-'||suffix||'-l'||level,
      'membership_id','membership:invited:'||suffix||':l'||level,
      'requested_by','principal:invited:'||suffix||':l'||level,'trace_id','trace:invited:'||suffix
    );
    select to_jsonb(result) into response from organization.register_hosted_member_node(request) result;
    if response->>'outcome'<>'registered' or response->>'signed_level'<>'L'||(level+1)
      or response->>'parent_node_id'<>'node:inviter-'||suffix||':l'||level
      or response->>'inviter_node_id'<>response->>'parent_node_id'
      or response->>'inviter_membership_id'<>'membership:inviter:'||suffix||':l'||level then
      raise exception 'SFL_INVITATION_PROGRESSION_INVALID_L%',level;
    end if;
  end loop;

  if exists(select 1 from organization.membernoderegistration registration
      where (select count(*) from organization.noderelation relation
        where relation.line_id=registration.line_id and relation.node_id=registration.node_id
          and relation.superseded_at is null)<>1
        or (registration.registration_origin='invitation' and registration.inviter_node_id<>registration.parent_node_id)) then
    raise exception 'SFL_UNIQUE_PARENT_OR_INVITER_EDGE_INVALID';
  end if;

  foreign_root:='node:foreign-'||suffix||':l0';
  foreign_inviter:='node:foreign-'||suffix||':l6';
  insert into identity.realm(id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile)
  values('realm:foreign-'||suffix||'-l0',foreign_root,'active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',
    'operating_mall','mall:foreign:'||suffix,null,null),
    ('realm:foreign-'||suffix||'-l6',foreign_inviter,'active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',
    'consumer',null,foreign_root,'operating_mall');
  insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
  values(foreign_root,'line:foreign:'||suffix,'sovereign','operating_mall','realm:foreign-'||suffix||'-l0',
    'mall:foreign:'||suffix,'active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
  ) values('line:foreign:'||suffix,foreign_root,null,null,'L0',foreign_root,1,'2026-09-01T00:00:00Z');
  perform organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','foreign-inviter-'||suffix,'node_id',foreign_inviter,'parent_node_id',foreign_root,
    'realm_id','realm:foreign-'||suffix||'-l6','node_profile','consumer','mall_id',null,'signed_level','L6',
    'effective_at','2026-09-01T00:00:00.000Z','requested_by','principal:foreign','trace_id','trace:foreign'
  ));
  insert into access.membership(id,member_id,organization_id,client,status,realm_id,node_profile)
  values('membership:foreign:'||suffix,'member:foreign:'||suffix,'mall-zhudatuan','storefront','active',
    'realm:foreign-'||suffix||'-l6','consumer');
  invite_hash:=encode(public.digest('invite:foreign:'||suffix,'sha256'),'hex');
  insert into member.invite(
    id,organization_id,token_hash,expires_at,created_by,role_id,allowed_destination_hash,max_uses,use_count,
    effective_at,status,registration_policy_id,terms_hash,target_client
  ) values('invite:foreign:'||suffix,'mall-zhudatuan',invite_hash,'2027-09-12T00:00:00Z',
    'membership:foreign:'||suffix,'role:storefront',null,1,0,'2026-09-01T00:00:00Z','active',
    'policy:registration','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','storefront');
  request:=jsonb_build_object(
    'registration_id','registration:foreign:'||suffix,'business_number','SFLREG-FOREIGN-'||suffix,
    'idempotency_key','foreign-'||suffix,'registration_origin','invitation','registration_host_node_id',root_id,
    'invitation_token_hash',invite_hash,'business_identity_hash',encode(public.digest('foreign:'||suffix,'sha256'),'hex'),
    'node_key','foreign-attempt-'||suffix,'realm_id','realm:foreign-attempt-'||suffix,
    'membership_id','membership:foreign-attempt:'||suffix,'requested_by','principal:foreign-attempt',
    'trace_id','trace:foreign-attempt'
  );
  begin
    perform organization.register_hosted_member_node(request);
    raise exception 'EXPECTED_CROSS_LINE_REJECTION';
  exception when others then
    if sqlerrm<>'INVITE_INVALID' then raise; end if;
  end;
  if exists(select 1 from organization.node where id='node:foreign-attempt-'||suffix||':l7')
    or exists(select 1 from organization.membernoderegistration where idempotency_key='foreign-'||suffix) then
    raise exception 'SFL_CROSS_LINE_INVITATION_LEFT_FACTS';
  end if;

  before_nodes:=(select count(*) from organization.node);
  before_relations:=(select count(*) from organization.noderelation);
  before_realms:=(select count(*) from identity.realm);
  invite_hash:=encode(public.digest('invite:'||suffix||':l11','sha256'),'hex');
  identity_hash:=encode(public.digest('boundary:'||suffix,'sha256'),'hex');
  request:=jsonb_build_object(
    'registration_id','registration:boundary:'||suffix,'business_number','SFLREG-BOUNDARY-'||suffix,
    'idempotency_key','boundary-'||suffix,'registration_origin','invitation','registration_host_node_id',root_id,
    'invitation_token_hash',invite_hash,'business_identity_hash',identity_hash,'node_key','boundary-'||suffix,
    'realm_id','realm:boundary-'||suffix,'membership_id','membership:boundary:'||suffix,
    'requested_by','principal:boundary:'||suffix,'trace_id','trace:boundary:'||suffix
  );
  select to_jsonb(result) into response from organization.register_hosted_member_node(request) result;
  if response->>'outcome'<>'level_boundary' or response->'node_id'<>'null'::jsonb
    or response->'signed_level'<>'null'::jsonb or response->'parent_node_id'<>'null'::jsonb
    or (select count(*) from organization.node)<>before_nodes
    or (select count(*) from organization.noderelation)<>before_relations
    or (select count(*) from identity.realm)<>before_realms
    or exists(select 1 from organization.node where id like '%:l12')
    or exists(select 1 from organization.noderelation where signed_level='L12')
    or exists(select 1 from member.invite where id='invite:'||suffix||':l11' and (use_count<>0 or accepted_at is not null))
    or exists(select 1 from organization.membernoderegistration where registration_id='registration:boundary:'||suffix) then
    raise exception 'SFL_L11_BOUNDARY_INVALID';
  end if;
  select to_jsonb(result) into response from organization.register_hosted_member_node(request) result;
  if response->>'outcome'<>'level_boundary' or response->>'replayed'<>'true'
    or (select count(*) from organization.memberregistrationboundary where idempotency_key='boundary-'||suffix)<>1 then
    raise exception 'SFL_L11_BOUNDARY_IDEMPOTENCY_INVALID';
  end if;

  if before_history is distinct from (select jsonb_agg(to_jsonb(relation) order by relation.node_id,relation.relation_version)
      from organization.noderelation relation where relation.node_id like 'node:inviter-'||suffix||':l%') then
    raise exception 'SFL_RELATION_HISTORY_REWRITTEN';
  end if;
  if exists(select 1 from organization.membernoderegistration registration
      join organization.node node on node.id=registration.node_id
      where node.node_profile<>'consumer' or node.mall_id is not null or node.sovereignty_tier<>'hosted')
    or pg_get_functiondef('organization.register_hosted_member_node(jsonb)'::regprocedure)!~'organization.provision_hosted_node'
    or pg_get_functiondef('organization.register_hosted_member_node(jsonb)'::regprocedure)~*'manifest|domain.binding|runtime.instance|release.pointer|gateway.port' then
    raise exception 'SFL_HOSTED_ZERO_INFRASTRUCTURE_INVALID';
  end if;
end
$contract$;

rollback;
