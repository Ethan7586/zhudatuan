-- Canonical database contract for the one-shot 主打团 Console Owner bootstrap.
-- This SQL must be installed by the registration migration role after
-- 20260828170000 and before BootstrapOwner.ts is executed. The runtime role
-- receives EXECUTE only; it never receives direct identity/access writes.

create or replace function deployment.bootstrap_zhudatuan_owner(
  p_sentinel text,
  p_subject_hash text,
  p_secret_hash text,
  p_password_fingerprint text,
  p_actor text
) returns text
language plpgsql
security definer
set search_path=pg_catalog,pg_temp
set row_security=off
as $function$
declare
  fixed_principal constant text := 'principal:zhudatuan:owner:ethan:v1';
  fixed_credential constant text := 'credential:password:zhudatuan-owner-ethan:v1';
  fixed_member constant text := 'member:zhudatuan:owner:ethan:v1';
  fixed_membership constant text := 'membership-platform-owner-ethan-v1';
  fixed_owner_role constant text := 'role-platform-owner-v2';
  fixed_tenant constant text := 'tenant-zhudatuan';
  fixed_platform constant text := 'organization-platform-root';
  fixed_audit constant text := 'audit:zhudatuan:owner-bootstrap:v1';
  fixed_trace constant text := 'bootstrap:zhudatuan-owner-v1';
  active_owner_count integer;
  collision_count integer;
  previous_hash text;
  after_hash text;
  new_record_hash text;
  audit_recorded_at timestamptz;
  exact_state boolean;
