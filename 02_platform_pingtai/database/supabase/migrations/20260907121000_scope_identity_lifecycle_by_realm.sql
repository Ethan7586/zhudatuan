begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:scope-identity-lifecycle-by-realm:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_REALM_LIFECYCLE_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907120000'
        and checksum='d0a23337279f44c222ef1b385caaefe9562a20689caafde703dea6e9fed38b96')
    or exists(select 1 from runtime.schemaversion where version>'20260907120000') then
    raise exception 'IDENTITY_REALM_LIFECYCLE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table identity.account add column mobile_ciphertext text;
alter table identity.account add column mobile_token char(64);
alter table identity.account add column mobile_masked text;
alter table identity.account add column phone_verified_at timestamptz;
alter table identity.account add constraint identity_account_mobile_pair
  check((mobile_ciphertext is null)=(mobile_token is null));
create unique index identity_account_realm_mobile_unique
  on identity.account(realm_id,mobile_token) where mobile_token is not null;

alter table identity.realmtarget drop constraint realmtarget_target_key;

update identity.account account
set mobile_ciphertext=profile.mobile_ciphertext,
  mobile_token=profile.mobile_token,
  mobile_masked=profile.mobile_masked,
  phone_verified_at=(select max(assurance.verified_at) from identity.assurance assurance
    where assurance.principal_id=account.legacy_principal_id and assurance.method='phone_otp')
from member.profile profile
where profile.principal_id=account.legacy_principal_id
  and profile.mobile_ciphertext is not null and profile.mobile_token is not null;

alter table identity.challenge add column realm_id text references identity.realm(id);
alter table identity.challenge add column account_id text;
alter table identity.challenge add constraint identity_challenge_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
alter table identity.challenge add constraint identity_challenge_account_requires_realm
  check(account_id is null or realm_id is not null);
create index identity_challenge_realm_account_purpose_idx
  on identity.challenge(realm_id,account_id,purpose,created_at desc);

with unambiguous as (
  select challenge.id,minimum.account_id,minimum.realm_id
  from identity.challenge challenge
  join lateral (
    select min(account.id) account_id,min(account.realm_id) realm_id,count(*) amount
    from identity.account account where account.legacy_principal_id=challenge.principal_id
  ) minimum on minimum.amount=1
)
update identity.challenge challenge set account_id=unambiguous.account_id,realm_id=unambiguous.realm_id
from unambiguous where unambiguous.id=challenge.id;

alter table identity.assurance add column realm_id text references identity.realm(id);
alter table identity.assurance add column account_id text;
alter table identity.assurance add constraint identity_assurance_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
alter table identity.assurance add constraint identity_assurance_account_requires_realm
  check(account_id is null or realm_id is not null);
create index identity_assurance_realm_account_verified_idx
  on identity.assurance(realm_id,account_id,verified_at desc);

with unambiguous as (
  select assurance.id,minimum.account_id,minimum.realm_id
  from identity.assurance assurance
  join lateral (
    select min(account.id) account_id,min(account.realm_id) realm_id,count(*) amount
    from identity.account account where account.legacy_principal_id=assurance.principal_id
  ) minimum on minimum.amount=1
)
update identity.assurance assurance set account_id=unambiguous.account_id,realm_id=unambiguous.realm_id
from unambiguous where unambiguous.id=assurance.id;

alter table identity.loginattempt add column realm_id text references identity.realm(id);
alter table identity.loginattempt add column account_id text;
alter table identity.loginattempt add constraint identity_loginattempt_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
alter table identity.loginattempt add constraint identity_loginattempt_account_requires_realm
  check(account_id is null or realm_id is not null);
alter table identity.loginattempt drop constraint loginattempt_pkey;
create unique index identity_loginattempt_realm_subject_client_unique
  on identity.loginattempt(realm_id,subject_hash,client_hash) where realm_id is not null;
create unique index identity_loginattempt_legacy_subject_client_unique
  on identity.loginattempt(subject_hash,client_hash) where realm_id is null;

alter table identity.federatedidentity drop constraint federatedidentity_provider_application_hash_subject_hash_key;
alter table identity.federatedidentity drop constraint federatedidentity_realm_account_pair;
alter table identity.federatedidentity add constraint federatedidentity_account_requires_realm
  check(account_id is null or realm_id is not null);
