-- Run against a disposable full migration replay. The fixture always rolls back.
begin;

insert into identity.principal(id,status,created_at,updated_at)
values('principal:offboard-fixture','active',clock_timestamp(),clock_timestamp());
insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
values('member:offboard-fixture','principal:offboard-fixture','Fixture OP','active',clock_timestamp(),clock_timestamp());
insert into identity.account(id,realm_id,legacy_principal_id,status,created_at,updated_at) values
  ('account:offboard-owner','realm:l1','principal:zhudatuan:owner:ethan:v1','active',clock_timestamp(),clock_timestamp()),
  ('account:offboard-target','realm:l1','principal:offboard-fixture','active',clock_timestamp(),clock_timestamp());
insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id) values
  ('membership:offboard-owner','member:zhudatuan:owner:ethan:v1','mall:d1708f04df2dd8a61736852c4900fb43',
    'operator','active',2,clock_timestamp(),'realm:l1','account:offboard-owner'),
  ('membership:offboard-target','member:offboard-fixture','mall:d1708f04df2dd8a61736852c4900fb43',
    'operator','active',2,clock_timestamp(),'realm:l1','account:offboard-target'),
  ('membership:offboard-member','member:offboard-fixture','mall:d1708f04df2dd8a61736852c4900fb43',
    'storefront','active',1,clock_timestamp(),'realm:l1','account:offboard-target');
insert into access.membershiprole(membership_id,role_id,effective_at)
values('membership:offboard-target','role-senior-administrator-v1:tenant-zhudatuan',clock_timestamp()-interval '1 day');
insert into access.administratoridentity(
  id,membership_id,realm_id,account_id,principal_id,host_node_id,status,version,created_at
) values
  ('administrator:offboard-owner','membership:offboard-owner','realm:l1','account:offboard-owner',
    'principal:zhudatuan:owner:ethan:v1','node:hbbtzn:l1','active',1,clock_timestamp()),
  ('administrator:offboard-target','membership:offboard-target','realm:l1','account:offboard-target',
    'principal:offboard-fixture','node:hbbtzn:l1','active',1,clock_timestamp());
insert into access.administratorsegmentscope(
  scope_id,administrator_identity_id,scope_version,realm_id,line_id,root_node_id,segment,role_id,
  access_version,status,effective_at,granted_by_administrator_identity_id
) select 'scope:offboard-target','administrator:offboard-target',1,'realm:l1',node.line_id,node.id,
  'both_segments','role-senior-administrator-v1:tenant-zhudatuan',2,'active',clock_timestamp(),
  'administrator:offboard-owner' from organization.node node where node.id='node:hbbtzn:l1';
insert into identity.session(
  id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
  user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at,realm_id,account_id,auth_target
) values
  ('session:offboard-target','principal:offboard-fixture','membership:offboard-target',repeat('a',64),1,2,
    'operator',repeat('b',64),'fixture','fixture',2,clock_timestamp()+interval '1 day',clock_timestamp(),
    clock_timestamp(),'realm:l1','account:offboard-target','console'),
  ('session:offboard-member','principal:offboard-fixture','membership:offboard-member',repeat('c',64),1,1,
    'storefront',repeat('d',64),'fixture','fixture',2,clock_timestamp()+interval '1 day',clock_timestamp(),
    clock_timestamp(),'realm:l1','account:offboard-target','storefront');

set role zhudatuanidentityapi;
do $test$
begin
  begin
    perform access.offboard_administrator('membership:offboard-owner','membership:offboard-target',
      'mall','mall:d1708f04df2dd8a61736852c4900fb43',1);
    raise exception 'STALE_VERSION_WAS_ACCEPTED';
  exception when others then
    if sqlerrm<>'VERSION_CONFLICT' then raise; end if;
  end;
  begin
    perform access.offboard_administrator('membership:offboard-owner','membership-platform-owner-ethan-v1',
      'mall','mall:d1708f04df2dd8a61736852c4900fb43',14);
    raise exception 'CROSS_REALM_WAS_ACCEPTED';
  exception when others then
    if sqlerrm<>'MANAGEMENT_PERMISSION_REALM_MISMATCH' then raise; end if;
  end;
  begin
    perform access.offboard_administrator('membership:offboard-owner','membership:offboard-member',
      'mall','mall:d1708f04df2dd8a61736852c4900fb43',1);
    raise exception 'MB_WAS_ACCEPTED';
  exception when others then
    if sqlerrm<>'ADMINISTRATOR_NOT_ACTIVE' then raise; end if;
  end;
  if access.offboard_administrator('membership:offboard-owner','membership:offboard-target',
    'mall','mall:d1708f04df2dd8a61736852c4900fb43',2)<>3 then
    raise exception 'ACCESS_VERSION_NOT_ADVANCED';
  end if;
end
$test$;
reset role;

do $assert$
begin
  if (select status from access.membership where id='membership:offboard-target')<>'left'
    or (select status from access.membership where id='membership:offboard-member')<>'active'
    or (select expires_at from access.membershiprole where membership_id='membership:offboard-target') is null
    or (select status from access.administratoridentity where membership_id='membership:offboard-target')<>'revoked'
    or (select status from access.administratorsegmentscope where scope_id='scope:offboard-target')<>'revoked'
    or (select revoked_at from identity.session where id='session:offboard-target') is null
    or (select revoked_at from identity.session where id='session:offboard-member') is not null then
    raise exception 'OP_OFFBOARD_EFFECTS_INVALID';
  end if;
end
$assert$;

rollback;
