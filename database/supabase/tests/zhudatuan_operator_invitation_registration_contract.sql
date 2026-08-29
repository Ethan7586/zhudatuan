begin;

do $contract$
declare
  policy_id text;
  policy_terms_hash char(64);
begin
  if not exists(select 1 from information_schema.columns
      where table_schema='member' and table_name='invite' and column_name='target_client')
    or not exists(select 1 from information_schema.columns
      where table_schema='member' and table_name='invite' and column_name='storefront_organization_id') then
    raise exception 'CONTRACT_OPERATOR_INVITATION_COLUMNS_MISSING';
  end if;
  if not exists(select 1 from access.role where id='role-zhudatuan-pending-operator'
      and scope_id='tenant-zhudatuan' and status='active')
    or exists(select 1 from access.rolepermission where role_id='role-zhudatuan-pending-operator') then
    raise exception 'CONTRACT_PENDING_OPERATOR_ROLE_NOT_ZERO_PERMISSION';
  end if;
  if (select count(*) from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
      and permission.code='identity.invitation.manage')<>1
    or exists(select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id<>'role-platform-owner-v2'
        and permission.code='identity.invitation.manage') then
    raise exception 'CONTRACT_OWNER_INVITATION_PERMISSION_MISSING';
  end if;

  begin
    insert into access.rolepermission(role_id,permission_id,effect)
    select 'role-zhudatuan-pending-operator',id,'allow'
    from access.permission where code='member.read';
    raise exception 'CONTRACT_PENDING_OPERATOR_PERMISSION_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%ZHUDATUAN_PENDING_OPERATOR_PERMISSION_FORBIDDEN%' then raise; end if;
  end;

  select id,registrationpolicy.terms_hash into policy_id,policy_terms_hash
  from identity.registrationpolicy registrationpolicy
  where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())
  order by version desc limit 1;

  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  values(
    'invite:contract-storefront','mall-zhudatuan','商城回归邀请',repeat('1',64),repeat('2',64),
    clock_timestamp()+interval '1 day','contract',
    'role-zhudatuan-storefront-member',null,1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'storefront',null
  );
  if not exists(select 1 from member.invite where id='invite:contract-storefront'
      and target_client='storefront' and storefront_organization_id is null) then
    raise exception 'CONTRACT_STOREFRONT_INVITATION_REGRESSION';
  end if;

  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  values(
    'invite:contract-operator','tenant-zhudatuan','普通管理员邀请',repeat('3',64),repeat('4',64),
    clock_timestamp()+interval '1 day','membership-platform-owner-ethan-v1',
    'role-zhudatuan-pending-operator',repeat('3',64),1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'operator','mall-zhudatuan'
  );
  if not exists(select 1 from member.invite where id='invite:contract-operator'
      and target_client='operator' and role_id='role-zhudatuan-pending-operator'
      and max_uses=1 and allowed_destination_hash is not null) then
    raise exception 'CONTRACT_OPERATOR_INVITATION_NOT_FIXED_PENDING';
  end if;

  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  values(
    'invite:contract-cross-tenant','mall-demo','跨租户隐藏邀请',repeat('7',64),repeat('8',64),
    clock_timestamp()+interval '1 day','contract',
    'role-zhudatuan-storefront-member',null,1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'storefront',null
  );

  insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
  values('principal:contract-invitation-rls','active',1,clock_timestamp(),clock_timestamp(),0);
  insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
  values('member:contract-invitation-rls','principal:contract-invitation-rls','Invitation RLS','active',clock_timestamp(),clock_timestamp(),0);
  insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
  values('membership:contract-invitation-rls','member:contract-invitation-rls','tenant-zhudatuan','operator','active',1,clock_timestamp());

  insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
  values('principal:zhudatuan:owner:ethan:v1','active',1,clock_timestamp(),clock_timestamp(),0)
  on conflict(id) do update set status='active',credential_version=1,updated_at=clock_timestamp();
  insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at)
  values('credential:password:zhudatuan-owner-ethan:v1','principal:zhudatuan:owner:ethan:v1','password',
    repeat('a',64),'contract-owner-secret','active',clock_timestamp(),clock_timestamp())
  on conflict(id) do update set secret_hash='contract-owner-secret',status='active',rotated_at=clock_timestamp();
  insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
  values('member:zhudatuan:owner:ethan:v1','principal:zhudatuan:owner:ethan:v1','Owner Contract','active',clock_timestamp(),clock_timestamp(),0)
  on conflict(id) do update set display_name='Owner Contract',status='active',updated_at=clock_timestamp();
  insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
  values('membership-platform-owner-ethan-v1','member:zhudatuan:owner:ethan:v1','tenant-zhudatuan','operator','active',1,clock_timestamp())
  on conflict(id) do update set member_id='member:zhudatuan:owner:ethan:v1',
    organization_id='tenant-zhudatuan',client='operator',status='active',
    access_version=1,joined_at=clock_timestamp(),left_at=null;
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership-platform-owner-ethan-v1','role-platform-owner-v2','1970-01-01T00:00:00Z')
  on conflict do nothing;
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values('scope:contract-owner:tenant','membership-platform-owner-ethan-v1','tenant','tenant-zhudatuan',
    'tenant-zhudatuan','allow','1970-01-01T00:00:00Z',1)
  on conflict do nothing;

  begin
    insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
      role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
      registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
    values(
      'invite:contract-owner','tenant-zhudatuan','非法 Owner 邀请',repeat('5',64),repeat('6',64),
      clock_timestamp()+interval '1 day','membership-platform-owner-ethan-v1',
      'role-platform-owner-v2',repeat('5',64),1,0,clock_timestamp(),'active',clock_timestamp(),
      policy_id,policy_terms_hash,0,'operator','mall-zhudatuan'
    );
    raise exception 'CONTRACT_OWNER_INVITATION_ALLOWED';
  exception when check_violation then null;
  end;

  insert into access.permission(id,code,risk,status)
  values('permission:contract-owner-transition','contract.ownertransition','critical','active');
  insert into access.role(id,scope_id,name,status,version)
  values('role:contract-owner-transition','tenant-zhudatuan','Owner transition fixture','active',0);
  insert into access.rolepermission(role_id,permission_id,effect)
  values('role:contract-owner-transition','permission:contract-owner-transition','allow');
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership:contract-invitation-rls','role:contract-owner-transition','2000-01-01T00:00:00Z');
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values('scope:contract-owner-transition','membership:contract-invitation-rls','tenant','tenant-zhudatuan',
    'tenant-zhudatuan','allow','2000-01-01T00:00:00Z',1);
  insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
  values('membership:contract-invitation-rls','permission:contract-owner-transition','allow','contract',
    'Owner transition guard fixture','2000-01-01T00:00:00Z');
  insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
  values('credential:contract-owner-transition','principal:contract-invitation-rls','password',
    repeat('f',64),'contract-transition-secret','active',clock_timestamp());

  insert into access.role(id,scope_id,name,status,version) values
    ('role:contract-mall-invitation-manager','mall-zhudatuan','Mall invitation manager fixture','active',0),
    ('role:contract-disabled-invitation-manager','mall-zhudatuan','Disabled invitation manager fixture','disabled',0),
    ('role:contract-wrong-scope-invitation-manager','mall-demo','Wrong scope invitation manager fixture','active',0);
  insert into access.rolepermission(role_id,permission_id,effect)
  select fixture.role_id,permission.id,'allow'
  from access.permission permission
  cross join lateral(values
    ('role:contract-mall-invitation-manager'),
    ('role:contract-disabled-invitation-manager'),
    ('role:contract-wrong-scope-invitation-manager')
  ) fixture(role_id)
  where permission.code='identity.invitation.manage';
  insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
  values('principal:contract-mall-invitation-manager','active',1,clock_timestamp(),clock_timestamp(),0);
  insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
  values('member:contract-mall-invitation-manager','principal:contract-mall-invitation-manager',
    'Mall invitation manager','active',clock_timestamp(),clock_timestamp(),0);
  insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
  values('membership:contract-mall-invitation-manager','member:contract-mall-invitation-manager',
    'mall-zhudatuan','operator','active',2,clock_timestamp());
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership:contract-mall-invitation-manager','role:contract-mall-invitation-manager','2000-01-01T00:00:00Z');
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values('scope:contract-mall-invitation-manager-stale','membership:contract-mall-invitation-manager',
    'mall','mall-zhudatuan','mall-zhudatuan','allow','2000-01-01T00:00:00Z',3);
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values('scope:contract-mall-invitation-manager-cross','membership:contract-mall-invitation-manager',
    'mall','mall-demo','mall-demo','allow','2000-01-01T00:00:00Z',2);
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values('scope:contract-mall-manager-self','membership:contract-mall-invitation-manager','self',
    'self:principal:contract-mall-invitation-manager','self:principal:contract-mall-invitation-manager',
    'allow','2000-01-01T00:00:00Z',1);
