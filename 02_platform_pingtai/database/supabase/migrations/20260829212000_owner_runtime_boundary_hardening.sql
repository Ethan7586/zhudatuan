begin;

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'OWNER_RUNTIME_BOUNDARY_MIGRATION_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260829211000'
        and checksum='8e5616553e7639467438029d37337593e5cc27be63a9460c69a7cda9916a0684') then
    raise exception 'OWNER_RUNTIME_BOUNDARY_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260829211000') then
    raise exception 'OWNER_RUNTIME_BOUNDARY_FUTURE_HEAD_INVALID';
  end if;
  if exists(select 1 from access.ownertransfer) then
    raise exception 'OWNER_TRANSFER_SNAPSHOT_BACKFILL_REQUIRED';
  end if;
end
$precondition$;

create unique index identity_one_active_password_per_principal
  on identity.credential(principal_id) where provider='password' and status='active';

-- A pending transfer is a security binding, not only a membership/version pointer.  This
-- migration is intentionally fail-closed on non-empty state so no historical row is guessed.
alter table access.ownertransfer
  add column target_member_id text not null references member.profile(id) on delete restrict,
  add column target_principal_id text not null references identity.principal(id) on delete restrict,
  add column target_password_credential_id text not null references identity.credential(id) on delete restrict,
  add column target_credential_version bigint not null check(target_credential_version>0),
  add column target_subject_hash char(64) not null check(target_subject_hash~'^[0-9a-f]{64}$'),
  add column target_mobile_token char(64) not null check(target_mobile_token~'^[0-9a-f]{64}$');

create or replace function access.protect_owner_transfer_snapshot()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare
  targetrow record;
  passwordrow record;
  active_passwords integer;
begin
  if tg_op='INSERT' then
    select target.member_id,profile.principal_id,principal.credential_version,
      profile.mobile_token,target.access_version,target.status membership_status,
      profile.status profile_status,principal.status principal_status
    into targetrow
    from access.membership target
    join member.profile profile on profile.id=target.member_id
    join identity.principal principal on principal.id=profile.principal_id
    where target.id=new.target_membership_id
      and target.organization_id='tenant-zhudatuan' and target.client='operator'
    for update of target,profile,principal;
    if targetrow.member_id is null
      or targetrow.membership_status<>'active'
      or targetrow.profile_status<>'active'
      or targetrow.principal_status<>'active'
      or targetrow.mobile_token is null
      or targetrow.access_version<>new.target_access_version then
      raise exception 'OWNER_TRANSFER_TARGET_IDENTITY_INVALID';
    end if;
    perform 1 from identity.credential credential
    where credential.principal_id=targetrow.principal_id
      and credential.provider='password' and credential.status='active'
    for update;
    select count(*) into active_passwords from identity.credential credential
    where credential.principal_id=targetrow.principal_id
      and credential.provider='password' and credential.status='active';
    if active_passwords<>1 then raise exception 'OWNER_TRANSFER_TARGET_IDENTITY_INVALID'; end if;
    select credential.id,credential.subject_hash into passwordrow
    from identity.credential credential
    where credential.principal_id=targetrow.principal_id
      and credential.provider='password' and credential.status='active';
    new.target_member_id:=targetrow.member_id;
    new.target_principal_id:=targetrow.principal_id;
    new.target_password_credential_id:=passwordrow.id;
    new.target_credential_version:=targetrow.credential_version;
    new.target_subject_hash:=passwordrow.subject_hash;
    new.target_mobile_token:=targetrow.mobile_token;
    return new;
  end if;

  if new.target_member_id is distinct from old.target_member_id
    or new.target_principal_id is distinct from old.target_principal_id
    or new.target_password_credential_id is distinct from old.target_password_credential_id
    or new.target_credential_version is distinct from old.target_credential_version
    or new.target_subject_hash is distinct from old.target_subject_hash
    or new.target_mobile_token is distinct from old.target_mobile_token then
    raise exception 'OWNER_TRANSFER_TARGET_SNAPSHOT_IMMUTABLE';
  end if;
  if new.state is distinct from old.state
    and not (old.state='pending_acceptance' and new.state in('accepted','cancelled','expired')) then
    raise exception 'OWNER_TRANSFER_STATE_TRANSITION_INVALID';
  end if;

  if old.state='pending_acceptance' and new.state='accepted' then
    perform 1 from identity.credential credential
    where credential.principal_id=old.target_principal_id
      and credential.provider='password' and credential.status='active'
    for update;
    select count(*) into active_passwords from identity.credential credential
    where credential.principal_id=old.target_principal_id
      and credential.provider='password' and credential.status='active';
    if active_passwords<>1
      or new.accepted_by is distinct from old.target_principal_id
      or not exists(select 1
        from access.membership target
        join member.profile profile on profile.id=target.member_id
        join identity.principal principal on principal.id=profile.principal_id
        join identity.credential credential on credential.id=old.target_password_credential_id
          and credential.principal_id=principal.id
          and credential.provider='password' and credential.status='active'
        where target.id=old.target_membership_id
          and target.member_id=old.target_member_id
          and target.organization_id='tenant-zhudatuan' and target.client='operator' and target.status='active'
          and target.access_version=old.target_access_version+2
          and profile.id=old.target_member_id and profile.principal_id=old.target_principal_id
          and profile.status='active' and profile.mobile_token=old.target_mobile_token
          and principal.id=old.target_principal_id and principal.status='active'
          and principal.credential_version=old.target_credential_version
          and credential.subject_hash=old.target_subject_hash) then
      raise exception 'OWNER_TRANSFER_TARGET_IDENTITY_CHANGED';
    end if;
  end if;
  return new;
