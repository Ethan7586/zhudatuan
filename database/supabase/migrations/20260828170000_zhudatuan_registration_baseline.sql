begin;

-- This is a forward-only, data-preserving cutover from the inherited Smart
-- Wing demo registration baseline to the owner-approved 主打团 identity
-- boundary.  It never deletes legacy rows: old invitations are disabled,
-- old terms are retired, and inherited demo identities are suspended.

select pg_advisory_xact_lock(hashtext('zhudatuan:registration-baseline:v1'));

do $guard$
declare
  required_permission_count integer;
begin
  if not exists (
    select 1 from organization.organization
    where id='organization-platform-root' and kind='platform' and parent_id is null
  ) then
    raise exception 'ZHUDATUAN_PLATFORM_ROOT_INVALID';
  end if;

  if exists (
    select 1 from organization.organization
    where id='tenant-zhudatuan'
      and (kind<>'tenant' or parent_id<>'organization-platform-root' or name<>'主打团' or timezone<>'Asia/Shanghai')
  ) or exists (
    select 1 from organization.organization
    where id='enterprise-zhudatuan'
      and (kind<>'enterprise' or parent_id<>'tenant-zhudatuan' or name<>'主打团' or timezone<>'Asia/Shanghai')
  ) or exists (
    select 1 from organization.organization
    where id='mall-zhudatuan'
      and (kind<>'mall' or parent_id<>'enterprise-zhudatuan' or name<>'主打团福利商城' or timezone<>'Asia/Shanghai')
  ) then
    raise exception 'ZHUDATUAN_ORGANIZATION_ID_COLLISION';
  end if;
  if exists (
    select 1 from organization.unitclosure
    where (descendant_id='mall-zhudatuan' and ancestor_id not in(
      'organization-platform-root','tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan'
    )) or (ancestor_id='mall-zhudatuan' and descendant_id<>'mall-zhudatuan')
  ) then
    raise exception 'ZHUDATUAN_MALL_CLOSURE_COLLISION';
  end if;

  if exists (
    select 1 from identity.registrationpolicy
    where version=2 and id<>'registration:zhudatuan:2026-08-28-v1'
  ) then
    raise exception 'ZHUDATUAN_REGISTRATION_POLICY_VERSION_COLLISION';
  end if;
  if exists (
    select 1 from identity.registrationpolicy
    where id='registration:zhudatuan:2026-08-28-v1'
      and (
        version<>2
        or terms_version<>'zhudatuan-2026-08-28-v1'
        or terms_title<>'主打团用户服务协议'
        or terms_body<>'本协议适用于主打团福利商城的账户注册与使用。注册仅建立消费者会员资格，不自动授予企业运营后台权限。用户应使用本人手机号并妥善保管登录凭证；订单、福利、卡券与售后按所属企业和商城规则处理。'
        or privacy_title<>'主打团隐私保护政策'
        or privacy_body<>'我们按照最小必要原则处理手机号、姓名、企业邀请关系、登录设备与安全审计信息，用于身份验证、会员资格、福利履约、风险控制与依法审计。未经授权，不会将消费者会员身份扩展为企业运营后台权限。'
        or terms_hash<>'207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d'
        or effective_at<>'2026-08-28T00:00:00Z'
        or retired_at is not null
      )
  ) then
    raise exception 'ZHUDATUAN_REGISTRATION_POLICY_ID_COLLISION';
  end if;
  if exists (
    select 1 from identity.registrationpolicy
    where effective_at<=clock_timestamp()
      and (retired_at is null or retired_at>clock_timestamp())
      and id not in('registration:2026-08-13','registration:zhudatuan:2026-08-28-v1')
  ) then
    raise exception 'UNEXPECTED_ACTIVE_REGISTRATION_POLICY';
  end if;

  if exists (
    select 1 from access.role
    where id='role-zhudatuan-storefront-member'
      and (scope_id<>'mall-zhudatuan' or name<>'商城会员' or status<>'active')
  ) then
    raise exception 'ZHUDATUAN_STOREFRONT_ROLE_COLLISION';
  end if;
  if exists (
    select 1 from access.role
    where id<>'role-zhudatuan-storefront-member' and scope_id='mall-zhudatuan' and name='商城会员'
  ) then
    raise exception 'ZHUDATUAN_STOREFRONT_ROLE_NAME_COLLISION';
  end if;

  select count(*) into required_permission_count
  from access.permission
  where status='active' and code in(
    'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
    'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
    'observability.clienterror.create'
  );
  if required_permission_count<>14 then
    raise exception 'EMPLOYEE_PERMISSION_CATALOG_INCOMPLETE count=%',required_permission_count;
  end if;
  if (select count(*) from access.rolepermission where role_id='role-zhudatuan-storefront-member') not in(0,14)
    or exists (
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-zhudatuan-storefront-member'
        and (mapping.effect<>'allow' or permission.status<>'active' or permission.code not in(
          'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
          'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
          'observability.clienterror.create'
        ))
    ) then
    raise exception 'ZHUDATUAN_STOREFRONT_ROLE_PREEXISTING_MAPPING_INVALID';
  end if;
  if not exists(select 1 from access.role where id='role:self' and scope_id='self' and status='active')
    or not exists(
      select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role:self' and mapping.effect='allow' and permission.code='identity.session.read'
    )
    or not exists(
      select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role:self' and mapping.effect='allow' and permission.code='identity.session.manage'
    ) then raise exception 'CANONICAL_SELF_ROLE_INVALID'; end if;