create unique index identity_federatedidentity_realm_subject_unique
  on identity.federatedidentity(realm_id,provider,application_hash,subject_hash) where realm_id is not null;
create unique index identity_federatedidentity_legacy_subject_unique
  on identity.federatedidentity(provider,application_hash,subject_hash) where realm_id is null;

create or replace function identity.rotate_zhudatuan_owner_password(
  p_actor text,p_session text,p_challenge text,p_secret_hash text,p_reason text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,pg_temp set row_security=off as $function$
declare
  ownerrow access.platformowner%rowtype;
  current_owner_principal text;
  owner_account text;
  owner_realm text;
  owner_credential text;
  owner_credential_version bigint;
  owner_access_version bigint;
  rotation_time timestamptz:=clock_timestamp();
  revoked_sessions jsonb;
begin
  if ((session_user not in('shopapp','zhudatuanidentityapi'))
      and coalesce(current_setting('role',true),'') not in('shopapp','zhudatuanidentityapi'))
    or current_setting('app.workload',true)<>'api'
    or p_actor!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$'
    or p_secret_hash!~'^scrypt\$v1\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$'
    or p_reason not in('credential_changed','credential_reset')
  then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;

  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  select * into ownerrow from access.platformowner where singleton=true for update;
  select account.legacy_principal_id,account.id,account.realm_id
  into current_owner_principal,owner_account,owner_realm
  from access.membership membership
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
  where ownerrow.state='active' and membership.id=ownerrow.membership_id;
  if p_actor is distinct from current_owner_principal then return null; end if;
  if p_reason='credential_changed'
    and nullif(current_setting('app.membership_id',true),'') is distinct from ownerrow.membership_id then return null; end if;
  if p_reason='credential_reset' and not exists(select 1 from identity.challenge challenge
      where challenge.id=p_challenge and challenge.account_id=owner_account and challenge.realm_id=owner_realm) then return null; end if;

  select credential.id,account.credential_version,membership.access_version
  into owner_credential,owner_credential_version,owner_access_version
  from access.membership membership
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id and account.status='active'
  join identity.credential credential on credential.account_id=account.id and credential.realm_id=account.realm_id
    and credential.provider='password' and credential.status='active'
  where ownerrow.state='active' and membership.id=ownerrow.membership_id
    and membership.organization_id='tenant-zhudatuan' and membership.client='operator'
    and membership.status='active' and account.legacy_principal_id=p_actor
  for update of membership,account,credential;
  if owner_credential is null then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;

  if p_reason='credential_changed' then
    if p_challenge is not null
      or p_session is null
      or p_session!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,191}$'
      or nullif(current_setting('app.actor_id',true),'')<>p_actor
      or not exists(select 1 from identity.session session
        where session.id=p_session and session.principal_id=p_actor
          and session.membership_id=ownerrow.membership_id and session.client='operator'
          and session.credential_version=owner_credential_version
          and session.access_version=owner_access_version
          and session.revoked_at is null and session.expires_at>rotation_time)
      or not exists(select 1 from identity.assurance evidence
        where evidence.account_id=owner_account and evidence.realm_id=owner_realm
          and evidence.method='password' and evidence.level>=2
          and evidence.evidence_hash=encode(public.digest(p_session::text,'sha256'),'hex')
          and evidence.verified_at>=transaction_timestamp() and evidence.verified_at<=rotation_time
          and evidence.expires_at is not null and evidence.expires_at>rotation_time)
    then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;
  else
    if p_session is not null
      or p_challenge is null
      or p_challenge!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,191}$'
      or not exists(select 1 from identity.challenge challenge
        where challenge.id=p_challenge and challenge.account_id=owner_account and challenge.realm_id=owner_realm
          and challenge.purpose='password_reset'
          and challenge.consumed_at>=transaction_timestamp() and challenge.consumed_at<=rotation_time
          and challenge.expires_at>challenge.consumed_at)
    then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;
  end if;

  update identity.credential set secret_hash=p_secret_hash,rotated_at=rotation_time where id=owner_credential;
  update identity.account set credential_version=owner_credential_version+1,
    version=version+1,updated_at=rotation_time where id=owner_account and realm_id=owner_realm;
  with revoked as(update identity.session session set revoked_at=rotation_time,revoked_reason=p_reason
      where session.revoked_at is null and exists(select 1 from access.membership membership
        where membership.id=session.membership_id and membership.account_id=owner_account
          and membership.realm_id=owner_realm) returning session.id)
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into revoked_sessions from revoked;
  return jsonb_build_object('principal',p_actor,'account',owner_account,'realm',owner_realm,
    'membership',ownerrow.membership_id,'credentialVersion',owner_credential_version+1,
    'accessVersion',owner_access_version,'reason',p_reason,'sessions',revoked_sessions,'sessionRevoked',true);