end
$contract$;

set local role zhudatuanidentityapi;
select set_config('app.membership_id','',true),set_config('app.scope_id','public:identity',true);
do $public_rls$
begin
  if (select count(*) from member.invite where id in('invite:contract-storefront','invite:contract-operator'))<>2
    or exists(select 1 from member.invite where id='invite:contract-cross-tenant') then
    raise exception 'CONTRACT_PUBLIC_INVITATION_RLS_INVALID';
  end if;
end
$public_rls$;

do $public_consume$
declare affected integer;
begin
  begin
    update member.invite set token_hash=repeat('f',64),use_count=use_count+1,
      accepted_at=clock_timestamp(),version=version+1
    where id='invite:contract-operator';
    raise exception 'CONTRACT_PUBLIC_INVITATION_HIJACK_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_IMMUTABLE_BOUNDARY_INVALID%' then raise; end if;
  end;

  update member.invite set use_count=use_count+1,
    accepted_at=case when use_count+1=max_uses then clock_timestamp() else accepted_at end,
    version=version+1
  where id='invite:contract-operator';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_OPERATOR_INVITATION_CONSUME_FAILED'; end if;
end
$public_consume$;

insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
values('principal:contract-operator-registration','active',1,clock_timestamp(),clock_timestamp(),0);
insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
values('credential:contract-operator-registration','principal:contract-operator-registration','password',
  repeat('3',64),'contract-secret','active',clock_timestamp());