end
$guard$;

alter table member.profile add column if not exists mobile_masked text not null default '***';
alter table identity.challengedelivery drop constraint if exists challengedelivery_state_check;
alter table identity.challengedelivery add constraint challengedelivery_state_check
  check(state in('sending','sent','failed','ambiguous'));
create unique index if not exists identity_challengedelivery_no_automatic_resend
  on identity.challengedelivery(challenge_id) where state in('sending','sent','ambiguous');

insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at) values
  ('tenant-zhudatuan','tenant','organization-platform-root','主打团','Asia/Shanghai','active',0,'2026-08-28T00:00:00Z','2026-08-28T00:00:00Z'),
  ('enterprise-zhudatuan','enterprise','tenant-zhudatuan','主打团','Asia/Shanghai','active',0,'2026-08-28T00:00:00Z','2026-08-28T00:00:00Z'),
  ('mall-zhudatuan','mall','enterprise-zhudatuan','主打团福利商城','Asia/Shanghai','active',0,'2026-08-28T00:00:00Z','2026-08-28T00:00:00Z')
on conflict(id) do nothing;

insert into organization.unitclosure(ancestor_id,descendant_id,depth) values
  ('tenant-zhudatuan','tenant-zhudatuan',0),
  ('enterprise-zhudatuan','enterprise-zhudatuan',0),
  ('mall-zhudatuan','mall-zhudatuan',0),
  ('organization-platform-root','tenant-zhudatuan',1),
  ('tenant-zhudatuan','enterprise-zhudatuan',1),
  ('enterprise-zhudatuan','mall-zhudatuan',1),
  ('organization-platform-root','enterprise-zhudatuan',2),
  ('tenant-zhudatuan','mall-zhudatuan',2),
  ('organization-platform-root','mall-zhudatuan',3)
on conflict(ancestor_id,descendant_id) do nothing;