end
$function$;
revoke all on function access.protect_owner_transfer_snapshot() from public,shopapp,shopjob,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
create trigger owner_transfer_snapshot before insert or update on access.ownertransfer
  for each row execute function access.protect_owner_transfer_snapshot();

-- The invoker trigger needs a row-security-independent answer, but the helper is read-only and
-- exposes only whether a supplied identity belongs to the active Owner or pending successor.
create or replace function access.zhudatuan_protected_identity(
  p_membership text,p_member text,p_principal text,p_credential text
) returns boolean language sql stable security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
  select exists(
    select 1 from (
      select owner.membership_id,membership.member_id,profile.principal_id,credential.id credential_id
      from access.platformowner owner
      join access.membership membership on membership.id=owner.membership_id
      join member.profile profile on profile.id=membership.member_id
      left join identity.credential credential on credential.principal_id=profile.principal_id
      where owner.singleton=true and owner.state='active'
      union all
      select transfer.target_membership_id,transfer.target_member_id,transfer.target_principal_id,
        transfer.target_password_credential_id
      from access.ownertransfer transfer where transfer.state='pending_acceptance'
    ) protected
    where (p_membership is not null and protected.membership_id=p_membership)
      or (p_member is not null and protected.member_id=p_member)
      or (p_principal is not null and protected.principal_id=p_principal)
      or (p_credential is not null and protected.credential_id=p_credential)
  )
$function$;
revoke all on function access.zhudatuan_protected_identity(text,text,text,text)
  from public,shopread,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function access.zhudatuan_protected_identity(text,text,text,text)
  to shopapp,shopjob,zhudatuanidentityapi;

