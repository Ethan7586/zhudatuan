do $contract$
declare
  shared_subject char(64):=repeat('a',64);
  invite_hash char(64):=repeat('b',64);
  direct_result record;
  invited_result record;
  context_a record;
  context_b record;
begin
  insert into identity.realm(
    id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
  ) values
    ('realm:mall-b-inviter-l6','node:mall-b-inviter:l6','active',clock_timestamp(),clock_timestamp(),
      'consumer',null,'node:mall-b:l0','operating_mall'),
    ('realm:mall-b-inviter-l7','node:mall-b-inviter:l7','active',clock_timestamp(),clock_timestamp(),
      'consumer',null,'node:mall-b:l0','operating_mall');
  perform organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','mall-b-inviter-l6','node_id','node:mall-b-inviter:l6','parent_node_id','node:mall-b:l0',
    'realm_id','realm:mall-b-inviter-l6','node_profile','consumer','mall_id',null,'signed_level','L6',
    'effective_at','2026-09-01T01:00:00.000Z','requested_by','principal:fixture','trace_id','trace:mall-b-l6'
  ));
  perform organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','mall-b-inviter-l7','node_id','node:mall-b-inviter:l7','parent_node_id','node:mall-b-inviter:l6',
    'realm_id','realm:mall-b-inviter-l7','node_profile','consumer','mall_id',null,'signed_level','L7',
    'effective_at','2026-09-01T01:01:00.000Z','requested_by','principal:fixture','trace_id','trace:mall-b-l7'
  ));
  insert into access.membership(id,member_id,organization_id,client,status,realm_id,account_id,node_profile,access_version)
  values('membership:mall-b-inviter-l7','member:mall-b-inviter-l7','mall:mall-b','storefront','active',
    'realm:mall-b-inviter-l7',null,'consumer',1);
  insert into member.invite(
    id,organization_id,token_hash,expires_at,created_by,role_id,allowed_destination_hash,max_uses,use_count,
    effective_at,status,registration_policy_id,terms_hash,target_client
  ) values(
    'invite:mall-b-l7','mall:mall-b',invite_hash,'2027-09-12T00:00:00Z','membership:mall-b-inviter-l7',
    'role:storefront',shared_subject,10,0,'2026-09-01T01:02:00Z','active','policy:registration',repeat('f',64),'storefront'
  );

  select * into direct_result from organization.register_hosted_member_node(jsonb_build_object(
    'registration_id','registration:mall-a','business_number','SFLREG-MALL-A','idempotency_key','mall-a-shared-phone',
    'registration_origin','direct','registration_host_node_id','node:zhudatuan:l0','invitation_token_hash',null,
    'business_identity_hash',shared_subject,'node_key','mall-a-member','realm_id','realm:mall-a-member',
    'membership_id','membership:mall-a-member','requested_by','principal:mall-a','trace_id','trace:mall-a'
  ));
  select * into invited_result from organization.register_hosted_member_node(jsonb_build_object(
    'registration_id','registration:mall-b','business_number','SFLREG-MALL-B','idempotency_key','mall-b-shared-phone',
    'registration_origin','invitation','registration_host_node_id','node:mall-b:l0','invitation_token_hash',invite_hash,
    'business_identity_hash',shared_subject,'node_key','mall-b-member','realm_id','realm:mall-b-member',
    'membership_id','membership:mall-b-member','requested_by','principal:mall-b','trace_id','trace:mall-b'
  ));
  if direct_result.signed_level<>'L6' or direct_result.parent_node_id<>'node:zhudatuan:l0'
    or invited_result.signed_level<>'L8' or invited_result.parent_node_id<>'node:mall-b-inviter:l7'
    or direct_result.line_id=invited_result.line_id or direct_result.realm_id=invited_result.realm_id
    or direct_result.membership_id=invited_result.membership_id then
    raise exception 'SFL_MULTI_REALM_REGISTRATION_POSITION_INVALID';
  end if;

  insert into identity.principal(id,status,created_at,updated_at) values
    ('principal:mall-a','active',clock_timestamp(),clock_timestamp()),
    ('principal:mall-b','active',clock_timestamp(),clock_timestamp());
  insert into identity.account(
    id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at
  ) values
    ('account:mall-a','realm:mall-a-member','principal:mall-a','active',1,2,clock_timestamp(),clock_timestamp()),
    ('account:mall-b','realm:mall-b-member','principal:mall-b','active',1,2,clock_timestamp(),clock_timestamp());
  insert into identity.credential(
    id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id
  ) values
    ('credential:mall-a','principal:mall-a','password',shared_subject,'hash:a','active',clock_timestamp(),'realm:mall-a-member','account:mall-a'),
    ('credential:mall-b','principal:mall-b','password',shared_subject,'hash:b','active',clock_timestamp(),'realm:mall-b-member','account:mall-b');
  insert into access.membership(
    id,member_id,organization_id,client,status,realm_id,account_id,node_profile,access_version
  ) values
    ('membership:mall-a-member','member:mall-a','mall-zhudatuan','storefront','active','realm:mall-a-member','account:mall-a','consumer',3),
    ('membership:mall-b-member','member:mall-b','mall:mall-b','storefront','active','realm:mall-b-member','account:mall-b','consumer',8);

  select * into context_a from identity.resolve_active_membership_context(
    'realm:l0','account:mall-a','membership:mall-a-member');
  select * into context_b from identity.resolve_active_membership_context(
    'realm:mall-b','account:mall-b','membership:mall-b-member');
  if context_a.current_realm_id<>'realm:mall-a-member' or context_a.node_id<>'node:mall-a-member:l6'
    or context_a.line_id=context_b.line_id or context_a.active_membership_id=context_b.active_membership_id
    or context_a.access_version<>3 or context_b.access_version<>8
    or context_b.current_realm_id<>'realm:mall-b-member' or context_b.node_id<>'node:mall-b-member:l8'
    or context_b.parent_node_id<>'node:mall-b-inviter:l7' then
    raise exception 'SFL_MULTI_REALM_ACTIVE_CONTEXT_INVALID';
  end if;
  if exists(select 1 from identity.resolve_active_membership_context(
      'realm:l0','account:mall-b','membership:mall-b-member'))
    or exists(select 1 from identity.resolve_active_membership_context(
      'realm:mall-b','account:mall-a','membership:mall-a-member')) then
    raise exception 'SFL_MULTI_REALM_CONTEXT_CROSSOVER';
  end if;

  insert into identity.session(
    id,principal_id,membership_id,token_hash,credential_version,access_version,client,assurance_level,
    realm_id,account_id,auth_target,expires_at,last_seen_at,created_at
  ) values
    ('session:mall-a','principal:mall-a','membership:mall-a-member',encode(public.digest('token-a','sha256'),'hex'),1,3,'storefront',2,
      'realm:mall-a-member','account:mall-a','storefront-a',clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
    ('session:mall-b','principal:mall-b','membership:mall-b-member',encode(public.digest('token-b','sha256'),'hex'),1,8,'storefront',2,
      'realm:mall-b-member','account:mall-b','storefront-b',clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
  if (select count(*) from identity.resolve_session(encode(public.digest('token-a','sha256'),'hex'),'api.mall-a.test'))<>1
    or (select count(*) from identity.resolve_session(encode(public.digest('token-b','sha256'),'hex'),'api.mall-b.test'))<>1
    or exists(select 1 from identity.resolve_session(encode(public.digest('token-a','sha256'),'hex'),'api.mall-b.test'))
    or exists(select 1 from identity.resolve_session(encode(public.digest('token-b','sha256'),'hex'),'api.mall-a.test')) then
    raise exception 'SFL_MULTI_REALM_SESSION_ISOLATION_INVALID';
  end if;

  update access.membership set status='suspended' where id='membership:mall-a-member';
  if exists(select 1 from identity.resolve_active_membership_context(
      'realm:l0','account:mall-a','membership:mall-a-member'))
    or not exists(select 1 from identity.resolve_active_membership_context(
      'realm:mall-b','account:mall-b','membership:mall-b-member')) then
    raise exception 'SFL_MULTI_REALM_LIFECYCLE_ISOLATION_INVALID';
  end if;
end
$contract$;

begin;
select * from organization.register_hosted_member_node(jsonb_build_object(
  'registration_id','registration:rollback','business_number','SFLREG-ROLLBACK','idempotency_key','rollback-shared-phone',
  'registration_origin','direct','registration_host_node_id','node:zhudatuan:l0','invitation_token_hash',null,
  'business_identity_hash',repeat('c',64),'node_key','rollback-member','realm_id','realm:rollback-member',
  'membership_id','membership:rollback-member','requested_by','principal:rollback','trace_id','trace:rollback'
));
insert into identity.principal(id,status,created_at,updated_at)
values('principal:rollback','active',clock_timestamp(),clock_timestamp());
insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at)
values('account:rollback','realm:rollback-member','principal:rollback','active',1,2,clock_timestamp(),clock_timestamp());
rollback;

do $rollback$
begin
  if exists(select 1 from organization.membernoderegistration where registration_id='registration:rollback')
    or exists(select 1 from identity.realm where id='realm:rollback-member')
    or exists(select 1 from identity.account where id='account:rollback')
    or exists(select 1 from organization.node where id='node:rollback-member:l6') then
    raise exception 'SFL_MULTI_REALM_TRANSACTION_ROLLBACK_INVALID';
  end if;
end
$rollback$;

select * from organization.register_hosted_member_node(jsonb_build_object(
  'registration_id','registration:rollback','business_number','SFLREG-ROLLBACK','idempotency_key','rollback-shared-phone',
  'registration_origin','direct','registration_host_node_id','node:zhudatuan:l0','invitation_token_hash',null,
  'business_identity_hash',repeat('c',64),'node_key','rollback-member','realm_id','realm:rollback-member',
  'membership_id','membership:rollback-member','requested_by','principal:rollback','trace_id','trace:rollback'
));

do $retry$
begin
  if (select count(*) from organization.membernoderegistration where registration_id='registration:rollback')<>1
    or (select count(*) from identity.realm where id='realm:rollback-member')<>1
    or (select count(*) from organization.node where id='node:rollback-member:l6')<>1
    or (select count(*) from identity.realmtarget where realm_id='realm:rollback-member')<>1 then
    raise exception 'SFL_MULTI_REALM_TRANSACTION_RETRY_INVALID';
  end if;
end
$retry$;