-- Only the explicit inherited demo boundary is isolated.  Any unrecognised
-- active policy is rejected above rather than silently retired.
update member.invite
set status='disabled',version=version+1
where status='active'
  and (id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'));

-- Preserve inherited demo identities for audit while making them unusable by
-- the registration-only runtime.  Only principals anchored to the explicit
-- inherited Smart Wing/demo organizations are affected.
update identity.session session set revoked_at=coalesce(session.revoked_at,'2026-08-28T00:00:00Z'),
  revoked_reason=coalesce(session.revoked_reason,'zhudatuan_registration_isolation')
where session.principal_id in(
  select profile.principal_id from member.profile profile join access.membership membership on membership.member_id=profile.id
  where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
);
update identity.credential credential set status='revoked',rotated_at=coalesce(credential.rotated_at,'2026-08-28T00:00:00Z')
where credential.principal_id in(
  select profile.principal_id from member.profile profile join access.membership membership on membership.member_id=profile.id
  where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
);
update identity.principal principal set status='disabled',version=version+1,updated_at='2026-08-28T00:00:00Z'
where principal.id in(
  select profile.principal_id from member.profile profile join access.membership membership on membership.member_id=profile.id
  where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
) and principal.status<>'disabled';
update member.profile profile set status='disabled',version=version+1,updated_at='2026-08-28T00:00:00Z'
where profile.id in(
  select membership.member_id from access.membership membership
  where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
) and profile.status<>'disabled';
update access.membership set status='suspended',access_version=access_version+1
where organization_id in('tenant-smart-wing','enterprise-demo','mall-demo') and status in('active','invited');

-- Re-home the canonical platform-owner permission set without carrying any
-- inherited operator identity into 主打团.  The old memberships above are
-- already suspended; any other live assignee makes the cutover fail closed.
do $owner_role_rescope$
declare
  owner_scope text;
  owner_name text;
  owner_status text;
begin
  select scope_id,name,status into owner_scope,owner_name,owner_status
  from access.role where id='role-platform-owner-v2' for update;
  if not found or owner_status<>'active'
    or owner_scope not in('tenant-smart-wing','tenant-zhudatuan')
  then raise exception 'ZHUDATUAN_PLATFORM_OWNER_ROLE_INVALID'; end if;
  if exists (
    select 1 from access.role
    where id<>'role-platform-owner-v2' and scope_id='tenant-zhudatuan' and name=owner_name
  ) then raise exception 'ZHUDATUAN_PLATFORM_OWNER_ROLE_NAME_COLLISION'; end if;
  if exists (
    select 1 from access.membershiprole assignment
    join access.membership membership on membership.id=assignment.membership_id
    where assignment.role_id='role-platform-owner-v2'
      and membership.client='operator' and membership.status='active'
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  ) then raise exception 'ZHUDATUAN_PLATFORM_OWNER_ROLE_STILL_ASSIGNED'; end if;
  update access.role set scope_id='tenant-zhudatuan',version=version+1
  where id='role-platform-owner-v2' and scope_id='tenant-smart-wing';
end
$owner_role_rescope$;

update identity.registrationpolicy
set retired_at='2026-08-28T00:00:00Z'
where id='registration:2026-08-13'
  and (retired_at is null or retired_at>'2026-08-28T00:00:00Z');

insert into identity.registrationpolicy(
  id,version,terms_version,terms_title,terms_body,privacy_title,privacy_body,terms_hash,effective_at,retired_at
) values (
  'registration:zhudatuan:2026-08-28-v1',2,'zhudatuan-2026-08-28-v1','主打团用户服务协议',
  '本协议适用于主打团福利商城的账户注册与使用。注册仅建立消费者会员资格，不自动授予企业运营后台权限。用户应使用本人手机号并妥善保管登录凭证；订单、福利、卡券与售后按所属企业和商城规则处理。',
  '主打团隐私保护政策',
  '我们按照最小必要原则处理手机号、姓名、企业邀请关系、登录设备与安全审计信息，用于身份验证、会员资格、福利履约、风险控制与依法审计。未经授权，不会将消费者会员身份扩展为企业运营后台权限。',
  '207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d',
  '2026-08-28T00:00:00Z',null
)
on conflict(id) do nothing;

insert into access.role(id,scope_id,name,status,version)
values('role-zhudatuan-storefront-member','mall-zhudatuan','商城会员','active',1)
on conflict(id) do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-zhudatuan-storefront-member',permission.id,'allow'
from access.permission permission
where permission.status='active' and permission.code in(
  'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
  'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
  'observability.clienterror.create'
)
on conflict do nothing;

-- The registration-only API, identity-notification worker and one-shot
-- bootstrap use dedicated NOINHERIT database roles.  Production provisions
-- their LOGIN passwords in postgres-init; privileged replay tools may create
-- the same roles here, but the migration never gives shopmigration CREATEROLE.
do $database_roles$
declare role_name text;
begin
  foreach role_name in array array['zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap'] loop
    if not exists(select 1 from pg_roles where rolname=role_name) then
      if not coalesce((select rolcreaterole or rolsuper from pg_roles where rolname=current_user),false) then
        raise exception 'ZHUDATUAN_DATABASE_ROLE_PREPROVISION_REQUIRED:%',role_name;
      end if;
      execute format('create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',role_name);
    end if;
    if exists(select 1 from pg_roles where rolname=role_name
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
      raise exception 'ZHUDATUAN_DATABASE_ROLE_UNSAFE:%',role_name;
    end if;
  end loop;
end
$database_roles$;

create or replace function runtime.claim_identity_notification_job(
  p_owner text,p_limit integer,p_lease_seconds integer
) returns setof runtime.job
language plpgsql security definer set search_path=runtime,pg_temp as $claim$
begin
  if session_user<>'zhudatuanidentityjob' or p_owner!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$'
    or p_limit not between 1 and 20 or p_lease_seconds not between 5 and 120 then
    raise exception 'IDENTITY_NOTIFICATION_JOB_CLAIM_INVALID';
  end if;
  return query
  with candidates as(
    select id from runtime.job where kind='identitynotification' and owner='identity'
      and ((state='queued' and available_at<=clock_timestamp())
        or (state='running' and lease_deadline<=clock_timestamp()))
    order by priority,available_at,id for update skip locked limit p_limit
  ) update runtime.job target set state='running',lease_owner=p_owner,
      lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=target.attempts+1,
      updated_at=clock_timestamp()
    from candidates where target.id=candidates.id returning target.*;
end
$claim$;

create or replace function identity.resolve_session(p_token_hash text)
returns table(actor_id text,session_id text,membership_id text,credential_version bigint,access_version bigint,target text,assurance_level smallint,assurance_verified_at timestamptz)
language sql stable security definer set search_path=identity,member,access,pg_temp as $function$
  select session.principal_id,session.id,session.membership_id,session.credential_version,session.access_version,
    case session.client when 'operator' then 'console' else session.client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null
      then stepup.verified_at else null end
  from identity.session session join identity.principal principal on principal.id=session.principal_id
  join member.profile profile on profile.principal_id=session.principal_id
  join access.membership membership on membership.id=session.membership_id and membership.member_id=profile.id
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1) phone on true
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.level>=3
      and evidence.verified_at<=clock_timestamp() and (evidence.expires_at is null or evidence.expires_at>clock_timestamp())
    order by evidence.level desc,evidence.verified_at desc limit 1) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version and principal.status='active' and membership.status='active'