end
$function$;

revoke all on function identity.rotate_zhudatuan_owner_password(text,text,text,text,text)
  from public,shopjob,shopread,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function identity.rotate_zhudatuan_owner_password(text,text,text,text,text)
  to shopapp,zhudatuanidentityapi;

create or replace function access.change_zhudatuan_owner_mobile(
  p_actor text,p_session text,p_challenge text,p_ciphertext text,p_subject_hash text,p_mobile_token text,p_masked text,
  p_session_hash text,p_password_evidence_hash text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare
  ownerrow access.platformowner%rowtype;
  owner_member text;
  owner_display_name text;
  owner_mobile text;
  owner_profile_version bigint;
  owner_account text;
  owner_realm text;
  owner_credential text;
  owner_credential_version bigint;
  owner_access_version bigint;
  session_assurance smallint;
  changed_at timestamptz:=clock_timestamp();
  next_profile_version bigint;
  revoked_sessions jsonb;
begin
  if (session_user<>'shopapp' and coalesce(current_setting('role',true),'')<>'shopapp')
    or current_setting('app.workload',true)<>'api'
    or nullif(current_setting('app.actor_id',true),'')<>p_actor
    or p_actor!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$'
    or p_session!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,191}$'
    or p_challenge!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,191}$'
    or p_subject_hash!~'^[0-9a-f]{64}$'
    or p_mobile_token!~'^[0-9a-f]{64}$'
    or p_session_hash!~'^[0-9a-f]{64}$'
    or p_session_hash<>encode(public.digest(p_session::text,'sha256'),'hex')
    or length(p_ciphertext) not between 8 and 16384
    or length(p_masked) not between 3 and 64 then
    raise exception 'OWNER_MOBILE_CHANGE_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  select * into ownerrow from access.platformowner where singleton=true for update;
  select profile.id,profile.display_name,account.mobile_ciphertext,profile.version,
    account.id,account.realm_id,credential.id,account.credential_version,membership.access_version,session.assurance_level
  into owner_member,owner_display_name,owner_mobile,owner_profile_version,
    owner_account,owner_realm,owner_credential,owner_credential_version,owner_access_version,session_assurance
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id and account.status='active'
  join identity.credential credential on credential.account_id=account.id and credential.realm_id=account.realm_id
    and credential.provider='password' and credential.status='active'
  join identity.session session on session.id=p_session and session.principal_id=p_actor
    and session.membership_id=membership.id and session.client='operator'
  where ownerrow.state='active' and membership.id=ownerrow.membership_id
    and membership.id=nullif(current_setting('app.membership_id',true),'')
    and membership.organization_id='tenant-zhudatuan' and membership.client='operator'
    and membership.status='active' and account.legacy_principal_id=p_actor
    and session.credential_version=account.credential_version
    and session.access_version=membership.access_version
    and session.revoked_at is null and session.expires_at>changed_at
  for update of membership,profile,account,credential,session;
  if owner_member is null then raise exception 'OWNER_MOBILE_CHANGE_FORBIDDEN'; end if;
  if not exists(select 1 from identity.challenge challenge where challenge.id=p_challenge
      and challenge.account_id=owner_account and challenge.realm_id=owner_realm and challenge.purpose='phone_change'
      and challenge.destination_hash=p_subject_hash and challenge.session_hash=p_session_hash
      and challenge.consumed_at>=transaction_timestamp()
      and challenge.consumed_at<=changed_at and challenge.expires_at>challenge.consumed_at) then
    raise exception 'OWNER_MOBILE_CHALLENGE_INVALID';
  end if;
  if owner_mobile is null then
    if session_assurance<2 or p_password_evidence_hash is null or p_password_evidence_hash!~'^[0-9a-f]{64}$'
      or p_password_evidence_hash<>p_session_hash
      or not exists(select 1 from identity.assurance evidence where evidence.account_id=owner_account
        and evidence.realm_id=owner_realm and evidence.method='password' and evidence.level>=2
        and evidence.evidence_hash=p_password_evidence_hash
        and evidence.verified_at>=changed_at-interval '10 minutes' and evidence.verified_at<=changed_at
        and evidence.expires_at is not null and evidence.expires_at>changed_at) then
      raise exception 'OWNER_MOBILE_PASSWORD_VERIFICATION_REQUIRED';
    end if;
  elsif session_assurance<3 or not exists(select 1 from identity.assurance evidence
      where evidence.account_id=owner_account and evidence.realm_id=owner_realm and evidence.level>=3
        and evidence.evidence_hash=encode(public.digest(p_session::text,'sha256'),'hex')
        and evidence.verified_at>=changed_at-interval '15 minutes' and evidence.verified_at<=changed_at
        and evidence.expires_at is not null and evidence.expires_at>changed_at) then
    raise exception 'OWNER_MOBILE_STEPUP_REQUIRED';
  end if;

  update identity.credential set subject_hash=p_subject_hash,rotated_at=changed_at where id=owner_credential;
  update member.profile set mobile_ciphertext=p_ciphertext,mobile_token=p_mobile_token,mobile_masked=p_masked,
    version=version+1,updated_at=changed_at where id=owner_member returning version into next_profile_version;
  update identity.assurance set expires_at=least(coalesce(expires_at,changed_at),changed_at)
    where account_id=owner_account and realm_id=owner_realm and method='phone_otp'
      and (expires_at is null or expires_at>changed_at);
  insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
  values('assurance:owner-mobile:'||public.gen_random_uuid(),p_actor,'phone_otp',2,p_subject_hash,changed_at,
    changed_at+interval '365 days',owner_realm,owner_account);
  update identity.account set mobile_ciphertext=p_ciphertext,mobile_token=p_mobile_token,mobile_masked=p_masked,
    phone_verified_at=changed_at,credential_version=owner_credential_version+1,assurance_level=greatest(assurance_level,2),
    version=version+1,updated_at=changed_at where id=owner_account and realm_id=owner_realm;
  with revoked as(update identity.session session set revoked_at=changed_at,revoked_reason='mobile_changed'
      where session.revoked_at is null and exists(select 1 from access.membership membership
        where membership.id=session.membership_id and membership.account_id=owner_account
          and membership.realm_id=owner_realm) returning session.id)
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into revoked_sessions from revoked;
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
    occurred_at,available_at)
  values('event:owner-mobile:'||public.gen_random_uuid(),'identity.session.revoked',1,'identity',p_session,
    ownerrow.membership_id,jsonb_build_object('sessions',revoked_sessions,'reason','mobile_changed'),
    coalesce(nullif(current_setting('app.trace_id',true),''),'owner-mobile:'||p_actor),changed_at,changed_at);
  return jsonb_build_object('id',owner_member,'display_name',owner_display_name,'mobile_masked',p_masked,
    'version',next_profile_version,'account',owner_account,'realm',owner_realm,
    'session_revoked',true,'access_version',owner_access_version);
end
$function$;

revoke all on function access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text) from public;
grant execute on function access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text) to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260907121000','13c5a9190640b6dd12827e83a336e202d639c74a41ec83053e9a20926a67fc3a');

do $assert$
begin
  if exists(select 1 from identity.account account where (account.mobile_ciphertext is null)<>(account.mobile_token is null))
    or exists(select 1 from identity.challenge challenge where challenge.account_id is not null and challenge.realm_id is null)
    or exists(select 1 from identity.assurance assurance where assurance.account_id is not null and assurance.realm_id is null)
    or exists(select 1 from identity.federatedidentity identity where identity.account_id is not null and identity.realm_id is null)
    or not exists(select 1 from runtime.schemaversion
      where version='20260907121000'
        and checksum='13c5a9190640b6dd12827e83a336e202d639c74a41ec83053e9a20926a67fc3a') then
    raise exception 'IDENTITY_REALM_LIFECYCLE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