insert into member.profile(id,principal_id,display_name,mobile_token,mobile_masked,status,created_at,updated_at,version)
values('member:contract-operator-registration','principal:contract-operator-registration','Contract Operator',
  repeat('3',64),'138****8000','active',clock_timestamp(),clock_timestamp(),0);
insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at) values
  ('membership:contract-operator-storefront','member:contract-operator-registration','mall-zhudatuan','storefront','active',1,clock_timestamp()),
  ('membership:contract-operator-console','member:contract-operator-registration','tenant-zhudatuan','operator','active',1,clock_timestamp());
insert into access.membershiprole(membership_id,role_id,effective_at) values
  ('membership:contract-operator-storefront','role-zhudatuan-storefront-member',clock_timestamp()),
  ('membership:contract-operator-storefront','role:self',clock_timestamp()),
  ('membership:contract-operator-console','role-zhudatuan-pending-operator',clock_timestamp()),
  ('membership:contract-operator-console','role:self',clock_timestamp());
insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
  ('scope:contract-operator:mall','membership:contract-operator-storefront','mall','mall-zhudatuan','mall-zhudatuan','allow',clock_timestamp(),1),
  ('scope:contract-operator:owner','membership:contract-operator-storefront','owner','member:contract-operator-registration','member:contract-operator-registration','allow',clock_timestamp(),1),
  ('scope:contract-operator:storefront-self','membership:contract-operator-storefront','self','self:principal:contract-operator-registration','self:principal:contract-operator-registration','allow',clock_timestamp(),1),
  ('scope:contract-operator:tenant','membership:contract-operator-console','tenant','tenant-zhudatuan','tenant-zhudatuan','allow',clock_timestamp(),1),
  ('scope:contract-operator:console-self','membership:contract-operator-console','self','self:principal:contract-operator-registration','self:principal:contract-operator-registration','allow',clock_timestamp(),1);

do $registration_access_boundary$
begin
  if (select count(*) from access.membership where id in(
      'membership:contract-operator-storefront','membership:contract-operator-console'))<>2
    or (select count(*) from access.membershiprole where membership_id in(
      'membership:contract-operator-storefront','membership:contract-operator-console'))<>4
    or (select count(*) from access.scopegrant where membership_id in(
      'membership:contract-operator-storefront','membership:contract-operator-console'))<>5 then
    raise exception 'CONTRACT_OPERATOR_DUAL_MEMBERSHIP_REGISTRATION_FAILED';
  end if;
  begin
    insert into access.membershiprole(membership_id,role_id,effective_at)
    values('membership:contract-operator-console','role-platform-owner-v2',clock_timestamp());
    raise exception 'CONTRACT_REGISTRATION_OWNER_ROLE_INJECTION_ALLOWED';
  exception when others then
    if sqlerrm like '%CONTRACT_REGISTRATION_OWNER_ROLE_INJECTION_ALLOWED%' then raise; end if;
  end;
  begin
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:contract-operator:platform','membership:contract-operator-console','platform',
      'organization-platform-root','organization-platform-root','allow',clock_timestamp(),1);
    raise exception 'CONTRACT_REGISTRATION_PLATFORM_SCOPE_INJECTION_ALLOWED';
  exception when others then
    if sqlerrm like '%CONTRACT_REGISTRATION_PLATFORM_SCOPE_INJECTION_ALLOWED%' then raise; end if;
  end;
end
$registration_access_boundary$;

update member.invite set use_count=use_count+1,
  accepted_at=case when use_count+1=max_uses then clock_timestamp() else accepted_at end,
  version=version+1
where id='invite:contract-storefront';
insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
values('principal:contract-storefront-registration','active',1,clock_timestamp(),clock_timestamp(),0);
insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
values('credential:contract-storefront-registration','principal:contract-storefront-registration','password',
  repeat('9',64),'contract-storefront-secret','active',clock_timestamp());
insert into member.profile(id,principal_id,display_name,mobile_token,mobile_masked,status,created_at,updated_at,version)
values('member:contract-storefront-registration','principal:contract-storefront-registration','Contract Storefront',
  repeat('9',64),'139****9000','active',clock_timestamp(),clock_timestamp(),0);
insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
values('membership:contract-storefront-registration','member:contract-storefront-registration',
  'mall-zhudatuan','storefront','active',1,clock_timestamp());
insert into access.membershiprole(membership_id,role_id,effective_at) values
  ('membership:contract-storefront-registration','role-zhudatuan-storefront-member',clock_timestamp()),
  ('membership:contract-storefront-registration','role:self',clock_timestamp());
insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
  ('scope:contract-storefront:mall','membership:contract-storefront-registration','mall','mall-zhudatuan','mall-zhudatuan','allow',clock_timestamp(),1),
  ('scope:contract-storefront:owner','membership:contract-storefront-registration','owner','member:contract-storefront-registration','member:contract-storefront-registration','allow',clock_timestamp(),1),
  ('scope:contract-storefront:self','membership:contract-storefront-registration','self','self:principal:contract-storefront-registration','self:principal:contract-storefront-registration','allow',clock_timestamp(),1);