$function$;
revoke all on function runtime.claim_identity_notification_job(text,integer,integer) from public,shopapp,shopjob;
revoke execute on function runtime.claim_job(text,text,integer,integer) from zhudatuanidentityjob;

grant usage on schema runtime,identity,access,capability,member,organization,risk,audit to zhudatuanidentityapi;
grant select on runtime.schemaversion to zhudatuanidentityapi;
grant select,insert,update on runtime.idempotency,runtime.outbox,runtime.job to zhudatuanidentityapi;
grant select,insert,update on identity.principal,identity.credential,identity.session,identity.authticket,identity.assurance,
  identity.challenge,identity.challengesecret,identity.federatedidentity,identity.wechatgrant,identity.loginattempt to zhudatuanidentityapi;
grant select on identity.registrationpolicy to zhudatuanidentityapi;
grant select on access.permission,access.role,access.rolepermission,access.membership,access.membershiprole,
  access.scopegrant,access.membershipoverride to zhudatuanidentityapi;
grant insert on access.membership,access.membershiprole,access.scopegrant,access.decisionaudit to zhudatuanidentityapi;
grant select,insert,update on member.profile,member.invite to zhudatuanidentityapi;
grant select on organization.organization,organization.unitclosure to zhudatuanidentityapi;
grant select on capability.capability,capability.entitlement,capability.operation to zhudatuanidentityapi;
grant select on risk.policy,risk.policyversion,risk.listentry to zhudatuanidentityapi;
grant select,insert on risk.signal,risk.decision to zhudatuanidentityapi;
grant select,insert on audit.record,audit.accessrecord to zhudatuanidentityapi;
grant select on audit.archiveref to zhudatuanidentityapi;
grant execute on function identity.resolve_session(text),access.resolve_membership(text),access.membership_version(text),
  access.resolve_scope(text,text,text),access.resource_scope(text,text,text),access.scope_object(text),
  capability.membership_operations(text),access.scope_allowed(text) to zhudatuanidentityapi;