-- Keep this trigger INVOKER.  Direct runtime DML therefore observes the runtime caller and is
-- rejected; tightly scoped SECURITY DEFINER operations execute their already-validated writes
-- as shopmigration.  Imports additionally reject protected identifiers before their writes.
create or replace function access.protect_zhudatuan_owner()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
declare protected boolean:=false;
begin
  if tg_table_schema='access' and tg_table_name='role' then
    protected := (tg_op<>'INSERT' and old.id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name='rolepermission' then
    protected := (tg_op<>'INSERT' and old.role_id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.role_id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name='membership' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(old.id,old.member_id,null,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(new.id,new.member_id,null,null));
  elsif tg_table_schema='access' and tg_table_name='membershiprole' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(old.membership_id,null,null,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(new.membership_id,null,null,null))
      or (tg_op<>'INSERT' and old.role_id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.role_id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name in('scopegrant','membershipoverride') then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(old.membership_id,null,null,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(new.membership_id,null,null,null));
  elsif tg_table_schema='identity' and tg_table_name='principal' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(null,null,old.id,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(null,null,new.id,null));
  elsif tg_table_schema='identity' and tg_table_name='credential' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(null,null,old.principal_id,old.id))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(null,null,new.principal_id,new.id));
  elsif tg_table_schema='member' and tg_table_name='profile' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(null,old.id,old.principal_id,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(null,new.id,new.principal_id,null));
  end if;
  if not coalesce(protected,false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if current_user='shopmigration'
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'ZHUDATUAN_OWNER_PROTECTED';
end
$function$;
revoke all on function access.protect_zhudatuan_owner() from public,shopapp,shopjob,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;

create or replace function identity.purge_expired_job_records()
returns jsonb language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare purged_challenges bigint; purged_sessions bigint;
begin
  if (session_user<>'shopjob' and coalesce(current_setting('role',true),'')<>'shopjob') then
    raise exception 'IDENTITY_JOB_RETENTION_FORBIDDEN';
  end if;
  with removed as(delete from identity.challenge
    where expires_at<clock_timestamp()-interval '7 days' returning id)
  select count(*) into purged_challenges from removed;
  with removed as(delete from identity.session
    where expires_at<clock_timestamp()-interval '30 days' returning id)
  select count(*) into purged_sessions from removed;
  return jsonb_build_object('challenges',purged_challenges,'sessions',purged_sessions);
end
$function$;
revoke all on function identity.purge_expired_job_records() from public,shopapp,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function identity.purge_expired_job_records() to shopjob;

create or replace function identity.ensure_imported_principal(p_principal text)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
begin
  if (session_user<>'shopjob' and coalesce(current_setting('role',true),'')<>'shopjob')
    or current_setting('app.workload',true)<>'jobs'
    or nullif(current_setting('app.scope_id',true),'') is null
    or p_principal!~'^principal:import:[0-9a-f]{64}$' then
    raise exception 'MEMBER_IMPORT_IDENTITY_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  if access.zhudatuan_protected_identity(null,null,p_principal,null) then
    raise exception 'MEMBER_IMPORT_PROTECTED_IDENTITY';
  end if;
  insert into identity.principal(id,status,created_at,updated_at)
  values(p_principal,'pending',clock_timestamp(),clock_timestamp()) on conflict(id) do nothing;
end
$function$;
revoke all on function identity.ensure_imported_principal(text) from public,shopapp,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function identity.ensure_imported_principal(text) to shopjob;

create or replace function member.ensure_imported_profile(
  p_member text,p_principal text,p_display text
) returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare saved_member text;
begin
  if (session_user<>'shopjob' and coalesce(current_setting('role',true),'')<>'shopjob')
    or current_setting('app.workload',true)<>'jobs'
    or nullif(current_setting('app.scope_id',true),'') is null
    or p_principal!~'^principal:import:[0-9a-f]{64}$'
    or p_member<>replace(p_principal,'principal:import:','member:import:')
    or length(p_display) not between 1 and 128 or btrim(p_display)<>p_display then
    raise exception 'MEMBER_IMPORT_PROFILE_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  if access.zhudatuan_protected_identity(null,p_member,p_principal,null) then
    raise exception 'MEMBER_IMPORT_PROTECTED_IDENTITY';
  end if;
  insert into member.profile(id,principal_id,display_name,status,created_at,updated_at)
  values(p_member,p_principal,p_display,'pending',clock_timestamp(),clock_timestamp())
  on conflict(id) do update set display_name=excluded.display_name,
    updated_at=clock_timestamp(),version=member.profile.version+1
  where member.profile.principal_id=excluded.principal_id
  returning id into saved_member;
  if saved_member is null then raise exception 'MEMBER_IMPORT_IDENTITY_COLLISION'; end if;
end
$function$;
revoke all on function member.ensure_imported_profile(text,text,text) from public,shopapp,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function member.ensure_imported_profile(text,text,text) to shopjob;

create or replace function access.ensure_imported_membership(
  p_membership text,p_member text,p_organization text,p_client text,p_employee text
) returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare expected_hash text; saved_membership text;
begin
  expected_hash:=encode(public.digest(p_organization||':'||p_employee,'sha256'),'hex');
  if (session_user<>'shopjob' and coalesce(current_setting('role',true),'')<>'shopjob')
    or current_setting('app.workload',true)<>'jobs'
    or nullif(current_setting('app.scope_id',true),'') is distinct from p_organization
    or p_client not in('storefront','operator','store','supplier')
    or length(p_employee) not between 1 and 128 or btrim(p_employee)<>p_employee
    or p_member<>'member:import:'||expected_hash
    or p_membership<>'membership:import:'||expected_hash||':'||p_client
    or not exists(select 1 from organization.organization organization
      where organization.id=p_organization and organization.status='active') then
    raise exception 'MEMBER_IMPORT_MEMBERSHIP_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  if access.zhudatuan_protected_identity(p_membership,p_member,null,null) then
    raise exception 'MEMBER_IMPORT_PROTECTED_IDENTITY';
  end if;
  if not exists(select 1 from member.profile profile where profile.id=p_member
      and profile.principal_id='principal:import:'||expected_hash
      and profile.status in('pending','active')) then
    raise exception 'MEMBER_IMPORT_PROFILE_INVALID';
  end if;
  insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version)
  values(p_membership,p_member,p_organization,p_client,p_employee,'invited',1)
  on conflict(member_id,organization_id,client) do update set employee_no=excluded.employee_no
  where access.membership.id=excluded.id
  returning id into saved_membership;
  if saved_membership is distinct from p_membership then
    raise exception 'MEMBER_IMPORT_IDENTITY_COLLISION';
  end if;
end
$function$;
revoke all on function access.ensure_imported_membership(text,text,text,text,text) from public,shopapp,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function access.ensure_imported_membership(text,text,text,text,text) to shopjob;

-- Remove the inherited blanket job policy and every direct privilege on identity/access
-- authority.  The only profile read needed by benefitgrant is reduced to id/status columns.
revoke all on identity.session,identity.assurance,identity.principal,identity.credential,
  access.membership,access.membershiprole,access.scopegrant,access.membershipoverride,member.profile
  from shopjob;
revoke insert,update,delete,truncate,references,trigger on identity.challenge,identity.challengesecret from shopjob;
drop policy if exists jobscope on identity.session;
drop policy if exists jobscope on identity.assurance;
drop policy if exists jobscope on identity.principal;
drop policy if exists jobscope on identity.credential;
drop policy if exists jobscope on access.membership;
drop policy if exists jobscope on access.membershiprole;
drop policy if exists jobscope on access.scopegrant;
drop policy if exists jobscope on access.membershipoverride;
drop policy if exists jobscope on member.profile;
create policy shopjob_member_status on member.profile for select to shopjob using(true);
grant select(id,status) on member.profile to shopjob;

insert into runtime.schemaversion(version,checksum)
values('20260829212000','7623f50639c67d35887b1e9c1f261f9c21057cb3694f7e5d40ef3b17f56cb774');

do $assert$
declare target_table text; target_privilege text;
begin
  if not exists(select 1 from pg_trigger trigger
      where trigger.tgrelid='access.ownertransfer'::regclass
        and trigger.tgname='owner_transfer_snapshot' and not trigger.tgisinternal
        and trigger.tgfoid='access.protect_owner_transfer_snapshot()'::regprocedure) then
    raise exception 'OWNER_TRANSFER_SNAPSHOT_TRIGGER_MISSING';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema='access' and table_name='ownertransfer'
        and column_name in('target_member_id','target_principal_id','target_password_credential_id',
          'target_credential_version','target_subject_hash','target_mobile_token')
        and is_nullable='NO')<>6 then
    raise exception 'OWNER_TRANSFER_SNAPSHOT_COLUMNS_INVALID';
  end if;
  if not exists(select 1 from pg_proc procedure
      where procedure.oid='access.protect_zhudatuan_owner()'::regprocedure
        and not procedure.prosecdef
        and pg_get_functiondef(procedure.oid) like '%access.zhudatuan_protected_identity%') then
    raise exception 'OWNER_RUNTIME_INVOKER_GUARD_INVALID';
  end if;
  if not exists(select 1 from pg_index indexrow
      where indexrow.indexrelid='identity.identity_one_active_password_per_principal'::regclass
        and indexrow.indisunique and indexrow.indpred is not null
        and pg_get_expr(indexrow.indpred,indexrow.indrelid) like '%provider%password%status%active%') then
    raise exception 'ACTIVE_PASSWORD_CREDENTIAL_UNIQUENESS_INVALID';
  end if;
  if (select count(*) from pg_proc procedure
      where procedure.oid in(
        'access.protect_owner_transfer_snapshot()'::regprocedure,
        'access.zhudatuan_protected_identity(text,text,text,text)'::regprocedure,
        'identity.purge_expired_job_records()'::regprocedure,
        'identity.ensure_imported_principal(text)'::regprocedure,
        'member.ensure_imported_profile(text,text,text)'::regprocedure,
        'access.ensure_imported_membership(text,text,text,text,text)'::regprocedure)
        and procedure.prosecdef
        and procedure.proconfig@>array['search_path=pg_catalog, pg_temp','row_security=off'])<>6 then
    raise exception 'OWNER_RUNTIME_SECURITY_DEFINER_CONFIGURATION_INVALID';
  end if;
  for target_table,target_privilege in select * from (values
    ('identity.session','SELECT'),('identity.session','INSERT'),('identity.session','UPDATE'),('identity.session','DELETE'),
    ('identity.assurance','SELECT'),('identity.assurance','INSERT'),('identity.assurance','UPDATE'),('identity.assurance','DELETE'),
    ('identity.principal','SELECT'),('identity.principal','INSERT'),('identity.principal','UPDATE'),('identity.principal','DELETE'),
    ('identity.credential','SELECT'),('identity.credential','INSERT'),('identity.credential','UPDATE'),('identity.credential','DELETE'),
    ('access.membership','SELECT'),('access.membership','INSERT'),('access.membership','UPDATE'),('access.membership','DELETE'),
    ('access.membershiprole','SELECT'),('access.membershiprole','INSERT'),('access.membershiprole','UPDATE'),('access.membershiprole','DELETE'),
    ('access.scopegrant','SELECT'),('access.scopegrant','INSERT'),('access.scopegrant','UPDATE'),('access.scopegrant','DELETE'),
    ('access.membershipoverride','SELECT'),('access.membershipoverride','INSERT'),('access.membershipoverride','UPDATE'),('access.membershipoverride','DELETE'),
    ('member.profile','SELECT'),('member.profile','INSERT'),('member.profile','UPDATE'),('member.profile','DELETE')
  ) expected(table_name,privilege_name) loop
    if has_table_privilege('shopjob',target_table,target_privilege) then
      raise exception 'SHOPJOB_AUTHORITY_TABLE_PRIVILEGE_INVALID:%:%',target_table,target_privilege;
    end if;
  end loop;
  if not has_column_privilege('shopjob','member.profile','id','SELECT')
    or not has_column_privilege('shopjob','member.profile','status','SELECT')
    or has_column_privilege('shopjob','member.profile','principal_id','SELECT')
    or has_column_privilege('shopjob','member.profile','mobile_token','SELECT') then
    raise exception 'SHOPJOB_MEMBER_STATUS_PROJECTION_INVALID';
  end if;
  if exists(select 1 from pg_policies policy where policy.policyname='jobscope' and (
      policy.schemaname='identity' and policy.tablename in('session','assurance','principal','credential')
      or policy.schemaname='access' and policy.tablename in('membership','membershiprole','scopegrant','membershipoverride')
      or policy.schemaname='member' and policy.tablename='profile'))
    or not exists(select 1 from pg_policies policy
      where policy.schemaname='member' and policy.tablename='profile'
        and policy.policyname='shopjob_member_status' and policy.cmd='SELECT'
        and policy.roles=array['shopjob']::name[]) then
    raise exception 'SHOPJOB_AUTHORITY_POLICY_BOUNDARY_INVALID';
  end if;
  if has_table_privilege('shopjob','identity.challenge','INSERT')
    or has_table_privilege('shopjob','identity.challenge','UPDATE')
    or has_table_privilege('shopjob','identity.challenge','DELETE')
    or has_table_privilege('shopjob','identity.challengesecret','INSERT')
    or has_table_privilege('shopjob','identity.challengesecret','UPDATE')
    or has_table_privilege('shopjob','identity.challengesecret','DELETE') then
    raise exception 'SHOPJOB_CHALLENGE_WRITE_PRIVILEGE_INVALID';
  end if;
  if not has_function_privilege('shopjob','identity.purge_expired_job_records()','EXECUTE')
    or not has_function_privilege('shopjob','identity.ensure_imported_principal(text)','EXECUTE')
    or not has_function_privilege('shopjob','member.ensure_imported_profile(text,text,text)','EXECUTE')
    or not has_function_privilege('shopjob','access.ensure_imported_membership(text,text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','identity.purge_expired_job_records()','EXECUTE')
    or has_function_privilege('anon','identity.ensure_imported_principal(text)','EXECUTE')
    or has_function_privilege('anon','member.ensure_imported_profile(text,text,text)','EXECUTE')
    or has_function_privilege('anon','access.ensure_imported_membership(text,text,text,text,text)','EXECUTE') then
    raise exception 'SHOPJOB_NARROW_FUNCTION_BOUNDARY_INVALID';
  end if;
end
$assert$;

commit;