do $storefront_registration_regression$
begin
  if not exists(select 1 from access.membership
      where id='membership:contract-storefront-registration' and client='storefront' and status='active')
    or (select count(*) from access.membershiprole
      where membership_id='membership:contract-storefront-registration')<>2
    or (select count(*) from access.scopegrant
      where membership_id='membership:contract-storefront-registration')<>3 then
    raise exception 'CONTRACT_STOREFRONT_REGISTRATION_REGRESSION';
  end if;
end
$storefront_registration_regression$;

select set_config('app.membership_id','membership:contract-invitation-rls',true),
  set_config('app.scope_id','tenant-zhudatuan',true),
  set_config('app.actor_id','principal:contract-invitation-rls',true);
do $tenant_rls$
declare affected integer;
begin
  if exists(select 1 from member.invite where id='invite:contract-cross-tenant') then
    raise exception 'CONTRACT_INVITATION_TENANT_READ_LEAK';
  end if;
  begin
    insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
      role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
      registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
    select 'invite:contract-cross-tenant-write','tenant-smart-wing','跨租户写入',repeat('9',64),repeat('a',64),
      clock_timestamp()+interval '1 day','membership:contract-invitation-rls',
      'role-zhudatuan-pending-operator',repeat('9',64),1,0,clock_timestamp(),'active',clock_timestamp(),
      id,registrationpolicy.terms_hash,0,'operator','mall-demo'
    from identity.registrationpolicy registrationpolicy
    where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())
    order by version desc limit 1;
    raise exception 'CONTRACT_INVITATION_TENANT_WRITE_LEAK';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm not like '%ZHUDATUAN_INVITATION_CREATE_BOUNDARY_INVALID%' then raise; end if;
  end;
  begin
    insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
      role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
      registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
    select 'invite:contract-no-role-write','tenant-zhudatuan','同租户无权限写入',repeat('b',64),repeat('c',64),
      clock_timestamp()+interval '1 day','membership:contract-invitation-rls',
      'role-zhudatuan-pending-operator',repeat('b',64),1,0,clock_timestamp(),'active',clock_timestamp(),
      id,registrationpolicy.terms_hash,0,'operator','mall-zhudatuan'
    from identity.registrationpolicy registrationpolicy
    where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())
    order by version desc limit 1;
    raise exception 'CONTRACT_NO_ROLE_SAME_TENANT_INSERT_ALLOWED';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm not like '%ZHUDATUAN_INVITATION_CREATE_BOUNDARY_INVALID%' then raise; end if;
  end;
  update member.invite set status='disabled',version=version+1
  where id='invite:contract-operator';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'CONTRACT_NO_ROLE_SAME_TENANT_UPDATE_ALLOWED'; end if;
end
$tenant_rls$;

select set_config('app.membership_id','membership-platform-owner-ethan-v1',true),
  set_config('app.scope_id','tenant-zhudatuan',true),
  set_config('app.actor_id','principal:zhudatuan:owner:ethan:v1',true),
  set_config('app.workload','api',true);
do $owner_invitation_management$
declare
  policy_id text;
  policy_terms_hash char(64);
  affected integer;
begin
  if not access.zhudatuan_invitation_owner() then
    raise exception 'CONTRACT_EXACT_OWNER_NOT_RECOGNIZED';
  end if;
  update identity.credential set secret_hash='contract-owner-secret-rotated',rotated_at=clock_timestamp()
  where id='credential:password:zhudatuan-owner-ethan:v1';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_OWNER_PASSWORD_ROTATION_FAILED'; end if;
  begin
    update identity.credential set status='revoked',rotated_at=clock_timestamp()
    where id='credential:password:zhudatuan-owner-ethan:v1';
    raise exception 'CONTRACT_OWNER_CREDENTIAL_DISABLE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  select id,terms_hash into policy_id,policy_terms_hash
  from identity.registrationpolicy
  where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())
  order by version desc limit 1;
  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  values('invite:contract-owner-managed','tenant-zhudatuan','Owner 正常邀请',repeat('d',64),repeat('e',64),
    clock_timestamp()+interval '1 day','membership-platform-owner-ethan-v1',
    'role-zhudatuan-pending-operator',repeat('d',64),1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'operator','mall-zhudatuan');
  begin
    update member.invite set token_hash=repeat('0',64),status='disabled',version=version+1
    where id='invite:contract-owner-managed';
    raise exception 'CONTRACT_OWNER_INVITATION_HIJACK_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_IMMUTABLE_BOUNDARY_INVALID%' then raise; end if;
  end;
  update member.invite set status='disabled',version=version+1
  where id='invite:contract-owner-managed';
  get diagnostics affected=row_count;
  if affected<>1 or not exists(select 1 from member.invite
      where id='invite:contract-owner-managed' and status='disabled' and version=1) then
    raise exception 'CONTRACT_OWNER_INVITATION_REVOKE_FAILED';
  end if;
end
$owner_invitation_management$;
reset role;