grant usage on schema runtime,identity to zhudatuanidentityjob;
grant select on runtime.schemaversion to zhudatuanidentityjob;
grant select,update on runtime.job to zhudatuanidentityjob;
grant select,insert,update on runtime.deadletter to zhudatuanidentityjob;
grant select on identity.challenge,identity.challengesecret to zhudatuanidentityjob;
grant select,insert,update on identity.challengedelivery to zhudatuanidentityjob;
grant execute on function runtime.claim_identity_notification_job(text,integer,integer) to zhudatuanidentityjob;

grant usage on schema runtime,identity,access,member,organization,audit to zhudatuanbootstrap;
grant select on runtime.schemaversion,identity.registrationpolicy,access.permission,access.role,access.rolepermission,
  organization.organization,organization.unitclosure,audit.record,audit.accessrecord,audit.archiveref to zhudatuanbootstrap;
grant select,insert on member.invite to zhudatuanbootstrap;
grant insert on audit.record to zhudatuanbootstrap;

do $policies$
declare table_name text;
begin
  foreach table_name in array array[
    'idempotency','outbox','job'
  ] loop
    execute format('drop policy if exists zhudatuanidentityapi on runtime.%I',table_name);
    execute format('create policy zhudatuanidentityapi on runtime.%I for all to zhudatuanidentityapi using(true) with check(true)',table_name);
  end loop;
  foreach table_name in array array[
    'principal','credential','session','authticket','challenge','challengesecret','federatedidentity','wechatgrant','loginattempt','registrationpolicy','assurance'
  ] loop
    execute format('drop policy if exists zhudatuanidentityapi on identity.%I',table_name);
    execute format('create policy zhudatuanidentityapi on identity.%I for all to zhudatuanidentityapi using(true) with check(true)',table_name);
  end loop;
  foreach table_name in array array[
    'permission','role','rolepermission','membership','membershiprole','scopegrant','membershipoverride','decisionaudit'
  ] loop
    execute format('drop policy if exists zhudatuanidentityapi on access.%I',table_name);
    execute format('create policy zhudatuanidentityapi on access.%I for all to zhudatuanidentityapi using(true) with check(true)',table_name);
  end loop;
  foreach table_name in array array['profile','invite'] loop
    execute format('drop policy if exists zhudatuanidentityapi on member.%I',table_name);
    execute format('create policy zhudatuanidentityapi on member.%I for all to zhudatuanidentityapi using(true) with check(true)',table_name);
  end loop;
  foreach table_name in array array['organization','unitclosure'] loop
    execute format('drop policy if exists zhudatuanidentityapi on organization.%I',table_name);
    execute format('create policy zhudatuanidentityapi on organization.%I for select to zhudatuanidentityapi using(true)',table_name);
  end loop;
  foreach table_name in array array['capability','entitlement','operation'] loop
    execute format('drop policy if exists zhudatuanidentityapi on capability.%I',table_name);
    execute format('create policy zhudatuanidentityapi on capability.%I for select to zhudatuanidentityapi using(true)',table_name);
  end loop;
  foreach table_name in array array['policy','policyversion','listentry','signal','decision'] loop
    execute format('drop policy if exists zhudatuanidentityapi on risk.%I',table_name);
    execute format('create policy zhudatuanidentityapi on risk.%I for all to zhudatuanidentityapi using(true) with check(true)',table_name);
  end loop;
  foreach table_name in array array['record','accessrecord'] loop
    execute format('drop policy if exists zhudatuanidentityapi on audit.%I',table_name);
    execute format('create policy zhudatuanidentityapi on audit.%I for all to zhudatuanidentityapi using(true) with check(true)',table_name);
  end loop;
  drop policy if exists zhudatuanidentityapi on audit.archiveref;
  create policy zhudatuanidentityapi on audit.archiveref for select to zhudatuanidentityapi using(true);

  drop policy if exists zhudatuanidentityjob on runtime.job;
  create policy zhudatuanidentityjob on runtime.job for select to zhudatuanidentityjob
    using(kind='identitynotification' and owner='identity');
  drop policy if exists zhudatuanidentityjobupdate on runtime.job;
  create policy zhudatuanidentityjobupdate on runtime.job for update to zhudatuanidentityjob
    using(kind='identitynotification' and owner='identity') with check(kind='identitynotification' and owner='identity');
  drop policy if exists zhudatuanidentityjob on runtime.deadletter;
  create policy zhudatuanidentityjob on runtime.deadletter for all to zhudatuanidentityjob
    using(owner='identity') with check(owner='identity');
  drop policy if exists zhudatuanidentityjob on identity.challenge;
  create policy zhudatuanidentityjob on identity.challenge for select to zhudatuanidentityjob using(exists(
    select 1 from runtime.job where kind='identitynotification' and owner='identity'
      and payload->>'challenge'=identity.challenge.id and state='running'
  ));
  drop policy if exists zhudatuanidentityjob on identity.challengesecret;
  create policy zhudatuanidentityjob on identity.challengesecret for select to zhudatuanidentityjob using(exists(
    select 1 from runtime.job where kind='identitynotification' and owner='identity'
      and payload->>'challenge'=identity.challengesecret.challenge_id and state='running'
  ));
  drop policy if exists zhudatuanidentityjob on identity.challengedelivery;
  create policy zhudatuanidentityjob on identity.challengedelivery for select to zhudatuanidentityjob using(exists(
    select 1 from runtime.job where kind='identitynotification' and owner='identity'
      and payload->>'challenge'=identity.challengedelivery.challenge_id and state='running'
  ));
  drop policy if exists zhudatuanidentityjobinsert on identity.challengedelivery;
  create policy zhudatuanidentityjobinsert on identity.challengedelivery for insert to zhudatuanidentityjob with check(exists(
    select 1 from runtime.job where kind='identitynotification' and owner='identity'
      and payload->>'challenge'=identity.challengedelivery.challenge_id and state='running'
  ));
  drop policy if exists zhudatuanidentityjobupdate on identity.challengedelivery;
  create policy zhudatuanidentityjobupdate on identity.challengedelivery for update to zhudatuanidentityjob using(exists(
    select 1 from runtime.job where kind='identitynotification' and owner='identity'
      and payload->>'challenge'=identity.challengedelivery.challenge_id and state='running'
  )) with check(exists(
    select 1 from runtime.job where kind='identitynotification' and owner='identity'
      and payload->>'challenge'=identity.challengedelivery.challenge_id and state='running'
  ));

  drop policy if exists zhudatuanbootstrap on member.invite;
  create policy zhudatuanbootstrap on member.invite for select to zhudatuanbootstrap
    using(organization_id='mall-zhudatuan' and role_id='role-zhudatuan-storefront-member');
  drop policy if exists zhudatuanbootstrapinsert on member.invite;
  create policy zhudatuanbootstrapinsert on member.invite for insert to zhudatuanbootstrap
    with check(organization_id='mall-zhudatuan' and role_id='role-zhudatuan-storefront-member'
      and max_uses=1 and use_count=0 and status='active'
      and registration_policy_id='registration:zhudatuan:2026-08-28-v1');
  drop policy if exists zhudatuanbootstrap on identity.registrationpolicy;
  create policy zhudatuanbootstrap on identity.registrationpolicy for select to zhudatuanbootstrap
    using(id='registration:zhudatuan:2026-08-28-v1');
  drop policy if exists zhudatuanbootstrap on access.permission;
  create policy zhudatuanbootstrap on access.permission for select to zhudatuanbootstrap using(true);
  drop policy if exists zhudatuanbootstrap on access.role;
  create policy zhudatuanbootstrap on access.role for select to zhudatuanbootstrap
    using(id in('role-zhudatuan-storefront-member','role:self'));
  drop policy if exists zhudatuanbootstrap on access.rolepermission;
  create policy zhudatuanbootstrap on access.rolepermission for select to zhudatuanbootstrap
    using(role_id in('role-zhudatuan-storefront-member','role:self'));
  drop policy if exists zhudatuanbootstrap on organization.organization;
  create policy zhudatuanbootstrap on organization.organization for select to zhudatuanbootstrap
    using(id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan'));
  drop policy if exists zhudatuanbootstrap on organization.unitclosure;
  create policy zhudatuanbootstrap on organization.unitclosure for select to zhudatuanbootstrap
    using(descendant_id='mall-zhudatuan' or ancestor_id='mall-zhudatuan');
  drop policy if exists zhudatuanbootstrap on audit.record;
  create policy zhudatuanbootstrap on audit.record for select to zhudatuanbootstrap using(scope_id='mall-zhudatuan');
  drop policy if exists zhudatuanbootstrapinsert on audit.record;
  create policy zhudatuanbootstrapinsert on audit.record for insert to zhudatuanbootstrap
    with check(scope_id='mall-zhudatuan' and action='identity.registration.invitation.bootstrapped');
  drop policy if exists zhudatuanbootstrap on audit.accessrecord;
  create policy zhudatuanbootstrap on audit.accessrecord for select to zhudatuanbootstrap using(scope_id='mall-zhudatuan');
  drop policy if exists zhudatuanbootstrap on audit.archiveref;
  create policy zhudatuanbootstrap on audit.archiveref for select to zhudatuanbootstrap using(scope_id='mall-zhudatuan');
end
$policies$;

with previous as (
  select record_hash from (
    select record_hash,recorded_at occurred_at from audit.record where scope_id='mall-zhudatuan'
    union all select record_hash,accessed_at from audit.accessrecord where scope_id='mall-zhudatuan'
    union all select last_record_hash,through_at from audit.archiveref where scope_id='mall-zhudatuan'
  ) chain order by occurred_at desc limit 1
)
insert into audit.record(
  id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
  previous_hash,record_hash,recorded_at
)
select
  'audit:zhudatuan:registration-baseline:v1','mall-zhudatuan','shopmigration','migration',
  'identity.registration.baseline.established','identity.registrationpolicy','registration:zhudatuan:2026-08-28-v1',
  null,'207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d',
  jsonb_build_object(
    'baseline','zhudatuan-registration-v1','organization','mall-zhudatuan','role','role-zhudatuan-storefront-member',
    'legacyPolicyRetired','registration:2026-08-13','legacyInvitationDisabled','invite-demo-employee-2026',
    'paymentCreateRisk','high','paymentOperation','payment.intents.create',
    'destructiveDelete',false
  ),
  'migration:20260828170000',previous.record_hash,
  encode(digest('audit:zhudatuan:registration-baseline:v1:'||coalesce(previous.record_hash,'')||
    ':207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d','sha256'),'hex'),
  '2026-08-28T00:00:00Z'
from (select 1) seed left join previous on true
on conflict(id,recorded_at) do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260828170000','5cf87482ba3d0db32500809d28a77973ac285657aeb9c14612ba3dc525a2965e')
on conflict(version) do nothing;

-- Canonical database contract for the one-shot 主打团 Console Owner bootstrap.
-- The runtime role receives EXECUTE only; it never receives direct
-- identity/access writes.
create schema if not exists deployment authorization current_user;
revoke all on schema deployment from public;
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

do $assert$
begin
  if (select count(*) from organization.organization where id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan') and status='active')<>3
    then raise exception 'ZHUDATUAN_ORGANIZATION_BASELINE_MISSING'; end if;
  if exists (
    select 1 from (values
      ('organization-platform-root','tenant-zhudatuan',1),('organization-platform-root','enterprise-zhudatuan',2),
      ('organization-platform-root','mall-zhudatuan',3),('tenant-zhudatuan','enterprise-zhudatuan',1),
      ('tenant-zhudatuan','mall-zhudatuan',2),('enterprise-zhudatuan','mall-zhudatuan',1)
    ) expected(ancestor_id,descendant_id,depth)
    where not exists (
      select 1 from organization.unitclosure closure
      where closure.ancestor_id=expected.ancestor_id and closure.descendant_id=expected.descendant_id and closure.depth=expected.depth
    )
  ) then raise exception 'ZHUDATUAN_ORGANIZATION_CLOSURE_INVALID'; end if;
  if (select count(*) from organization.unitclosure where descendant_id='mall-zhudatuan')<>4
    or (select count(*) from organization.unitclosure where ancestor_id='mall-zhudatuan')<>1
    or exists (
      select 1 from organization.unitclosure
      where descendant_id='mall-zhudatuan' and (ancestor_id,depth) not in(
        ('organization-platform-root',3),('tenant-zhudatuan',2),('enterprise-zhudatuan',1),('mall-zhudatuan',0)
      )
    )
  then raise exception 'ZHUDATUAN_MALL_CLOSURE_NOT_EXACT'; end if;
  if (select count(*) from identity.registrationpolicy
      where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp()))<>1
    or not exists (
      select 1 from identity.registrationpolicy
      where id='registration:zhudatuan:2026-08-28-v1'
        and terms_hash='207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d'
        and retired_at is null
    ) then raise exception 'ZHUDATUAN_ACTIVE_REGISTRATION_POLICY_INVALID'; end if;
  if exists (
    select 1 from member.invite
    where status='active' and (id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))
  ) then raise exception 'LEGACY_REGISTRATION_INVITATION_STILL_ACTIVE'; end if;
  if exists (
    select 1 from identity.principal principal join member.profile profile on profile.principal_id=principal.id
    join access.membership membership on membership.member_id=profile.id
    where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
      and (principal.status='active' or profile.status='active' or membership.status in('active','invited'))
  ) or exists (
    select 1 from identity.credential credential join member.profile profile on profile.principal_id=credential.principal_id
    join access.membership membership on membership.member_id=profile.id
    where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo') and credential.status='active'
  ) then raise exception 'LEGACY_REGISTRATION_IDENTITY_STILL_ACTIVE'; end if;
  if not exists (
    select 1 from access.role where id='role-zhudatuan-storefront-member' and scope_id='mall-zhudatuan'
      and name='商城会员' and status='active'
  ) then raise exception 'ZHUDATUAN_STOREFRONT_ROLE_INVALID'; end if;
  if not exists(select 1 from access.role where id='role:self' and scope_id='self' and status='active')
    or (select count(*) from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role:self' and mapping.effect='allow'
        and permission.code in('identity.session.read','identity.session.manage'))<>2
  then raise exception 'CANONICAL_SELF_ROLE_INVALID'; end if;
  if (select count(*) from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-zhudatuan-storefront-member' and mapping.effect='allow' and permission.code in(
        'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
        'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
        'observability.clienterror.create'
      ))<>14
    or (select count(*) from access.rolepermission where role_id='role-zhudatuan-storefront-member')<>14
    or exists (
      select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-zhudatuan-storefront-member'
        and (mapping.effect<>'allow' or permission.status<>'active'
          or (permission.risk in('high','critical') and permission.code<>'payment.create'))
    )
    or not exists (
      select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      join capability.operation operation on operation.permission_code=permission.code
      where mapping.role_id='role-zhudatuan-storefront-member' and mapping.effect='allow'
        and permission.code='payment.create' and permission.risk='high' and permission.status='active'
        and operation.operation_id='payment.intents.create'
    ) then raise exception 'ZHUDATUAN_STOREFRONT_ROLE_PERMISSIONS_INVALID'; end if;
  if not exists (
    select 1 from audit.record where id='audit:zhudatuan:registration-baseline:v1'
      and scope_id='mall-zhudatuan' and action='identity.registration.baseline.established'
      and evidence->>'destructiveDelete'='false'
  ) then raise exception 'ZHUDATUAN_REGISTRATION_AUDIT_MISSING'; end if;
  if has_function_privilege('zhudatuanidentityjob','runtime.claim_job(text,text,integer,integer)','EXECUTE')
    or not has_function_privilege('zhudatuanidentityjob','runtime.claim_identity_notification_job(text,integer,integer)','EXECUTE')
    or has_table_privilege('zhudatuanidentityjob','payment.payment','SELECT')
    or has_table_privilege('zhudatuanidentityapi','finance.entry','SELECT')
  then raise exception 'ZHUDATUAN_DATABASE_ROLE_PRIVILEGE_INVALID'; end if;
  if not exists (
    select 1 from runtime.schemaversion
    where version='20260828170000' and checksum='5cf87482ba3d0db32500809d28a77973ac285657aeb9c14612ba3dc525a2965e'
  ) then raise exception 'ZHUDATUAN_REGISTRATION_SCHEMA_VERSION_INVALID'; end if;
end
$assert$;

commit;