begin
  if session_user<>'zhudatuanbootstrap'
    or current_database()<>'zhudatuan_registration'
    or not deployment.registration_bootstrap_boundary(p_sentinel)
    or p_subject_hash!~'^[a-f0-9]{64}$'
    or p_password_fingerprint!~'^[a-f0-9]{64}$'
    or p_secret_hash!~'^scrypt\$v1\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$'
    or p_actor!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$'
  then raise exception 'OWNER_BOOTSTRAP_INPUT_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap:v1'));

  if not exists(select 1 from runtime.schemaversion where version='20260828170000')
    or not exists(select 1 from organization.organization
      where id=fixed_platform and kind='platform' and parent_id is null and status='active')
    or not exists(select 1 from organization.organization
      where id=fixed_tenant and kind='tenant' and parent_id=fixed_platform and status='active')
    or not exists(select 1 from access.role
      where id=fixed_owner_role and scope_id=fixed_tenant and status='active')
    or not exists(select 1 from access.role
      where id='role:self' and scope_id='self' and status='active')
  then raise exception 'OWNER_BOOTSTRAP_BASELINE_INVALID'; end if;

  select count(distinct membership.id)::integer into active_owner_count
  from access.membership membership
  join access.membershiprole assignment on assignment.membership_id=membership.id
    and assignment.role_id=fixed_owner_role and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  where membership.client='operator' and membership.status='active';

  select
    (select count(*) from identity.principal where id=fixed_principal)
    +(select count(*) from identity.credential where id=fixed_credential or (provider='password' and subject_hash=p_subject_hash))
    +(select count(*) from member.profile where id=fixed_member or principal_id=fixed_principal)
    +(select count(*) from access.membership where id=fixed_membership
      or (member_id=fixed_member and organization_id=fixed_tenant and client='operator'))
    +(select count(*) from audit.record where id=fixed_audit)
  into collision_count;

  if active_owner_count=0 and collision_count=0 then
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values(fixed_principal,'active',1,clock_timestamp(),clock_timestamp(),0);
    insert into identity.credential(
      id,principal_id,provider,subject_hash,subject_ciphertext,subject_key_version,secret_hash,encrypted_secret,
      status,rotated_at,created_at
    ) values(fixed_credential,fixed_principal,'password',p_subject_hash,null,null,p_secret_hash,null,
      'active',clock_timestamp(),clock_timestamp());
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values(fixed_member,fixed_principal,'Ethan','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values(fixed_membership,fixed_member,fixed_tenant,'operator','active',1,clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      (fixed_membership,fixed_owner_role,'1970-01-01T00:00:00Z'),
      (fixed_membership,'role:self','1970-01-01T00:00:00Z');
    insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values
      ('scope:membership-platform-owner-ethan-v1:platform',fixed_membership,'platform',fixed_platform,fixed_platform,
        'allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:tenant',fixed_membership,'tenant',fixed_tenant,fixed_tenant,
        'allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:self',fixed_membership,'self','self:'||fixed_principal,
        'self:'||fixed_principal,'allow','1970-01-01T00:00:00Z',1);

    select record_hash into previous_hash from(
      select record_hash,recorded_at occurred_at from audit.record where scope_id=fixed_tenant
      union all select record_hash,accessed_at from audit.accessrecord where scope_id=fixed_tenant
      union all select last_record_hash,through_at from audit.archiveref where scope_id=fixed_tenant
    ) chain order by occurred_at desc limit 1;
    audit_recorded_at := clock_timestamp();
    after_hash := encode(public.digest(fixed_principal||':'||p_subject_hash||':'||fixed_membership||':'||p_password_fingerprint,'sha256'),'hex');
    new_record_hash := encode(public.digest(fixed_audit||':'||coalesce(previous_hash,'')||':'||after_hash||':'||audit_recorded_at::text,'sha256'),'hex');
    insert into audit.record(
      id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
      previous_hash,record_hash,recorded_at
    ) values(
      fixed_audit,fixed_tenant,p_actor,'owner','identity.owner.bootstrapped','access.membership',fixed_membership,
      null,after_hash,jsonb_build_object(
        'bootstrap','zhudatuan-owner-v1','principal',fixed_principal,'membership',fixed_membership,
        'subjectFingerprint',p_subject_hash,'passwordFingerprint',p_password_fingerprint,
        'roles',jsonb_build_array(fixed_owner_role,'role:self'),
        'scopes',jsonb_build_array(fixed_platform,fixed_tenant,'self:'||fixed_principal),
        'client','operator','publicRegistrationPrivilegeEscalation',false,'plaintextSecretStored',false
      ),fixed_trace,previous_hash,new_record_hash,audit_recorded_at
    );
  elsif active_owner_count=1 then
    select
      exists(select 1 from identity.principal where id=fixed_principal and status='active' and credential_version=1)
      and exists(select 1 from identity.credential where id=fixed_credential and principal_id=fixed_principal
        and provider='password' and subject_hash=p_subject_hash and secret_hash~'^scrypt\$v1\$32768\$8\$1\$'
        and subject_ciphertext is null and subject_key_version is null and encrypted_secret is null and status='active')
      and exists(select 1 from member.profile where id=fixed_member and principal_id=fixed_principal
        and display_name='Ethan' and status='active')
      and exists(select 1 from access.membership where id=fixed_membership and member_id=fixed_member
        and organization_id=fixed_tenant and client='operator' and status='active' and access_version=1)
      and (select count(*) from access.membershiprole where membership_id=fixed_membership)=2
      and exists(select 1 from access.membershiprole where membership_id=fixed_membership and role_id=fixed_owner_role
        and effective_at='1970-01-01T00:00:00Z' and expires_at is null)
      and exists(select 1 from access.membershiprole where membership_id=fixed_membership and role_id='role:self'
        and effective_at='1970-01-01T00:00:00Z' and expires_at is null)
      and (select count(*) from access.scopegrant where membership_id=fixed_membership)=3
      and exists(select 1 from access.scopegrant where id='scope:membership-platform-owner-ethan-v1:platform'
        and membership_id=fixed_membership and scope_kind='platform' and scope_id=fixed_platform
        and scope_path=fixed_platform and effect='allow' and expires_at is null and access_version=1)
      and exists(select 1 from access.scopegrant where id='scope:membership-platform-owner-ethan-v1:tenant'
        and membership_id=fixed_membership and scope_kind='tenant' and scope_id=fixed_tenant
        and scope_path=fixed_tenant and effect='allow' and expires_at is null and access_version=1)
      and exists(select 1 from access.scopegrant where id='scope:membership-platform-owner-ethan-v1:self'
        and membership_id=fixed_membership and scope_kind='self' and scope_id='self:'||fixed_principal
        and scope_path='self:'||fixed_principal and effect='allow' and expires_at is null and access_version=1)
      and (select count(*) from audit.record where id=fixed_audit)=1
      and exists(select 1 from audit.record where id=fixed_audit and scope_id=fixed_tenant and actor_id=p_actor
        and action='identity.owner.bootstrapped' and resource_id=fixed_membership
        and evidence->>'subjectFingerprint'=p_subject_hash
        and evidence->>'passwordFingerprint'=p_password_fingerprint
        and evidence->>'publicRegistrationPrivilegeEscalation'='false'
        and evidence->>'plaintextSecretStored'='false')
    into exact_state;
    if not coalesce(exact_state,false) then raise exception 'OWNER_BOOTSTRAP_CONFLICT'; end if;
  else
    raise exception 'OWNER_BOOTSTRAP_CONFLICT';
  end if;

  if (select count(*) from capability.membership_operations(fixed_membership)
      where operation_id in(
        'organization.layers.read','channel.distributors.read','channel.connections.read','reporting.dashboard.read',
        'experience.applications.read','catalog.pools.read','catalog.listings.read','inventory.availability.read',
        'order.orders.read','voucher.bindings.read','finance.overview.read','reporting.sales.read',
        'support.cases.read','access.center.read'
      ))<>14
    or not exists(select 1 from access.membershiprole
      where membership_id=fixed_membership and role_id='role:self' and expires_at is null)
  then raise exception 'OWNER_BOOTSTRAP_CONSOLE_ACCESS_INVALID'; end if;

  return case when collision_count=0 then 'created' else 'existing' end;
end
$function$;

revoke all on function deployment.bootstrap_zhudatuan_owner(text,text,text,text,text) from public;
grant execute on function deployment.bootstrap_zhudatuan_owner(text,text,text,text,text) to zhudatuanbootstrap;