set local role shopapp;
select set_config('app.membership_id','membership-platform-owner-ethan-v1',true),
  set_config('app.scope_id','self:principal:zhudatuan:owner:ethan:v1',true),
  set_config('app.actor_id','principal:zhudatuan:owner:ethan:v1',true),
  set_config('app.workload','api',true);
do $owner_runtime_guard$
declare
  affected integer;
  previous_credential_version bigint;
  previous_version bigint;
begin
  if not access.zhudatuan_owner_context() then
    raise exception 'CONTRACT_SHOPAPP_OWNER_CONTEXT_NOT_RECOGNIZED';
  end if;
  select credential_version,version into previous_credential_version,previous_version
  from identity.principal where id='principal:zhudatuan:owner:ethan:v1';
  update identity.credential set secret_hash='contract-owner-secret-shopapp-rotated',rotated_at=clock_timestamp()
  where id='credential:password:zhudatuan-owner-ethan:v1';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_SHOPAPP_OWNER_PASSWORD_ROTATION_FAILED'; end if;
  update identity.principal set credential_version=credential_version+1,
    updated_at=clock_timestamp(),version=version+1
  where id='principal:zhudatuan:owner:ethan:v1';
  get diagnostics affected=row_count;
  if affected<>1 or not exists(select 1 from identity.principal
      where id='principal:zhudatuan:owner:ethan:v1'
        and credential_version=previous_credential_version+1 and version=previous_version+1) then
    raise exception 'CONTRACT_SHOPAPP_OWNER_COMPLETE_PASSWORD_CHANGE_FAILED';
  end if;
  begin
    update identity.principal set status='disabled',updated_at=clock_timestamp(),version=version+1
    where id='principal:zhudatuan:owner:ethan:v1';
    raise exception 'CONTRACT_OWNER_PRINCIPAL_DISABLE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  perform set_config('app.membership_id','membership:contract-invitation-rls',true),
    set_config('app.actor_id','principal:contract-invitation-rls',true),
    set_config('app.scope_id','self:principal:contract-invitation-rls',true);
  begin
    update identity.credential set secret_hash='contract-owner-secret-non-owner',rotated_at=clock_timestamp()
    where id='credential:password:zhudatuan-owner-ethan:v1';
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'CONTRACT_NON_OWNER_PASSWORD_ROTATION_ALLOWED'; end if;
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  perform set_config('app.membership_id','membership-platform-owner-ethan-v1',true),
    set_config('app.actor_id','principal:zhudatuan:owner:ethan:v1',true),
    set_config('app.scope_id','tenant-zhudatuan',true);
  begin
    update access.membership set status='suspended',access_version=access_version+1
    where id='membership-platform-owner-ethan-v1';
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'CONTRACT_RUNTIME_OWNER_MEMBERSHIP_DISABLE_ALLOWED'; end if;
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    delete from access.membershiprole
    where membership_id='membership-platform-owner-ethan-v1' and role_id='role-platform-owner-v2';
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'CONTRACT_RUNTIME_OWNER_ROLE_DELETE_ALLOWED'; end if;
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.scopegrant set expires_at=clock_timestamp()
    where membership_id='membership-platform-owner-ethan-v1' and scope_kind='tenant';
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'CONTRACT_RUNTIME_OWNER_SCOPE_EXPIRE_ALLOWED'; end if;
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    insert into access.membershiprole(membership_id,role_id,effective_at)
    values('membership:contract-invitation-rls','role-platform-owner-v2',clock_timestamp());
    raise exception 'CONTRACT_RUNTIME_SECOND_OWNER_ALLOWED';
  exception when others then
    if sqlerrm like '%CONTRACT_RUNTIME_SECOND_OWNER_ALLOWED%' then raise; end if;
  end;
  update access.role set name='Owner transition fixture updated',version=version+1
  where id='role:contract-owner-transition';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_ORDINARY_ROLE_UPDATE_BLOCKED'; end if;
  begin
    update access.role set id='role-platform-owner-v2'
    where id='role:contract-owner-transition';
    raise exception 'CONTRACT_ROLE_ID_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.rolepermission set role_id='role-platform-owner-v2'
    where role_id='role:contract-owner-transition'
      and permission_id='permission:contract-owner-transition';
    raise exception 'CONTRACT_ROLEPERMISSION_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.membershiprole set role_id='role-platform-owner-v2'
    where membership_id='membership:contract-invitation-rls'
      and role_id='role:contract-owner-transition';
    raise exception 'CONTRACT_MEMBERSHIPROLE_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.membership set id='membership-platform-owner-ethan-v1'
    where id='membership:contract-invitation-rls';
    raise exception 'CONTRACT_MEMBERSHIP_ID_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.membership set member_id='member:zhudatuan:owner:ethan:v1'
    where id='membership:contract-invitation-rls';
    raise exception 'CONTRACT_MEMBERSHIP_RELATION_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.scopegrant set membership_id='membership-platform-owner-ethan-v1'
    where id='scope:contract-owner-transition';
    raise exception 'CONTRACT_SCOPEGRANT_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update access.membershipoverride set membership_id='membership-platform-owner-ethan-v1'
    where membership_id='membership:contract-invitation-rls'
      and permission_id='permission:contract-owner-transition';
    raise exception 'CONTRACT_OVERRIDE_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update identity.credential set id='credential:password:zhudatuan-owner-ethan:v1'
    where id='credential:contract-owner-transition';
    raise exception 'CONTRACT_CREDENTIAL_ID_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update identity.credential set principal_id='principal:zhudatuan:owner:ethan:v1'
    where id='credential:contract-owner-transition';
    raise exception 'CONTRACT_CREDENTIAL_RELATION_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update member.profile set id='member:zhudatuan:owner:ethan:v1'
    where id='member:contract-invitation-rls';
    raise exception 'CONTRACT_PROFILE_ID_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update member.profile set principal_id='principal:zhudatuan:owner:ethan:v1'
    where id='member:contract-invitation-rls';
    raise exception 'CONTRACT_PROFILE_RELATION_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
  begin
    update identity.principal set id='principal:zhudatuan:owner:ethan:v1'
    where id='principal:contract-invitation-rls';
    raise exception 'CONTRACT_PRINCIPAL_ID_OWNER_TRANSITION_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_OWNER_PROTECTED%' then raise; end if;
  end;
end
$owner_runtime_guard$;

do $shopapp_invitation_boundary$
declare
  policy_id text;
  policy_terms_hash char(64);
  affected integer;
begin
  select id,terms_hash into policy_id,policy_terms_hash
  from identity.registrationpolicy
  where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())
  order by version desc limit 1;
  perform set_config('app.membership_id','membership:contract-mall-invitation-manager',true),
    set_config('app.actor_id','principal:contract-mall-invitation-manager',true),
    set_config('app.scope_id','mall-zhudatuan',true);
  update access.scopegrant set access_version=2
  where id='scope:contract-mall-invitation-manager-stale';
  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  values('invite:contract-shopapp-revoke','mall-zhudatuan','Shopapp 商城撤销邀请',repeat('1',64),repeat('9',63)||'1',
    clock_timestamp()+interval '1 day','membership:contract-mall-invitation-manager',
    'role-zhudatuan-storefront-member',null,1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'storefront',null);
  update access.scopegrant set access_version=3
  where id='scope:contract-mall-invitation-manager-stale';
  begin
    update member.invite set token_hash=repeat('3',64),expires_at=clock_timestamp()+interval '2 days',
      status='disabled',version=version+1 where id='invite:contract-shopapp-revoke';
    raise exception 'CONTRACT_SHOPAPP_INVITATION_HIJACK_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_IMMUTABLE_BOUNDARY_INVALID%' then raise; end if;
  end;
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-cross-tenant';
    raise exception 'CONTRACT_SHOPAPP_CROSS_SCOPE_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  perform set_config('app.membership_id','membership:contract-invitation-rls',true),
    set_config('app.actor_id','principal:contract-invitation-rls',true);
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-shopapp-revoke';
    raise exception 'CONTRACT_SHOPAPP_NO_PERMISSION_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
  select 'membership:contract-invitation-rls',permission.id,'allow','contract',
    'Exact Owner invitation boundary fixture','2000-01-01T00:00:00Z'
  from access.permission permission where permission.code='identity.invitation.manage';
  begin
    insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
      role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
      registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
    values('invite:contract-non-owner-operator-create','tenant-zhudatuan','非 Owner 普通管理员邀请',
      repeat('2',64),repeat('5',63)||'a',clock_timestamp()+interval '1 day','membership:contract-invitation-rls',
      'role-zhudatuan-pending-operator',repeat('2',64),1,0,clock_timestamp(),'active',clock_timestamp(),
      policy_id,policy_terms_hash,0,'operator','mall-zhudatuan');
    raise exception 'CONTRACT_NON_OWNER_OPERATOR_INVITATION_CREATE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_CREATE_BOUNDARY_INVALID%' then raise; end if;
  end;
  perform set_config('app.membership_id','membership-platform-owner-ethan-v1',true),
    set_config('app.actor_id','principal:zhudatuan:owner:ethan:v1',true);
  update member.invite set status='disabled',version=version+1
  where id='invite:contract-shopapp-revoke';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_SHOPAPP_INVITATION_REVOKE_FAILED'; end if;

  perform set_config('app.membership_id','membership:contract-mall-invitation-manager',true),
    set_config('app.actor_id','principal:contract-mall-invitation-manager',true),
    set_config('app.scope_id','mall-zhudatuan',true);
  update access.scopegrant set access_version=2
  where id='scope:contract-mall-invitation-manager-stale';
  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  select fixture.id,'mall-zhudatuan',fixture.label,repeat('a',64),fixture.token_hash,
    clock_timestamp()+interval '1 day','membership:contract-mall-invitation-manager',
    'role-zhudatuan-storefront-member',null,1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'storefront',null
  from (values
    ('invite:contract-manager-stale-grant','过期范围版本拒绝',repeat('7',63)||'a'),
    ('invite:contract-manager-disabled-role','停用角色拒绝',repeat('7',63)||'b'),
    ('invite:contract-manager-wrong-role-scope','错误角色范围拒绝',repeat('7',63)||'c'),
    ('invite:contract-manager-missing-grant','缺少范围授权拒绝',repeat('7',63)||'d'),
    ('invite:contract-manager-override-deny','个人拒绝优先',repeat('7',63)||'e'),
    ('invite:contract-manager-allowed','商城管理员正常撤销',repeat('7',63)||'f'),
    ('invite:contract-manager-override-allow','个人授权正常撤销',repeat('6',63)||'a')
  ) fixture(id,label,token_hash);
  update access.scopegrant set access_version=3
  where id='scope:contract-mall-invitation-manager-stale';
  perform set_config('app.membership_id','membership:contract-mall-invitation-manager',true),
    set_config('app.actor_id','principal:contract-mall-invitation-manager',true),
    set_config('app.scope_id','mall-zhudatuan',true);
  begin
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values('scope:contract-runtime-deny','membership:contract-mall-invitation-manager','mall','mall-zhudatuan',
      'mall-zhudatuan','deny',clock_timestamp(),2);
    raise exception 'CONTRACT_RUNTIME_SCOPE_DENY_INSERT_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%SCOPE_DENY_UNSUPPORTED%' then raise; end if;
  end;
  begin
    update access.scopegrant set effect='deny'
    where id='scope:contract-mall-invitation-manager-stale';
    raise exception 'CONTRACT_RUNTIME_SCOPE_DENY_UPDATE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%SCOPE_DENY_UNSUPPORTED%' then raise; end if;
  end;
  if exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where (grantrow->'permissions') ? 'identity.invitation.manage'
  ) then raise exception 'CONTRACT_FUTURE_SCOPEGRANT_RESOLVED'; end if;
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-manager-stale-grant';
    raise exception 'CONTRACT_FUTURE_SCOPEGRANT_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  update access.scopegrant set access_version=2
  where id='scope:contract-mall-invitation-manager-stale';

  delete from access.membershiprole
  where membership_id='membership:contract-mall-invitation-manager';
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership:contract-mall-invitation-manager','role:contract-disabled-invitation-manager','2000-01-01T00:00:00Z');
  if exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where (grantrow->'permissions') ? 'identity.invitation.manage'
  ) or exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id in('identity.invitations.create','identity.invitations.revoke')
  ) then raise exception 'CONTRACT_DISABLED_ROLE_STILL_AUTHORIZES_INVITATION'; end if;
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-manager-disabled-role';
    raise exception 'CONTRACT_DISABLED_ROLE_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;

  delete from access.membershiprole
  where membership_id='membership:contract-mall-invitation-manager';
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership:contract-mall-invitation-manager','role:contract-wrong-scope-invitation-manager','2000-01-01T00:00:00Z');
  if exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where (grantrow->'permissions') ? 'identity.invitation.manage'
  ) or exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id in('identity.invitations.create','identity.invitations.revoke')
  ) then raise exception 'CONTRACT_CROSS_TENANT_ROLE_ASSIGNMENT_AUTHORIZED'; end if;
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-manager-wrong-role-scope';
    raise exception 'CONTRACT_WRONG_SCOPE_ROLE_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  perform set_config('app.scope_id','mall-demo',true);
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-cross-tenant';
    raise exception 'CONTRACT_CROSS_TENANT_ROLE_AND_GRANT_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  perform set_config('app.scope_id','mall-zhudatuan',true);

  delete from access.membershiprole
  where membership_id='membership:contract-mall-invitation-manager';
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership:contract-mall-invitation-manager','role:contract-mall-invitation-manager','2000-01-01T00:00:00Z');
  delete from access.scopegrant
  where membership_id='membership:contract-mall-invitation-manager' and scope_kind='mall';
  if exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where (grantrow->'permissions') ? 'identity.invitation.manage'
  ) or exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id in('identity.invitations.create','identity.invitations.revoke')
  ) then raise exception 'CONTRACT_MISSING_SCOPEGRANT_STILL_AUTHORIZES_INVITATION'; end if;
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-manager-missing-grant';
    raise exception 'CONTRACT_MISSING_SCOPEGRANT_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
  values('scope:contract-mall-invitation-manager-valid','membership:contract-mall-invitation-manager',
    'mall','mall-zhudatuan','mall-zhudatuan','allow','2000-01-01T00:00:00Z',1);
  if not exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where (grantrow->'permissions') ? 'identity.invitation.manage'
  ) or not exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id='identity.invitations.revoke'
  ) then raise exception 'CONTRACT_ACTIVE_MALL_MANAGER_NOT_AUTHORIZED'; end if;
  insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
  select 'membership:contract-mall-invitation-manager',permission.id,'allow','contract',
    'Self permission override fixture','2000-01-01T00:00:00Z'
  from access.permission permission where permission.code='identity.credential.manage';
  if not exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where grantrow->'scope'->>'kind'='self'
      and (grantrow->'permissions') ? 'identity.credential.manage'
  ) or not exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where grantrow->'scope'->>'kind'='mall'
      and (grantrow->'permissions') ? 'identity.credential.manage'
  ) or not exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id='identity.password.change'
  ) then raise exception 'CONTRACT_OVERRIDE_ALLOW_NOT_PROJECTED_TO_VALID_SCOPES'; end if;
  update access.membershipoverride set effect='deny'
  where membership_id='membership:contract-mall-invitation-manager'
    and permission_id=(select id from access.permission where code='identity.credential.manage');
  if not exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    where 'identity.credential.manage'=any(resolved.denies)
  ) or exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id='identity.password.change'
  ) then raise exception 'CONTRACT_OVERRIDE_DENY_NOT_PRECEDENT'; end if;

  insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
  select 'membership:contract-mall-invitation-manager',permission.id,'deny','contract',
    'Invitation deny precedence fixture','2000-01-01T00:00:00Z'
  from access.permission permission where permission.code='identity.invitation.manage';
  if not exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    where 'identity.invitation.manage'=any(resolved.denies)
  ) or exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id in('identity.invitations.create','identity.invitations.revoke')
  ) then raise exception 'CONTRACT_INVITATION_OVERRIDE_DENY_NOT_PRECEDENT'; end if;
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-manager-override-deny';
    raise exception 'CONTRACT_OVERRIDE_DENY_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  delete from access.membershipoverride
  where membership_id='membership:contract-mall-invitation-manager'
    and permission_id=(select id from access.permission where code='identity.invitation.manage');
  delete from access.membershiprole
  where membership_id='membership:contract-mall-invitation-manager';
  insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
  select 'membership:contract-mall-invitation-manager',permission.id,'allow','contract',
    'Invitation direct allow fixture','2000-01-01T00:00:00Z'
  from access.permission permission where permission.code='identity.invitation.manage';
  if not exists(
    select 1 from access.resolve_membership('membership:contract-mall-invitation-manager') resolved
    cross join lateral jsonb_array_elements(resolved.grants) grantrow
    where grantrow->'scope'->>'kind'='mall'
      and (grantrow->'permissions') ? 'identity.invitation.manage'
  ) or not exists(
    select 1 from capability.membership_operations('membership:contract-mall-invitation-manager') operation
    where operation.operation_id='identity.invitations.revoke'
  ) then raise exception 'CONTRACT_INVITATION_OVERRIDE_ALLOW_NOT_AUTHORIZED'; end if;
  update member.invite set status='disabled',version=version+1
  where id='invite:contract-manager-override-allow';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_INVITATION_OVERRIDE_ALLOW_REVOKE_FAILED'; end if;
  delete from access.membershipoverride
  where membership_id='membership:contract-mall-invitation-manager'
    and permission_id=(select id from access.permission where code='identity.invitation.manage');
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values('membership:contract-mall-invitation-manager','role:contract-mall-invitation-manager','2000-01-01T00:00:00Z');
  update member.invite set status='disabled',version=version+1
  where id='invite:contract-manager-allowed';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CONTRACT_ACTIVE_MALL_MANAGER_REVOKE_FAILED'; end if;
  perform set_config('app.membership_id','membership-platform-owner-ethan-v1',true),
    set_config('app.actor_id','principal:zhudatuan:owner:ethan:v1',true),
    set_config('app.scope_id','tenant-zhudatuan',true);

  insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
    role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
    registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
  values('invite:contract-shopapp-consume','tenant-zhudatuan','Shopapp 消耗邀请',repeat('4',64),repeat('9',63)||'2',
    clock_timestamp()+interval '1 day','membership-platform-owner-ethan-v1',
    'role-zhudatuan-pending-operator',repeat('4',64),1,0,clock_timestamp(),'active',clock_timestamp(),
    policy_id,policy_terms_hash,0,'operator','mall-zhudatuan');
  perform set_config('app.membership_id','membership:contract-invitation-rls',true),
    set_config('app.actor_id','principal:contract-invitation-rls',true),
    set_config('app.scope_id','tenant-zhudatuan',true);
  begin
    update member.invite set status='disabled',version=version+1
    where id='invite:contract-shopapp-consume';
    raise exception 'CONTRACT_NON_OWNER_OPERATOR_INVITATION_REVOKE_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID%' then raise; end if;
  end;
  perform set_config('app.membership_id','',true),set_config('app.actor_id','',true),
    set_config('app.scope_id','public:identity',true);
  begin
    update member.invite set token_hash=repeat('6',64),use_count=use_count+1,
      accepted_at=clock_timestamp(),version=version+1 where id='invite:contract-shopapp-consume';
    raise exception 'CONTRACT_PUBLIC_SHOPAPP_INVITATION_HIJACK_ALLOWED';
  exception when raise_exception then
    if sqlerrm not like '%ZHUDATUAN_INVITATION_IMMUTABLE_BOUNDARY_INVALID%' then raise; end if;
  end;
  update member.invite set use_count=use_count+1,accepted_at=clock_timestamp(),version=version+1
  where id='invite:contract-shopapp-consume';
  get diagnostics affected=row_count;
  if affected<>1 or not exists(select 1 from member.invite
      where id='invite:contract-shopapp-consume' and use_count=1 and accepted_at is not null and version=1) then
    raise exception 'CONTRACT_SHOPAPP_INVITATION_CONSUME_FAILED';
  end if;
end
$shopapp_invitation_boundary$;
reset role;

rollback;
