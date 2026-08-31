begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));

do $boundary_guard$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'PLATFORM_OWNER_TRANSFER_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260829060000'
      and checksum='b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a')
    or not exists(select 1 from runtime.schemaversion where version='20260829210000'
      and checksum='7a5e2d2cb2e3682674a3d8a7ac52177ba0f6ee93588bd9a7f489d4c405a4d222') then
    raise exception 'PLATFORM_OWNER_TRANSFER_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260829210000' and version<>'20260829211000') then
    raise exception 'PLATFORM_OWNER_TRANSFER_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

insert into access.permission(id,code,risk,status) values
  ('permission:99b287597f4661a544801453','access.ownership.read','high','active'),
  ('permission:23df845f30364ef2f6886148','access.ownership.transfer','critical','active'),
  ('permission:6782fe00965fc57d412cc213','access.ownership.accept','critical','active')
on conflict(code) do update set risk=excluded.risk,status='active';

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.mobile.challenge','identity','POST','/api/v1/identity/mobile/challenges','1.0.0'),
  ('access.ownership.read','access','GET','/api/v1/access/ownership','1.0.0'),
  ('access.ownership.transfers.preview','access','POST','/api/v1/access/ownership/transfers/preview','1.0.0'),
  ('access.ownership.transfers.create','access','POST','/api/v1/access/ownership/transfers','1.0.0'),
  ('access.ownership.transfers.accept.preview','access','POST','/api/v1/access/ownership/transfers/{transferid}/accept/preview','1.0.0'),
  ('access.ownership.transfers.accept','access','POST','/api/v1/access/ownership/transfers/{transferid}/accept','1.0.0'),
  ('access.ownership.transfers.cancel.preview','access','POST','/api/v1/access/ownership/transfers/{transferid}/cancel/preview','1.0.0'),
  ('access.ownership.transfers.cancel','access','POST','/api/v1/access/ownership/transfers/{transferid}/cancel','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into runtime.event(type,version,owner,schema_ref) values
  ('access.owner.bootstrapped',1,'access','contract://events/access.owner.bootstrapped/v1'),
  ('access.owner.transfer.initiated',1,'access','contract://events/access.owner.transfer.initiated/v1'),
  ('access.owner.transferred',1,'access','contract://events/access.owner.transferred/v1'),
  ('access.owner.transfer.cancelled',1,'access','contract://events/access.owner.transfer.cancelled/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

insert into capability.capability(id,kind,name,version,status)
select operation.id,'operation',operation.id,1,'active' from runtime.operation operation
where operation.id like 'access.ownership.%' or operation.id='identity.mobile.challenge'
on conflict(id) do update set kind='operation',name=excluded.name,status='active';

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('identity.mobile.challenge','identity.mobile.challenge','identity.mobile.manage','member'),
  ('access.ownership.read','access.ownership.read','access.ownership.read','operator'),
  ('access.ownership.transfers.preview','access.ownership.transfers.preview','access.ownership.transfer','operator'),
  ('access.ownership.transfers.create','access.ownership.transfers.create','access.ownership.transfer','operator'),
  ('access.ownership.transfers.accept.preview','access.ownership.transfers.accept.preview','access.ownership.accept','operator'),
  ('access.ownership.transfers.accept','access.ownership.transfers.accept','access.ownership.accept','operator'),
  ('access.ownership.transfers.cancel.preview','access.ownership.transfers.cancel.preview','access.ownership.transfer','operator'),
  ('access.ownership.transfers.cancel','access.ownership.transfers.cancel','access.ownership.transfer','operator')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,audience=excluded.audience;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||operation.capability_id,'organization-platform-root',operation.capability_id,'enabled',null,
  '1970-01-01T00:00:00Z',null,0 from capability.operation operation
where operation.operation_id like 'access.ownership.%' or operation.operation_id='identity.mobile.challenge'
on conflict(scope_id,capability_id,effective_at) do update set state='enabled',quota=null,expires_at=null;

insert into access.role(id,scope_id,name,status,version)
values('role-platform-owner-successor-v1','tenant-zhudatuan','Owner 受让候选人','active',1)
on conflict(id) do update set scope_id='tenant-zhudatuan',name='Owner 受让候选人',status='active';

delete from access.rolepermission where role_id='role-platform-owner-successor-v1';
insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-successor-v1',permission.id,'allow' from access.permission permission
where permission.code in('access.ownership.read','access.ownership.accept') on conflict do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission
where permission.code in('access.ownership.read','access.ownership.transfer','access.ownership.accept') on conflict do nothing;

create table access.platformowner(
  singleton boolean primary key default true check(singleton),
  state text not null check(state in('bootstrap_pending','active')),
  membership_id text references access.membership(id) on delete restrict,
  version bigint not null default 0 check(version>=0),
  initialized_at timestamptz,
  updated_at timestamptz not null,
  check((state='bootstrap_pending' and membership_id is null and initialized_at is null)
    or (state='active' and membership_id is not null and initialized_at is not null))
);

create table access.ownertransfer(
  id text primary key,
  source_membership_id text not null references access.membership(id) on delete restrict,
  target_membership_id text not null references access.membership(id) on delete restrict,
  former_owner_mode text not null check(former_owner_mode in('retain_admin','remove_admin')),
  former_owner_role_id text references access.role(id) on delete restrict,
  former_owner_role_version bigint,
  requested_by text not null,
  requested_session text not null,
  accepted_by text,
  accepted_session text,
  cancelled_by text,
  cancel_reason text,
  ownership_version bigint not null check(ownership_version>=0),
  target_access_version bigint not null check(target_access_version>0),
  state text not null check(state in('pending_acceptance','accepted','cancelled','expired')),
  cooling_until timestamptz not null,
  expires_at timestamptz not null,
  requested_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  version bigint not null check(version>0),
  check(source_membership_id<>target_membership_id),
  check(cooling_until=requested_at+interval '24 hours'),
  check(expires_at=requested_at+interval '7 days'),
  check((former_owner_mode='retain_admin')=(former_owner_role_id is not null)),
  check((former_owner_mode='retain_admin')=(former_owner_role_version is not null)),
  check((accepted_by is null)=(accepted_session is null)),
  check((state='accepted')=(accepted_at is not null)),
  check((state='accepted')=(accepted_by is not null)),
  check((state='cancelled')=(cancelled_at is not null)),
  check((state='cancelled')=(cancelled_by is not null)),
  check((state='cancelled')=(cancel_reason is not null)),
  check(not (state<>'accepted' and (accepted_at is not null or accepted_by is not null or accepted_session is not null))),
  check(not (state<>'cancelled' and (cancelled_at is not null or cancelled_by is not null or cancel_reason is not null)))
);
create unique index access_one_pending_owner_transfer on access.ownertransfer((true)) where state='pending_acceptance';

create table access.owneractionproof(
  nonce text primary key,
  action text not null check(action in('create','accept','cancel')),
  actor_id text not null,
  session_id text not null,
  source_membership_id text not null,
  target_membership_id text not null,
  former_owner_mode text not null check(former_owner_mode in('retain_admin','remove_admin')),
  former_owner_role_id text,
  former_owner_role_version bigint,
  ownership_version bigint not null check(ownership_version>=0),
  transfer_version bigint,
  target_access_version bigint not null check(target_access_version>0),
  reason_hash char(64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null,
  check(expires_at>created_at),
  check((former_owner_mode='retain_admin')=(former_owner_role_id is not null)),
  check((former_owner_mode='retain_admin')=(former_owner_role_version is not null)),
  check(reason_hash is null or reason_hash~'^[0-9a-f]{64}$')
);

alter table identity.challenge add column session_hash char(64);

-- The authenticated mobile/Step-Up boundary is replaced by this release.  Retire every
-- pre-cutover high-assurance artifact atomically so a challenge or session minted through
-- the former public path cannot cross the migration boundary.
update identity.challenge set consumed_at=clock_timestamp()
where purpose in('stepup','phone_change') and consumed_at is null and expires_at>clock_timestamp();
alter table identity.challenge add constraint identity_challenge_secure_session_bound check(
  purpose not in('stepup','phone_change') or session_hash is not null or consumed_at is not null
);
update identity.assurance set expires_at=least(coalesce(expires_at,clock_timestamp()),clock_timestamp())
where level>=3 and (expires_at is null or expires_at>clock_timestamp());
update identity.session set revoked_at=clock_timestamp(),revoked_reason='owner_stepup_boundary_rotated'
where assurance_level>=3 and revoked_at is null and expires_at>clock_timestamp();

-- High assurance belongs to the exact session that completed Step-Up.  A principal-level
-- assurance must never raise a second session to AAL3.
create or replace function identity.resolve_session(p_token_hash text)
returns table(actor_id text,session_id text,membership_id text,credential_version bigint,access_version bigint,
  target text,assurance_level smallint,assurance_verified_at timestamptz)
language sql stable security definer set search_path=identity,member,access,public,pg_temp as $function$
  select session.principal_id,session.id,session.membership_id,session.credential_version,session.access_version,
    case session.client when 'operator' then 'console' else session.client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null
      then stepup.verified_at else null end
  from identity.session session
  join identity.principal principal on principal.id=session.principal_id
  join member.profile profile on profile.principal_id=session.principal_id
  join access.membership membership on membership.id=session.membership_id and membership.member_id=profile.id
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1) phone on true
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.level>=3
      and evidence.evidence_hash=encode(public.digest(session.id::text,'sha256'),'hex')
      and evidence.verified_at>=clock_timestamp()-interval '15 minutes'
      and evidence.verified_at<=clock_timestamp()
      and evidence.expires_at is not null and evidence.expires_at>clock_timestamp()
    order by evidence.level desc,evidence.verified_at desc limit 1) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version and principal.status='active' and membership.status='active'
$function$;
revoke all on function identity.resolve_session(text) from public;
grant execute on function identity.resolve_session(text) to shopapp,zhudatuanidentityapi;

-- The earlier identity-reset foundation protected the fixed bootstrap Owner
-- with table-specific triggers. This migration replaces that fixed identity
-- with the transferable singleton and its lifecycle trigger, so retire the
-- obsolete guards before normalizing the inaugural Owner assignment.
drop trigger if exists protect_root_owner on access.membership;
drop trigger if exists protect_root_owner on access.membershiprole;
drop trigger if exists protect_root_owner on identity.principal;
drop trigger if exists protect_root_owner on member.profile;
drop trigger if exists protect_root_owner on identity.credential;

do $seed_owner$
declare
  owner_count integer;
  owner_membership text;
  owner_principal text;
  owner_access_version bigint;
  normalized_at timestamptz:=clock_timestamp();
begin
  select count(distinct membership.id),min(membership.id) into owner_count,owner_membership
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join access.membershiprole assignment on assignment.membership_id=membership.id
    and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
    and assignment.expires_at is null
  where membership.organization_id='tenant-zhudatuan' and membership.client='operator' and membership.status='active';
  if owner_count>1 then raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE'; end if;
  -- Historical bootstraps can leave an Owner-role assignment attached to a disabled or otherwise
  -- invalid principal.  It is not a second valid Owner, but leaving it unexpired would resurrect a
  -- second Owner if that principal were later re-enabled.  Keep only the selected valid singleton.
  update access.membershiprole set expires_at=normalized_at
  where role_id='role-platform-owner-v2'
    and (expires_at is null or expires_at>normalized_at)
    and (owner_count=0 or membership_id<>owner_membership);
  if owner_count=0 then
    insert into access.platformowner(singleton,state,membership_id,version,initialized_at,updated_at)
    values(true,'bootstrap_pending',null,0,null,clock_timestamp());
  else
    select profile.principal_id,membership.access_version into owner_principal,owner_access_version
    from access.membership membership join member.profile profile on profile.id=membership.member_id
    where membership.id=owner_membership;
    -- Existing deployments may carry old admin roles or explicit denies.  Canonical Owner is
    -- exactly Owner+self with exactly platform+tenant+self grants; normalize before publishing the
    -- singleton so no legacy deny can silently reduce full platform coverage.
    update access.membershiprole set expires_at=normalized_at
    where membership_id=owner_membership and (expires_at is null or expires_at>normalized_at);
    insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by) values
      (owner_membership,'role-platform-owner-v2',normalized_at,owner_principal),
      (owner_membership,'role:self',normalized_at,owner_principal);

    update access.scopegrant set expires_at=normalized_at
    where membership_id=owner_membership and (expires_at is null or expires_at>normalized_at);
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:owner-normalize:'||public.gen_random_uuid(),owner_membership,'platform','organization-platform-root',
        'organization-platform-root','allow',normalized_at,owner_access_version+1),
      ('scope:owner-normalize:'||public.gen_random_uuid(),owner_membership,'tenant','tenant-zhudatuan',
        'tenant-zhudatuan','allow',normalized_at,owner_access_version+1),
      ('scope:owner-normalize:'||public.gen_random_uuid(),owner_membership,'self','self:'||owner_principal,
        'self:'||owner_principal,'allow',normalized_at,owner_access_version+1);
    update access.membershipoverride set revoked_at=normalized_at
    where membership_id=owner_membership and revoked_at is null
      and (expires_at is null or expires_at>normalized_at);

    insert into access.platformowner(singleton,state,membership_id,version,initialized_at,updated_at)
    values(true,'active',owner_membership,1,normalized_at,normalized_at);
    update access.membership set access_version=access_version+1 where id=owner_membership;
    update access.scopegrant set access_version=owner_access_version+1 where membership_id=owner_membership
      and effective_at<=normalized_at and (expires_at is null or expires_at>normalized_at);
    update identity.session set revoked_at=normalized_at,revoked_reason='owner_capability_coverage_changed'
      where membership_id=owner_membership and revoked_at is null;
  end if;
end
$seed_owner$;

alter table access.platformowner enable row level security;
alter table access.ownertransfer enable row level security;
alter table access.owneractionproof enable row level security;
revoke all on access.platformowner,access.ownertransfer,access.owneractionproof
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
grant select on access.platformowner to shopapp,zhudatuanidentityapi;
grant select on access.ownertransfer to shopapp;
grant insert on access.owneractionproof to shopapp;
create policy platformowner_shopapp on access.platformowner for select to shopapp using(current_setting('app.workload',true)='api');
create policy platformowner_identityapi on access.platformowner for select to zhudatuanidentityapi using(true);
drop policy if exists platformowner_bootstrap on access.platformowner;
create policy ownertransfer_shopapp on access.ownertransfer for select to shopapp using(
  current_setting('app.workload',true)='api'
  and nullif(current_setting('app.membership_id',true),'') in(source_membership_id,target_membership_id)
  and exists(select 1 from access.membership context_membership
    join member.profile context_profile on context_profile.id=context_membership.member_id
    where context_membership.id=nullif(current_setting('app.membership_id',true),'')
      and context_profile.principal_id=nullif(current_setting('app.actor_id',true),'')));
create policy owneractionproof_shopapp on access.owneractionproof for insert to shopapp with check(
  current_setting('app.workload',true)='api'
  and actor_id=nullif(current_setting('app.actor_id',true),'')
  and source_membership_id<>target_membership_id
  and ((action in('create','cancel') and source_membership_id=nullif(current_setting('app.membership_id',true),''))
    or (action='accept' and target_membership_id=nullif(current_setting('app.membership_id',true),'')))
  and exists(select 1 from access.membership context_membership
    join member.profile context_profile on context_profile.id=context_membership.member_id
    where context_membership.id=nullif(current_setting('app.membership_id',true),'')
      and context_profile.principal_id=actor_id));

create or replace function access.resolve_scope(p_membership_id text,p_operation text,p_resource text)
returns table(scope jsonb) language sql stable security definer
set search_path=access,member,pg_temp as $function$
  select case when p_operation like 'access.ownership.%' then
    (select access.scope_object('self:'||profile.principal_id) from access.membership membership
      join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id)
  when exists(select 1 from capability.operation operation where operation.operation_id=p_operation
      and operation.permission_code in('organization.layer.manage','channel.distributor.manage','extension.installation.read'))
    then access.scope_object('organization-platform-root')
  else access.scope_object(access.resource_scope(p_operation,p_resource,p_membership_id)) end
$function$;
grant execute on function access.resolve_scope(text,text,text) to shopapp,zhudatuanidentityapi;

-- Ownership resolves to the caller's self scope.  Project only the three exact Owner
-- governance permissions from the Owner/successor roles onto that self grant; do not make
-- role:self a privilege carrier and do not project the rest of either operator role to self.
create or replace function access.resolve_membership(p_membership_id text)
returns table(id text,active boolean,access_version bigint,denies text[],grants jsonb)
language sql stable security definer
set search_path=access,member,organization,pg_temp as $function$
  select membership.id,membership.status='active',membership.access_version,
    coalesce((select array_agg(distinct denied.code order by denied.code) from (
      select permission.code
      from access.membershiprole assignment
      join access.role role on role.id=assignment.role_id and role.status='active'
      join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='deny'
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      where assignment.membership_id=membership.id
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
        and (role.id='role:self' or role.scope_id=membership.organization_id or exists(
          select 1 from organization.unitclosure closure
          where closure.ancestor_id=role.scope_id and closure.descendant_id=membership.organization_id))
      union
      select permission.code
      from access.membershipoverride overridepermission
      join access.permission permission on permission.id=overridepermission.permission_id and permission.status='active'
      where overridepermission.membership_id=membership.id and overridepermission.effect='deny'
        and overridepermission.revoked_at is null
        and overridepermission.effective_at<=clock_timestamp()
        and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())
    ) denied),array[]::text[]),
    coalesce((select jsonb_agg(jsonb_build_object(
      'scope',access.scope_object(scopegrant.scope_id),
      'permissions',coalesce((select jsonb_agg(distinct allowed.code order by allowed.code) from (
          select permission.code
          from access.membershiprole assignment
          join access.role role on role.id=assignment.role_id and role.status='active'
          join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
          join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
          where assignment.membership_id=membership.id
            and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            and (
              (role.id='role:self' and scopegrant.scope_kind in('self','owner'))
              or (role.id='role-platform-owner-v2'
                and (
                  exists(select 1 from access.platformowner owner where owner.singleton=true
                    and owner.state='active' and owner.membership_id=membership.id)
                  -- The compatibility bootstrap validates effective console access inside the
                  -- legacy function, immediately before this migration's wrapper can activate
                  -- the singleton. Expose the sole in-transaction Owner assignment only to the
                  -- dedicated bootstrap login; rollback removes it if activation does not finish.
                  or (
                    session_user='zhudatuanbootstrap'
                    and exists(select 1 from access.platformowner owner
                      where owner.singleton=true and owner.state='bootstrap_pending'
                        and owner.membership_id is null)
                    and membership.id='membership-platform-owner-ethan-v1'
                    and (select count(*) from access.membershiprole ownerassignment
                      where ownerassignment.role_id='role-platform-owner-v2'
                        and ownerassignment.effective_at<=clock_timestamp()
                        and (ownerassignment.expires_at is null
                          or ownerassignment.expires_at>clock_timestamp()))=1
                  )
                )
                and scopegrant.scope_kind='platform' and scopegrant.scope_id='organization-platform-root')
              or (role.id in('role-platform-owner-v2','role-platform-owner-successor-v1')
                and scopegrant.scope_kind='self'
                and scopegrant.scope_id=(select 'self:'||profile.principal_id from member.profile profile
                  where profile.id=membership.member_id)
                and permission.code in('access.ownership.read','access.ownership.transfer','access.ownership.accept')
                and ((role.id='role-platform-owner-v2' and exists(select 1 from access.platformowner owner
                    where owner.singleton=true and owner.state='active' and owner.membership_id=membership.id))
                  or (role.id='role-platform-owner-successor-v1' and permission.code<>'access.ownership.transfer')))
              or (role.id not in('role-platform-owner-v2','role-platform-owner-successor-v1')
                and (role.scope_id=membership.organization_id or exists(
                select 1 from organization.unitclosure closure
                where closure.ancestor_id=role.scope_id and closure.descendant_id=membership.organization_id))
                and (role.scope_id=scopegrant.scope_id or exists(
                  select 1 from organization.unitclosure closure
                  where closure.ancestor_id=role.scope_id and closure.descendant_id=scopegrant.scope_id)))
            )
          union
          select permission.code
          from access.membershipoverride overridepermission
          join access.permission permission on permission.id=overridepermission.permission_id and permission.status='active'
          where overridepermission.membership_id=membership.id and overridepermission.effect='allow'
            and overridepermission.revoked_at is null
            and overridepermission.effective_at<=clock_timestamp()
            and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())
        ) allowed), '[]'::jsonb),
      'effective',scopegrant.effective_at,'expires',scopegrant.expires_at) order by scopegrant.scope_path)
      from access.scopegrant scopegrant
      where scopegrant.membership_id=membership.id and scopegrant.effect='allow'
        and scopegrant.access_version>0 and scopegrant.access_version<=membership.access_version
        and scopegrant.effective_at<=clock_timestamp()
        and (scopegrant.expires_at is null or scopegrant.expires_at>clock_timestamp())), '[]'::jsonb)
  from access.membership membership where membership.id=p_membership_id
$function$;
grant execute on function access.resolve_membership(text) to shopapp,zhudatuanidentityapi;

create or replace function access.zhudatuan_owner_context()
returns boolean language sql stable
set search_path=pg_catalog,pg_temp as $function$
  select current_user in('shopapp','zhudatuanidentityapi') and owner.state='active'
    and nullif(current_setting('app.membership_id',true),'')=owner.membership_id
    and nullif(current_setting('app.actor_id',true),'')=profile.principal_id
    and nullif(current_setting('app.scope_id',true),'') in('tenant-zhudatuan','self:'||profile.principal_id)
    and membership.organization_id='tenant-zhudatuan' and membership.client='operator' and membership.status='active'
    and profile.status='active' and principal.status='active'
    and exists(select 1 from access.membershiprole assignment where assignment.membership_id=owner.membership_id
      and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
      and assignment.expires_at is null)
  from access.platformowner owner join access.membership membership on membership.id=owner.membership_id
  join member.profile profile on profile.id=membership.member_id
  join identity.principal principal on principal.id=profile.principal_id where owner.singleton=true
$function$;
grant execute on function access.zhudatuan_owner_context() to shopapp,zhudatuanidentityapi;

create or replace function access.zhudatuan_invitation_owner()
returns boolean language sql stable
set search_path=pg_catalog,pg_temp as $function$
  select current_user='zhudatuanidentityapi' and access.zhudatuan_owner_context()
    and nullif(current_setting('app.scope_id',true),'')='tenant-zhudatuan'
    and exists(select 1 from access.platformowner owner join access.rolepermission mapping
      on mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
      join access.permission permission on permission.id=mapping.permission_id
      where owner.singleton=true and owner.state='active' and permission.code='identity.invitation.manage'
        and permission.status='active' and not exists(select 1 from access.membershipoverride denied
          where denied.membership_id=owner.membership_id and denied.permission_id=permission.id and denied.effect='deny'
            and denied.revoked_at is null and denied.effective_at<=clock_timestamp()
            and (denied.expires_at is null or denied.expires_at>clock_timestamp())))
$function$;
grant execute on function access.zhudatuan_invitation_owner() to zhudatuanidentityapi;

-- Keep every 060000 invite mutation rule, replacing only the fixed Ethan creator with the singleton Owner.
do $rewrite_invite_trigger$
declare definition text; rewritten text;
begin
  select pg_get_functiondef('member.protect_zhudatuan_invite_update()'::regprocedure) into definition;
  rewritten := replace(definition,
    'and new.created_by=''membership-platform-owner-ethan-v1''',
    'and new.created_by=(select owner.membership_id from access.platformowner owner where owner.singleton=true and owner.state=''active'')');
  if rewritten=definition then raise exception 'OWNER_INVITE_TRIGGER_REWRITE_FAILED'; end if;
  execute rewritten;
end
$rewrite_invite_trigger$;

drop policy if exists zhudatuanidentityapiinsert on member.invite;
create policy zhudatuanidentityapiinsert on member.invite for insert to zhudatuanidentityapi with check(
  access.zhudatuan_invitation_owner()
  and created_by=(select owner.membership_id from access.platformowner owner where owner.singleton=true and owner.state='active')
  and target_client='operator' and role_id='role-zhudatuan-pending-operator'
  and organization_id='tenant-zhudatuan' and storefront_organization_id='mall-zhudatuan'
  and allowed_destination_hash is not null and max_uses=1 and use_count=0 and status='active'
  and accepted_at is null and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
  and exists(select 1 from organization.organization storefront
    join organization.unitclosure closure on closure.descendant_id=storefront.id
    where storefront.id=member.invite.storefront_organization_id and storefront.kind='mall' and storefront.status='active'
      and closure.ancestor_id=member.invite.organization_id)
  and exists(select 1 from access.role pending
    where pending.id=member.invite.role_id and pending.scope_id=member.invite.organization_id and pending.status='active')
  and not exists(select 1 from access.rolepermission pendingpermission where pendingpermission.role_id=member.invite.role_id)
);

create or replace function access.protect_zhudatuan_owner()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
declare owner_membership text; owner_member text; owner_principal text; protected boolean:=false;
begin
  select owner.membership_id,membership.member_id,profile.principal_id
  into owner_membership,owner_member,owner_principal from access.platformowner owner
  left join access.membership membership on membership.id=owner.membership_id
  left join member.profile profile on profile.id=membership.member_id where owner.singleton=true and owner.state='active';
  if tg_table_schema='access' and tg_table_name='role' then
    protected := (tg_op<>'INSERT' and old.id='role-platform-owner-v2') or (tg_op<>'DELETE' and new.id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name='rolepermission' then
    protected := (tg_op<>'INSERT' and old.role_id='role-platform-owner-v2') or (tg_op<>'DELETE' and new.role_id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name='membership' then
    protected := (tg_op<>'INSERT' and old.id=owner_membership) or (tg_op<>'DELETE' and new.id=owner_membership);
  elsif tg_table_schema='access' and tg_table_name='membershiprole' then
    protected := (tg_op<>'INSERT' and old.membership_id=owner_membership)
      or (tg_op<>'DELETE' and new.membership_id=owner_membership)
      or (tg_op<>'INSERT' and old.role_id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.role_id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name in('scopegrant','membershipoverride') then
    protected := (tg_op<>'INSERT' and old.membership_id=owner_membership)
      or (tg_op<>'DELETE' and new.membership_id=owner_membership);
  elsif tg_table_schema='identity' and tg_table_name='principal' then
    protected := (tg_op<>'INSERT' and old.id=owner_principal) or (tg_op<>'DELETE' and new.id=owner_principal);
  elsif tg_table_schema='identity' and tg_table_name='credential' then
    protected := (tg_op<>'INSERT' and old.principal_id=owner_principal) or (tg_op<>'DELETE' and new.principal_id=owner_principal);
  elsif tg_table_schema='member' and tg_table_name='profile' then
    protected := (tg_op<>'INSERT' and old.id=owner_member) or (tg_op<>'DELETE' and new.id=owner_member);
  end if;
  if not coalesce(protected,false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if current_user='shopmigration' or coalesce((select rolsuper from pg_roles where rolname=current_user),false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'ZHUDATUAN_OWNER_PROTECTED';
end
$function$;
revoke all on function access.protect_zhudatuan_owner() from public,shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;

-- Runtime password rotation for the dynamic Owner is allowed only through this atomic
-- SECURITY DEFINER.  Direct credential/principal writes remain blocked by the Owner guard.
create or replace function identity.rotate_zhudatuan_owner_password(
  p_actor text,p_session text,p_challenge text,p_secret_hash text,p_reason text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,pg_temp set row_security=off as $function$
declare
  ownerrow access.platformowner%rowtype;
  current_owner_principal text;
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
  select profile.principal_id into current_owner_principal
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  where ownerrow.state='active' and membership.id=ownerrow.membership_id;
  if p_actor is distinct from current_owner_principal then return null; end if;
  select credential.id,principal.credential_version,membership.access_version
  into owner_credential,owner_credential_version,owner_access_version
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join identity.credential credential on credential.principal_id=principal.id
    and credential.provider='password' and credential.status='active'
  where ownerrow.state='active' and membership.id=ownerrow.membership_id
    and membership.organization_id='tenant-zhudatuan' and membership.client='operator'
    and membership.status='active' and principal.id=p_actor
  for update of membership,profile,principal,credential;
  if owner_credential is null then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;

  if p_reason='credential_changed' then
    if p_challenge is not null
      or p_session is null
      or p_session!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,191}$'
      or nullif(current_setting('app.actor_id',true),'')<>p_actor
      or nullif(current_setting('app.membership_id',true),'')<>ownerrow.membership_id
      or not exists(select 1 from identity.session session
        where session.id=p_session and session.principal_id=p_actor
          and session.membership_id=ownerrow.membership_id and session.client='operator'
          and session.credential_version=owner_credential_version
          and session.access_version=owner_access_version
          and session.revoked_at is null and session.expires_at>rotation_time)
      or not exists(select 1 from identity.assurance evidence
        where evidence.principal_id=p_actor and evidence.method='password' and evidence.level>=2
          and evidence.evidence_hash=encode(public.digest(p_session::text,'sha256'),'hex')
          and evidence.verified_at>=transaction_timestamp() and evidence.verified_at<=rotation_time
          and evidence.expires_at is not null and evidence.expires_at>rotation_time)
    then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;
  else
    if p_session is not null
      or p_challenge is null
      or p_challenge!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,191}$'
      or not exists(select 1 from identity.challenge challenge
        where challenge.id=p_challenge and challenge.principal_id=p_actor
          and challenge.purpose='password_reset'
          and challenge.consumed_at>=transaction_timestamp() and challenge.consumed_at<=rotation_time
          and challenge.expires_at>challenge.consumed_at)
    then raise exception 'OWNER_PASSWORD_ROTATION_FORBIDDEN'; end if;
  end if;

  update identity.credential set secret_hash=p_secret_hash,rotated_at=rotation_time
  where id=owner_credential;
  update identity.principal set credential_version=owner_credential_version+1,
    version=version+1,updated_at=rotation_time where id=p_actor;
  with revoked as(update identity.session set revoked_at=rotation_time,revoked_reason=p_reason
      where principal_id=p_actor and revoked_at is null returning id)
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into revoked_sessions from revoked;
  return jsonb_build_object('principal',p_actor,'membership',ownerrow.membership_id,
    'credentialVersion',owner_credential_version+1,'accessVersion',owner_access_version,
    'reason',p_reason,'sessions',revoked_sessions,'sessionRevoked',true);
end
$function$;
revoke all on function identity.rotate_zhudatuan_owner_password(text,text,text,text,text)
  from public,shopjob,shopread,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function identity.rotate_zhudatuan_owner_password(text,text,text,text,text)
  to shopapp,zhudatuanidentityapi;

-- Owner mobile enrollment is the one controlled exception to the immutable identity guard.
-- The authenticated service consumes the OTP immediately before this call in the same
-- transaction.  This definer then performs every credential/profile/version/session mutation
-- atomically; direct table writes remain blocked by protect_zhudatuan_owner().
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
  select profile.id,profile.display_name,profile.mobile_ciphertext,profile.version,
    credential.id,principal.credential_version,membership.access_version,session.assurance_level
  into owner_member,owner_display_name,owner_mobile,owner_profile_version,
    owner_credential,owner_credential_version,owner_access_version,session_assurance
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join identity.credential credential on credential.principal_id=principal.id
    and credential.provider='password' and credential.status='active'
  join identity.session session on session.id=p_session and session.principal_id=principal.id
    and session.membership_id=membership.id and session.client='operator'
  where ownerrow.state='active' and membership.id=ownerrow.membership_id
    and membership.id=nullif(current_setting('app.membership_id',true),'')
    and membership.organization_id='tenant-zhudatuan' and membership.client='operator'
    and membership.status='active' and principal.id=p_actor
    and session.credential_version=principal.credential_version
    and session.access_version=membership.access_version
    and session.revoked_at is null and session.expires_at>changed_at
  for update of membership,profile,principal,credential,session;
  if owner_member is null then raise exception 'OWNER_MOBILE_CHANGE_FORBIDDEN'; end if;
  if not exists(select 1 from identity.challenge challenge where challenge.id=p_challenge
      and challenge.principal_id=p_actor and challenge.purpose='phone_change'
      and challenge.destination_hash=p_subject_hash and challenge.session_hash=p_session_hash
      and challenge.consumed_at>=transaction_timestamp()
      and challenge.consumed_at<=changed_at and challenge.expires_at>challenge.consumed_at) then
    raise exception 'OWNER_MOBILE_CHALLENGE_INVALID';
  end if;
  if owner_mobile is null then
    if session_assurance<2 or p_password_evidence_hash is null or p_password_evidence_hash!~'^[0-9a-f]{64}$'
      or p_password_evidence_hash<>p_session_hash
      or not exists(select 1 from identity.assurance evidence where evidence.principal_id=p_actor
        and evidence.method='password' and evidence.level>=2 and evidence.evidence_hash=p_password_evidence_hash
        and evidence.verified_at>=changed_at-interval '10 minutes' and evidence.verified_at<=changed_at
        and evidence.expires_at is not null and evidence.expires_at>changed_at) then
      raise exception 'OWNER_MOBILE_PASSWORD_VERIFICATION_REQUIRED';
    end if;
  elsif session_assurance<3 or not exists(select 1 from identity.assurance evidence
      where evidence.principal_id=p_actor and evidence.level>=3
        and evidence.evidence_hash=encode(public.digest(p_session::text,'sha256'),'hex')
        and evidence.verified_at>=changed_at-interval '15 minutes' and evidence.verified_at<=changed_at
        and evidence.expires_at is not null and evidence.expires_at>changed_at) then
    raise exception 'OWNER_MOBILE_STEPUP_REQUIRED';
  end if;

  update identity.credential set subject_hash=p_subject_hash,rotated_at=changed_at where id=owner_credential;
  update member.profile set mobile_ciphertext=p_ciphertext,mobile_token=p_mobile_token,mobile_masked=p_masked,
    version=version+1,updated_at=changed_at where id=owner_member returning version into next_profile_version;
  update identity.assurance set expires_at=least(coalesce(expires_at,changed_at),changed_at)
    where principal_id=p_actor and method='phone_otp' and (expires_at is null or expires_at>changed_at);
  insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
  values('assurance:owner-mobile:'||public.gen_random_uuid(),p_actor,'phone_otp',2,p_subject_hash,changed_at,
    changed_at+interval '365 days');
  update identity.principal set credential_version=owner_credential_version+1,version=version+1,updated_at=changed_at
    where id=p_actor;
  with revoked as(update identity.session set revoked_at=changed_at,revoked_reason='mobile_changed'
      where principal_id=p_actor and revoked_at is null returning id)
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into revoked_sessions from revoked;
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
    occurred_at,available_at)
  values('event:owner-mobile:'||public.gen_random_uuid(),'identity.session.revoked',1,'identity',p_session,
    ownerrow.membership_id,jsonb_build_object('sessions',revoked_sessions,'reason','mobile_changed'),
    coalesce(nullif(current_setting('app.trace_id',true),''),'owner-mobile:'||p_actor),changed_at,changed_at);
  return jsonb_build_object('id',owner_member,'display_name',owner_display_name,'mobile_masked',p_masked,
    'version',next_profile_version,'session_revoked',true,'access_version',owner_access_version);
end
$function$;
revoke all on function access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text) from public;
grant execute on function access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text) to shopapp;

create or replace function access.expire_owner_transfers()
returns integer language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare changed integer;
begin
  if session_user<>'shopapp' and coalesce(current_setting('role',true),'')<>'shopapp' then
    raise exception 'OWNER_TRANSFER_FORBIDDEN';
  end if;
  with expired as(update access.ownertransfer set state='expired',version=version+1
      where state='pending_acceptance' and expires_at<=clock_timestamp() returning target_membership_id),
    roles as(update access.membershiprole assignment set expires_at=clock_timestamp() from expired
      where assignment.membership_id=expired.target_membership_id and assignment.role_id='role-platform-owner-successor-v1'
        and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())),
    raised as(update access.membership membership set access_version=access_version+1 from expired
      where membership.id=expired.target_membership_id returning membership.id),
    revoked as(update identity.session session set revoked_at=clock_timestamp(),revoked_reason='owner_transfer_expired'
      from expired where session.membership_id=expired.target_membership_id and session.revoked_at is null)
  select count(*)::integer into changed from raised;
  return changed;
end
$function$;
revoke all on function access.expire_owner_transfers() from public;
grant execute on function access.expire_owner_transfers() to shopapp;

create or replace function access.create_owner_transfer(
  p_transfer text,p_actor text,p_session text,p_nonce text,p_ownership_version bigint,p_target_access_version bigint
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare
  proofrow access.owneractionproof%rowtype;
  ownerrow access.platformowner%rowtype;
  requested timestamptz:=clock_timestamp();
  target_member text;
  target_principal text;
  target_display_name text;
begin
  if current_setting('transaction_isolation')<>'serializable' then raise exception 'OWNER_TRANSFER_SERIALIZABLE_REQUIRED'; end if;
  if (session_user<>'shopapp' and coalesce(current_setting('role',true),'')<>'shopapp')
    or nullif(current_setting('app.actor_id',true),'')<>p_actor
    or nullif(current_setting('app.membership_id',true),'') is null then raise exception 'OWNER_TRANSFER_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  perform access.expire_owner_transfers();
  select * into ownerrow from access.platformowner where singleton=true for update;
  if not exists(select 1 from access.membership source
      join member.profile profile on profile.id=source.member_id and profile.status='active'
      join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
      where source.id=ownerrow.membership_id and profile.principal_id=p_actor
        and source.organization_id='tenant-zhudatuan' and source.client='operator' and source.status='active'
        and profile.mobile_ciphertext is not null and profile.mobile_token is not null) then
    raise exception 'OWNER_TRANSFER_FORBIDDEN';
  end if;
  if not exists(select 1 from identity.session session
      join access.membership membership on membership.id=session.membership_id and membership.status='active'
      join member.profile profile on profile.id=membership.member_id and profile.status='active'
      join identity.principal principal on principal.id=session.principal_id and principal.id=profile.principal_id
        and principal.status='active'
      where session.id=p_session and session.principal_id=p_actor and session.membership_id=ownerrow.membership_id
        and session.client='operator' and session.assurance_level>=3
        and session.credential_version=principal.credential_version
        and session.access_version=membership.access_version
        and session.revoked_at is null and session.expires_at>clock_timestamp()
        and exists(select 1 from identity.assurance evidence where evidence.principal_id=session.principal_id
          and evidence.level>=3
          and evidence.evidence_hash=encode(public.digest(session.id::text,'sha256'),'hex')
          and evidence.verified_at>=clock_timestamp()-interval '15 minutes'
          and evidence.verified_at<=clock_timestamp()
          and evidence.expires_at is not null and evidence.expires_at>clock_timestamp())) then
    raise exception 'OWNER_TRANSFER_FORBIDDEN';
  end if;
  select * into proofrow from access.owneractionproof where nonce=p_nonce for update;
  if proofrow.nonce is null or proofrow.action<>'create' or proofrow.actor_id<>p_actor or proofrow.session_id<>p_session
    or proofrow.source_membership_id<>ownerrow.membership_id
    or proofrow.source_membership_id<>nullif(current_setting('app.membership_id',true),'')
    or proofrow.ownership_version<>p_ownership_version or proofrow.ownership_version<>ownerrow.version
    or proofrow.transfer_version is not null or proofrow.target_access_version<>p_target_access_version
    or proofrow.reason_hash is not null or proofrow.consumed_at is not null or proofrow.expires_at<=clock_timestamp()
  then raise exception 'ACTION_PROOF_INVALID'; end if;
  if ownerrow.state<>'active' then raise exception 'OWNER_BOOTSTRAP_PENDING'; end if;
  if exists(select 1 from access.ownertransfer where state='pending_acceptance') then
    raise exception 'OWNER_TRANSFER_ALREADY_PENDING';
  end if;
  select profile.id,profile.principal_id,profile.display_name into target_member,target_principal,target_display_name
  from access.membership target join member.profile profile on profile.id=target.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  where target.id=proofrow.target_membership_id and target.id<>ownerrow.membership_id
    and target.organization_id='tenant-zhudatuan' and target.client='operator' and target.status='active'
    and target.id!~'^membership:temp-' and target.access_version=p_target_access_version
    and profile.mobile_ciphertext is not null and profile.mobile_token is not null
    and exists(select 1 from access.membershiprole selfrole where selfrole.membership_id=target.id
      and selfrole.role_id='role:self' and selfrole.effective_at<=requested and selfrole.expires_at is null)
    and exists(select 1 from access.scopegrant selfscope where selfscope.membership_id=target.id
      and selfscope.scope_kind='self' and selfscope.scope_id='self:'||profile.principal_id and selfscope.effect='allow'
      and selfscope.effective_at<=requested and selfscope.expires_at is null)
    and exists(select 1 from access.membershiprole assignment join access.role adminrole on adminrole.id=assignment.role_id
      and adminrole.scope_id='tenant-zhudatuan' and adminrole.status='active'
      join access.rolepermission mapping on mapping.role_id=adminrole.id and mapping.effect='allow'
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      where assignment.membership_id=target.id and assignment.effective_at<=requested
        and (assignment.expires_at is null or assignment.expires_at>requested+interval '7 days')
        and adminrole.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator'))
    and not exists(select 1 from access.membershiprole denied_assignment
      join access.role denied_role on denied_role.id=denied_assignment.role_id and denied_role.status='active'
      join access.rolepermission denied_mapping on denied_mapping.role_id=denied_role.id and denied_mapping.effect='deny'
      join access.permission denied_permission on denied_permission.id=denied_mapping.permission_id
        and denied_permission.status='active'
      where denied_assignment.membership_id=target.id and denied_assignment.effective_at<=requested
        and (denied_assignment.expires_at is null or denied_assignment.expires_at>requested)
        and denied_permission.code in('access.center.read','identity.assurance.manage','identity.mobile.manage','access.ownership.accept'))
    and not exists(select 1 from access.membershipoverride denied_override
      join access.permission denied_permission on denied_permission.id=denied_override.permission_id
        and denied_permission.status='active'
      where denied_override.membership_id=target.id and denied_override.effect='deny'
        and denied_override.revoked_at is null and denied_override.effective_at<=requested
        and (denied_override.expires_at is null or denied_override.expires_at>requested)
        and denied_permission.code in('access.center.read','identity.assurance.manage','identity.mobile.manage','access.ownership.accept'))
  for update of target,profile,principal;
  if target_member is null then raise exception 'OWNER_TRANSFER_TARGET_INVALID'; end if;
  if proofrow.former_owner_mode='retain_admin' then
    if not exists(select 1 from access.role role where role.id=proofrow.former_owner_role_id
      and role.version=proofrow.former_owner_role_version and role.scope_id='tenant-zhudatuan' and role.status='active'
      and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
      and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=role.id and mapping.effect='allow' and permission.status='active'))
    then raise exception 'OWNER_TRANSFER_ROLE_INVALID'; end if;
  elsif proofrow.former_owner_role_id is not null or proofrow.former_owner_role_version is not null then
    raise exception 'OWNER_TRANSFER_ROLE_INVALID';
  end if;
  update access.owneractionproof set consumed_at=requested where nonce=p_nonce and consumed_at is null;
  if not found then raise exception 'ACTION_PROOF_INVALID'; end if;
  insert into access.ownertransfer(id,source_membership_id,target_membership_id,former_owner_mode,former_owner_role_id,
    former_owner_role_version,requested_by,requested_session,ownership_version,target_access_version,state,
    cooling_until,expires_at,requested_at,version)
  values(p_transfer,ownerrow.membership_id,proofrow.target_membership_id,proofrow.former_owner_mode,
    proofrow.former_owner_role_id,proofrow.former_owner_role_version,p_actor,p_session,ownerrow.version,
    p_target_access_version,'pending_acceptance',requested+interval '24 hours',requested+interval '7 days',requested,1);
  insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
  values(proofrow.target_membership_id,'role-platform-owner-successor-v1',requested,requested+interval '7 days',p_actor);
  update access.membership set access_version=access_version+1 where id=proofrow.target_membership_id;
  if exists(select required.operation_id from (values
      ('access.center.read'),('identity.password.verify'),('identity.mobile.manage'),('identity.mobile.challenge'),
      ('identity.stepup.start'),('identity.stepup.complete'),
      ('access.ownership.transfers.accept.preview'),('access.ownership.transfers.accept')) required(operation_id)
      except select operation_id from capability.membership_operations(proofrow.target_membership_id)) then
    raise exception 'OWNER_TRANSFER_TARGET_INVALID';
  end if;
  update identity.session set revoked_at=requested,revoked_reason='owner_transfer_requested'
    where membership_id=proofrow.target_membership_id and revoked_at is null;
  return jsonb_build_object(
    'id',p_transfer,'state','pending_acceptance','sourceMembership',ownerrow.membership_id,
    'targetMembership',proofrow.target_membership_id,'targetMember',target_member,'targetPrincipal',target_principal,
    'targetDisplayName',target_display_name,'formerOwnerMode',proofrow.former_owner_mode,
    'formerOwnerRole',proofrow.former_owner_role_id,'coolingUntil',requested+interval '24 hours',
    'expiresAt',requested+interval '7 days','version',1
  );
end
$function$;
revoke all on function access.create_owner_transfer(text,text,text,text,bigint,bigint) from public;
grant execute on function access.create_owner_transfer(text,text,text,text,bigint,bigint) to shopapp;

create or replace function access.commit_owner_transfer(
  p_transfer text,p_actor text,p_session text,p_nonce text,p_transfer_version bigint,p_ownership_version bigint,p_target_access_version bigint
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare
  transferrow access.ownertransfer%rowtype;
  ownerrow access.platformowner%rowtype;
  next_target_version bigint;
  target_member text;
  target_principal text;
  target_display_name text;
  transferred_at timestamptz:=clock_timestamp();
begin
  if current_setting('transaction_isolation')<>'serializable' then raise exception 'OWNER_TRANSFER_SERIALIZABLE_REQUIRED'; end if;
  if (session_user<>'shopapp' and coalesce(current_setting('role',true),'')<>'shopapp')
    or nullif(current_setting('app.actor_id',true),'')<>p_actor
    or nullif(current_setting('app.membership_id',true),'') is distinct from
      (select target_membership_id from access.ownertransfer where id=p_transfer) then raise exception 'OWNER_TRANSFER_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  select * into ownerrow from access.platformowner where singleton=true for update;
  select * into transferrow from access.ownertransfer where id=p_transfer for update;
  if transferrow.id is null or transferrow.state<>'pending_acceptance' or transferrow.version<>p_transfer_version
    or ownerrow.state<>'active' or ownerrow.membership_id<>transferrow.source_membership_id
    or ownerrow.version<>p_ownership_version then raise exception 'VERSION_CONFLICT'; end if;
  if transferrow.cooling_until>clock_timestamp() then raise exception 'OWNER_TRANSFER_COOLING_PERIOD'; end if;
  if transferrow.expires_at<=clock_timestamp() then raise exception 'OWNER_TRANSFER_NOT_PENDING'; end if;
  update access.owneractionproof proof set consumed_at=clock_timestamp()
  where proof.nonce=p_nonce and proof.action='accept' and proof.actor_id=p_actor and proof.session_id=p_session
    and proof.source_membership_id=transferrow.source_membership_id
    and proof.target_membership_id=transferrow.target_membership_id
    and proof.former_owner_mode=transferrow.former_owner_mode
    and proof.former_owner_role_id is not distinct from transferrow.former_owner_role_id
    and proof.former_owner_role_version is not distinct from transferrow.former_owner_role_version
    and proof.ownership_version=ownerrow.version and proof.transfer_version=transferrow.version
    and proof.target_access_version=p_target_access_version and proof.reason_hash is null
    and proof.consumed_at is null and proof.expires_at>clock_timestamp();
  if not found then raise exception 'ACTION_PROOF_INVALID'; end if;
  select profile.id,profile.principal_id,profile.display_name into target_member,target_principal,target_display_name
  from access.membership target join member.profile profile on profile.id=target.member_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where target.id=transferrow.target_membership_id and target.organization_id='tenant-zhudatuan'
      and target.client='operator' and target.status='active' and target.id!~'^membership:temp-'
      and target.access_version=p_target_access_version
      and profile.mobile_ciphertext is not null and profile.mobile_token is not null
      and exists(select 1 from access.membershiprole selfrole where selfrole.membership_id=target.id
        and selfrole.role_id='role:self' and selfrole.effective_at<=clock_timestamp() and selfrole.expires_at is null)
      and exists(select 1 from access.scopegrant selfscope where selfscope.membership_id=target.id
        and selfscope.scope_kind='self' and selfscope.scope_id='self:'||profile.principal_id and selfscope.effect='allow'
        and selfscope.effective_at<=clock_timestamp() and selfscope.expires_at is null)
      and exists(select 1 from access.membershiprole assignment join access.role role on role.id=assignment.role_id
        and role.scope_id='tenant-zhudatuan' and role.status='active'
        join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
        join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
        where assignment.membership_id=target.id and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
          and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator'))
      and not exists(select 1 from access.membershiprole denied_assignment
        join access.role denied_role on denied_role.id=denied_assignment.role_id and denied_role.status='active'
        join access.rolepermission denied_mapping on denied_mapping.role_id=denied_role.id and denied_mapping.effect='deny'
        join access.permission denied_permission on denied_permission.id=denied_mapping.permission_id
          and denied_permission.status='active'
        where denied_assignment.membership_id=target.id and denied_assignment.effective_at<=clock_timestamp()
          and (denied_assignment.expires_at is null or denied_assignment.expires_at>clock_timestamp())
          and denied_permission.code in('access.center.read','identity.assurance.manage','identity.mobile.manage','access.ownership.accept'))
      and not exists(select 1 from access.membershipoverride denied_override
        join access.permission denied_permission on denied_permission.id=denied_override.permission_id
          and denied_permission.status='active'
        where denied_override.membership_id=target.id and denied_override.effect='deny'
          and denied_override.revoked_at is null and denied_override.effective_at<=clock_timestamp()
          and (denied_override.expires_at is null or denied_override.expires_at>clock_timestamp())
          and denied_permission.code in('access.center.read','identity.assurance.manage','identity.mobile.manage','access.ownership.accept'))
  for update of target,profile,principal;
  if target_member is null then raise exception 'OWNER_TRANSFER_TARGET_INVALID'; end if;
  if target_principal<>p_actor then raise exception 'OWNER_TRANSFER_FORBIDDEN'; end if;
  if not exists(select 1 from identity.session session
      join access.membership membership on membership.id=session.membership_id and membership.status='active'
      join member.profile profile on profile.id=membership.member_id and profile.status='active'
      join identity.principal principal on principal.id=session.principal_id and principal.id=profile.principal_id
        and principal.status='active'
      where session.id=p_session and session.principal_id=p_actor
        and session.membership_id=transferrow.target_membership_id and session.client='operator'
        and session.assurance_level>=3 and session.credential_version=principal.credential_version
        and session.access_version=p_target_access_version and session.revoked_at is null
        and session.expires_at>clock_timestamp()
        and exists(select 1 from identity.assurance evidence where evidence.principal_id=session.principal_id
          and evidence.level>=3
          and evidence.evidence_hash=encode(public.digest(session.id::text,'sha256'),'hex')
          and evidence.verified_at>=clock_timestamp()-interval '15 minutes'
          and evidence.verified_at<=clock_timestamp()
          and evidence.expires_at is not null and evidence.expires_at>clock_timestamp()))
  then raise exception 'OWNER_TRANSFER_FORBIDDEN'; end if;
  if exists(select required.operation_id from (values
      ('access.center.read'),('identity.password.verify'),('identity.mobile.manage'),('identity.mobile.challenge'),
      ('identity.stepup.start'),('identity.stepup.complete'),
      ('access.ownership.transfers.accept.preview'),('access.ownership.transfers.accept')) required(operation_id)
      except select operation_id from capability.membership_operations(transferrow.target_membership_id)) then
    raise exception 'OWNER_TRANSFER_TARGET_INVALID';
  end if;
  update access.membershiprole set expires_at=transferred_at
    where membership_id=transferrow.source_membership_id and role_id<>'role:self'
      and (expires_at is null or expires_at>transferred_at);
  update access.membershiprole set expires_at=transferred_at
    where membership_id=transferrow.target_membership_id
      and (expires_at is null or expires_at>transferred_at);
  insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by) values
    (transferrow.target_membership_id,'role-platform-owner-v2',transferred_at,p_actor),
    (transferrow.target_membership_id,'role:self',transferred_at,p_actor);
  if transferrow.former_owner_mode='retain_admin' then
    insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
    select transferrow.source_membership_id,role.id,transferred_at,p_actor from access.role role
    where role.id=transferrow.former_owner_role_id and role.scope_id='tenant-zhudatuan' and role.status='active'
      and role.version=transferrow.former_owner_role_version
      and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
      and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=role.id and mapping.effect='allow' and permission.status='active');
    if not found then raise exception 'VERSION_CONFLICT'; end if;
  end if;
  update access.membershipoverride set revoked_at=transferred_at
    where membership_id in(transferrow.source_membership_id,transferrow.target_membership_id)
      and revoked_at is null and (expires_at is null or expires_at>transferred_at);
  update access.scopegrant set expires_at=transferred_at where membership_id=transferrow.source_membership_id
    and scope_kind='platform' and (expires_at is null or expires_at>transferred_at);
  if transferrow.former_owner_mode='remove_admin' then
    update access.scopegrant set expires_at=transferred_at where membership_id=transferrow.source_membership_id
      and scope_kind<>'self' and (expires_at is null or expires_at>transferred_at);
  end if;
  update access.scopegrant set expires_at=transferred_at where membership_id=transferrow.target_membership_id
    and (expires_at is null or expires_at>transferred_at);
  next_target_version:=p_target_access_version+1;
  insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
    ('scope:'||p_transfer||':platform',transferrow.target_membership_id,'platform','organization-platform-root','organization-platform-root','allow',transferred_at,next_target_version),
    ('scope:'||p_transfer||':tenant',transferrow.target_membership_id,'tenant','tenant-zhudatuan','tenant-zhudatuan','allow',transferred_at,next_target_version),
    ('scope:'||p_transfer||':self',transferrow.target_membership_id,'self','self:'||target_principal,'self:'||target_principal,'allow',transferred_at,next_target_version);
  update access.membership set access_version=access_version+1,
    status=case when id=transferrow.source_membership_id and transferrow.former_owner_mode='remove_admin'
      then 'suspended' else status end
  where id in(transferrow.source_membership_id,transferrow.target_membership_id);
  update access.scopegrant set access_version=next_target_version where membership_id=transferrow.target_membership_id
    and effective_at<=transferred_at and (expires_at is null or expires_at>transferred_at);
  update identity.session set revoked_at=transferred_at,revoked_reason=case when membership_id=transferrow.source_membership_id
    then 'owner_transferred' else 'owner_acquired' end where membership_id in(transferrow.source_membership_id,transferrow.target_membership_id)
    and revoked_at is null;
  update access.ownertransfer set state='accepted',accepted_at=transferred_at,accepted_by=p_actor,accepted_session=p_session,
    version=version+1 where id=p_transfer;
  update access.platformowner set membership_id=transferrow.target_membership_id,version=version+1,updated_at=transferred_at
    where singleton=true;
  return jsonb_build_object(
    'id',transferrow.id,'state','accepted','sourceMembership',transferrow.source_membership_id,
    'targetMembership',transferrow.target_membership_id,'targetMember',target_member,
    'targetPrincipal',target_principal,'targetDisplayName',target_display_name,
    'formerOwnerMode',transferrow.former_owner_mode,'formerOwnerRole',transferrow.former_owner_role_id,
    'coolingUntil',transferrow.cooling_until,'expiresAt',transferrow.expires_at,
    'version',transferrow.version+1,'ownershipVersion',ownerrow.version+1
  );
end
$function$;
revoke all on function access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint) from public;
grant execute on function access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint) to shopapp;

create or replace function access.cancel_owner_transfer(
  p_transfer text,p_actor text,p_session text,p_nonce text,p_transfer_version bigint,p_ownership_version bigint,
  p_target_access_version bigint,p_reason text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare
  transferrow access.ownertransfer%rowtype;
  ownerrow access.platformowner%rowtype;
  target_member text;
  target_principal text;
  target_display_name text;
  cancelled timestamptz:=clock_timestamp();
begin
  if current_setting('transaction_isolation')<>'serializable' then raise exception 'OWNER_TRANSFER_SERIALIZABLE_REQUIRED'; end if;
  if (session_user<>'shopapp' and coalesce(current_setting('role',true),'')<>'shopapp')
    or nullif(current_setting('app.actor_id',true),'')<>p_actor then raise exception 'OWNER_TRANSFER_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  perform access.expire_owner_transfers();
  select * into ownerrow from access.platformowner where singleton=true for update;
  select * into transferrow from access.ownertransfer where id=p_transfer for update;
  if transferrow.id is null or transferrow.state<>'pending_acceptance' or transferrow.version<>p_transfer_version
    or ownerrow.state<>'active' or ownerrow.membership_id<>transferrow.source_membership_id
    or ownerrow.version<>p_ownership_version or transferrow.target_access_version>=p_target_access_version
    or nullif(current_setting('app.membership_id',true),'')<>transferrow.source_membership_id
  then raise exception 'VERSION_CONFLICT'; end if;
  if not exists(select 1 from access.membership source
      join member.profile profile on profile.id=source.member_id and profile.status='active'
      join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
      where source.id=ownerrow.membership_id and profile.principal_id=p_actor
        and source.organization_id='tenant-zhudatuan' and source.client='operator' and source.status='active'
        and profile.mobile_ciphertext is not null and profile.mobile_token is not null) then
    raise exception 'OWNER_TRANSFER_FORBIDDEN';
  end if;
  if not exists(select 1 from identity.session session
      join access.membership membership on membership.id=session.membership_id and membership.status='active'
      join member.profile profile on profile.id=membership.member_id and profile.status='active'
      join identity.principal principal on principal.id=session.principal_id and principal.id=profile.principal_id
        and principal.status='active'
      where session.id=p_session and session.principal_id=p_actor and session.membership_id=ownerrow.membership_id
        and session.client='operator' and session.assurance_level>=3
        and session.credential_version=principal.credential_version
        and session.access_version=membership.access_version
        and session.revoked_at is null and session.expires_at>clock_timestamp()
        and exists(select 1 from identity.assurance evidence where evidence.principal_id=session.principal_id
          and evidence.level>=3
          and evidence.evidence_hash=encode(public.digest(session.id::text,'sha256'),'hex')
          and evidence.verified_at>=clock_timestamp()-interval '15 minutes'
          and evidence.verified_at<=clock_timestamp()
          and evidence.expires_at is not null and evidence.expires_at>clock_timestamp())) then
    raise exception 'OWNER_TRANSFER_FORBIDDEN';
  end if;
  select profile.id,profile.principal_id,profile.display_name into target_member,target_principal,target_display_name
  from access.membership target join member.profile profile on profile.id=target.member_id
  where target.id=transferrow.target_membership_id and target.access_version=p_target_access_version for update of target,profile;
  if target_member is null then raise exception 'VERSION_CONFLICT'; end if;
  update access.owneractionproof proof set consumed_at=cancelled
  where proof.nonce=p_nonce and proof.action='cancel' and proof.actor_id=p_actor and proof.session_id=p_session
    and proof.source_membership_id=transferrow.source_membership_id
    and proof.target_membership_id=transferrow.target_membership_id
    and proof.former_owner_mode=transferrow.former_owner_mode
    and proof.former_owner_role_id is not distinct from transferrow.former_owner_role_id
    and proof.former_owner_role_version is not distinct from transferrow.former_owner_role_version
    and proof.ownership_version=ownerrow.version and proof.transfer_version=transferrow.version
    and proof.target_access_version=p_target_access_version
    and proof.reason_hash=encode(public.digest(p_reason,'sha256'),'hex')
    and proof.consumed_at is null and proof.expires_at>cancelled;
  if not found then raise exception 'ACTION_PROOF_INVALID'; end if;
  update access.ownertransfer set state='cancelled',cancelled_at=cancelled,cancelled_by=p_actor,cancel_reason=p_reason,
    version=version+1 where id=p_transfer;
  update access.membershiprole set expires_at=cancelled where membership_id=transferrow.target_membership_id
    and role_id='role-platform-owner-successor-v1' and effective_at<=cancelled
    and (expires_at is null or expires_at>cancelled);
  update access.membership set access_version=access_version+1 where id=transferrow.target_membership_id;
  update identity.session set revoked_at=cancelled,revoked_reason='owner_transfer_cancelled'
    where membership_id=transferrow.target_membership_id and revoked_at is null;
  return jsonb_build_object(
    'id',transferrow.id,'state','cancelled','sourceMembership',transferrow.source_membership_id,
    'targetMembership',transferrow.target_membership_id,'targetMember',target_member,'targetPrincipal',target_principal,
    'targetDisplayName',target_display_name,'formerOwnerMode',transferrow.former_owner_mode,
    'formerOwnerRole',transferrow.former_owner_role_id,'coolingUntil',transferrow.cooling_until,
    'expiresAt',transferrow.expires_at,'version',transferrow.version+1
  );
end
$function$;
revoke all on function access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text) from public;
grant execute on function access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text) to shopapp;

-- Preserve the deployed systemd bootstrap command.  The legacy body is reachable only through
-- this wrapper while the singleton is bootstrap_pending; after activation or transfer, replay
-- verifies the dynamic Owner and can never recreate the fixed bootstrap identity.
alter function deployment.bootstrap_zhudatuan_owner(text,text,text,text,text)
  rename to bootstrap_zhudatuan_owner_legacy_v1;
revoke all on function deployment.bootstrap_zhudatuan_owner_legacy_v1(text,text,text,text,text)
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;

create function deployment.bootstrap_zhudatuan_owner(
  p_sentinel text,p_subject_hash text,p_secret_hash text,p_password_fingerprint text,p_actor text
)
returns text language plpgsql security definer
set search_path=pg_catalog,pg_temp set row_security=off as $function$
declare
  ownerrow access.platformowner%rowtype;
  legacy_state text;
  owner_membership text;
  owner_member text;
  owner_principal text;
  owner_access_version bigint;
  active_owner_count integer;
  rehydrate_legacy_tombstone boolean:=false;
  activated_at timestamptz;
  previous_hash text;
  before_hash text;
  after_hash text;
  audit_record_hash text;
begin
  if (session_user<>'zhudatuanbootstrap'
      and coalesce(current_setting('role',true),'')<>'zhudatuanbootstrap')
    or current_database()<>'zhudatuan_registration'
    or not deployment.registration_bootstrap_boundary(p_sentinel)
    or p_subject_hash!~'^[a-f0-9]{64}$'
    or p_password_fingerprint!~'^[a-f0-9]{64}$'
    or p_secret_hash!~'^scrypt\$v1\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$'
    or p_actor!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$'
  then raise exception 'OWNER_BOOTSTRAP_INPUT_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap:v1'));
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  select * into ownerrow from access.platformowner where singleton=true for update;
  if ownerrow.singleton is null then raise exception 'OWNER_BOOTSTRAP_SINGLETON_MISSING'; end if;

  select count(*)::integer into active_owner_count from access.membershiprole assignment
  where assignment.role_id='role-platform-owner-v2'
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp());

  if ownerrow.state='active' then
    select membership.id,profile.principal_id,membership.access_version
    into owner_membership,owner_principal,owner_access_version
    from access.membership membership
    join member.profile profile on profile.id=membership.member_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where membership.id=ownerrow.membership_id and membership.organization_id='tenant-zhudatuan'
      and membership.client='operator' and membership.status='active'
      and exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
        and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
        and assignment.expires_at is null)
      and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
        and grantrow.scope_kind='platform' and grantrow.scope_id='organization-platform-root'
        and grantrow.scope_path='organization-platform-root' and grantrow.effect='allow'
        and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
      and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
        and grantrow.scope_kind='tenant' and grantrow.scope_id='tenant-zhudatuan'
        and grantrow.scope_path='tenant-zhudatuan' and grantrow.effect='allow'
        and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
      and exists(select 1 from access.membershiprole selfrole where selfrole.membership_id=membership.id
        and selfrole.role_id='role:self' and selfrole.effective_at<=clock_timestamp() and selfrole.expires_at is null)
      and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
        and grantrow.scope_kind='self' and grantrow.scope_id='self:'||profile.principal_id
        and grantrow.scope_path='self:'||profile.principal_id and grantrow.effect='allow'
        and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
      and (select count(*) from access.membershiprole currentrole where currentrole.membership_id=membership.id
        and (currentrole.expires_at is null or currentrole.expires_at>clock_timestamp()))=2
      and (select count(*) from access.scopegrant currentscope where currentscope.membership_id=membership.id
        and (currentscope.expires_at is null or currentscope.expires_at>clock_timestamp()))=3
      and not exists(select 1 from access.membershipoverride activeoverride
        where activeoverride.membership_id=membership.id and activeoverride.revoked_at is null
          and (activeoverride.expires_at is null or activeoverride.expires_at>clock_timestamp()));
    if owner_membership is null or active_owner_count<>1 then raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE'; end if;
    return 'existing';
  end if;

  if ownerrow.state<>'bootstrap_pending' or active_owner_count<>0 then
    raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE';
  end if;
  if exists(select 1 from access.membership where id='membership-platform-owner-ethan-v1') then
    if exists(select 1 from identity.principal where id='principal:zhudatuan:owner:ethan:v1')
      or exists(select 1 from identity.credential where id='credential:password:zhudatuan-owner-ethan:v1')
      or exists(select 1 from member.profile where id='member:zhudatuan:owner:ethan:v1')
      or exists(select 1 from audit.record where id='audit:zhudatuan:owner-bootstrap:v1')
      or not exists(
        select 1 from access.membership membership
        join member.profile profile on profile.id=membership.member_id and profile.status='disabled'
        join identity.principal principal on principal.id=profile.principal_id and principal.status='disabled'
        where membership.id='membership-platform-owner-ethan-v1'
          and membership.organization_id='mall-demo' and membership.client='operator'
          and membership.status='suspended' and membership.joined_at is not null and membership.left_at is null
          and profile.mobile_ciphertext is null and profile.mobile_token is null
          and not exists(select 1 from access.membership sibling where sibling.member_id=membership.member_id
            and sibling.id<>membership.id and sibling.status in('active','invited'))
          and not exists(select 1 from access.membership sibling where sibling.member_id=membership.member_id
            and sibling.id<>membership.id and sibling.organization_id='tenant-zhudatuan' and sibling.client='operator')
          and (select count(*) from access.membershiprole assignment where assignment.membership_id=membership.id
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))=1
          and exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
            and assignment.role_id='role:self' and assignment.effective_at<=clock_timestamp()
            and assignment.expires_at is null)
          and exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
            and assignment.role_id='role-platform-owner-v2' and assignment.expires_at<=clock_timestamp())
          and (select count(*) from access.scopegrant grantrow where grantrow.membership_id=membership.id
            and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp()))=3
          and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
            and grantrow.scope_kind='platform' and grantrow.scope_id='organization-platform-root'
            and grantrow.scope_path='organization-platform-root' and grantrow.effect='allow'
            and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
            and grantrow.access_version>0 and grantrow.access_version<=membership.access_version)
          and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
            and grantrow.scope_kind='tenant' and grantrow.scope_id='tenant-smart-wing'
            and grantrow.scope_path='organization-platform-root/tenant-smart-wing' and grantrow.effect='allow'
            and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
            and grantrow.access_version>0 and grantrow.access_version<=membership.access_version)
          and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
            and grantrow.scope_kind='self' and grantrow.scope_id='self:'||profile.principal_id
            and grantrow.scope_path='self:'||profile.principal_id and grantrow.effect='allow'
            and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
            and grantrow.access_version>0 and grantrow.access_version<=membership.access_version)
          and not exists(select 1 from access.membershipoverride activeoverride
            where activeoverride.membership_id=membership.id and activeoverride.revoked_at is null
              and (activeoverride.expires_at is null or activeoverride.expires_at>clock_timestamp()))
          and not exists(select 1 from identity.credential credential where credential.principal_id=profile.principal_id
            and credential.status='active')
          and not exists(select 1 from identity.federatedidentity identityrow
            where identityrow.principal_id=profile.principal_id and identityrow.status='active')
          and not exists(select 1 from identity.session session where session.principal_id=profile.principal_id
            and session.revoked_at is null and session.expires_at>clock_timestamp())
          and not exists(select 1 from identity.challenge challenge where challenge.principal_id=profile.principal_id
            and challenge.consumed_at is null and challenge.expires_at>clock_timestamp())
          and not exists(select 1 from access.ownertransfer transfer
            where transfer.source_membership_id=membership.id or transfer.target_membership_id=membership.id)
      )
    then raise exception 'OWNER_BOOTSTRAP_CONFLICT'; end if;
    select membership.member_id,profile.principal_id,membership.access_version
    into owner_member,owner_principal,owner_access_version
    from access.membership membership
    join member.profile profile on profile.id=membership.member_id
    join identity.principal principal on principal.id=profile.principal_id
    where membership.id='membership-platform-owner-ethan-v1'
    for update of membership,profile,principal;
    if owner_member is null
      or exists(select 1 from identity.credential credential
        where credential.id='credential:password:zhudatuan-owner-ethan:v1'
          or (credential.provider='password' and credential.subject_hash=p_subject_hash))
    then raise exception 'OWNER_BOOTSTRAP_CONFLICT'; end if;

    -- Preserve the historical primary keys and rows. Only the exact disabled/suspended
    -- projection above can be rehydrated. A stale assurance is inert while its principal is
    -- disabled and has no live credential/session; expire it before re-enabling the identity.
    activated_at:=clock_timestamp();
    update identity.session set revoked_at=coalesce(revoked_at,activated_at),
      revoked_reason=coalesce(revoked_reason,'owner_legacy_rehydrated')
    where principal_id=owner_principal and revoked_at is null;
    update identity.challenge set consumed_at=coalesce(consumed_at,activated_at)
    where principal_id=owner_principal and consumed_at is null;
    update identity.assurance set expires_at=activated_at
    where principal_id=owner_principal and (expires_at is null or expires_at>activated_at);
    update identity.federatedidentity set status='revoked',revoked_at=coalesce(revoked_at,activated_at),
      updated_at=activated_at
    where principal_id=owner_principal and status='active';
    update identity.credential set status='revoked',rotated_at=coalesce(rotated_at,activated_at)
    where principal_id=owner_principal and status='active';
    update access.membershiprole set expires_at=activated_at
    where membership_id='membership-platform-owner-ethan-v1'
      and (expires_at is null or expires_at>activated_at);
    update access.scopegrant set expires_at=activated_at
    where membership_id='membership-platform-owner-ethan-v1'
      and (expires_at is null or expires_at>activated_at);
    update access.membershipoverride set revoked_at=activated_at
    where membership_id='membership-platform-owner-ethan-v1' and revoked_at is null
      and (expires_at is null or expires_at>activated_at);

    update identity.principal set status='active',credential_version=credential_version+1,
      updated_at=activated_at,version=version+1 where id=owner_principal and status='disabled';
    if not found then raise exception 'OWNER_BOOTSTRAP_CONFLICT'; end if;
    update member.profile set status='active',updated_at=activated_at,version=version+1
    where id=owner_member and principal_id=owner_principal and status='disabled';
    if not found then raise exception 'OWNER_BOOTSTRAP_CONFLICT'; end if;
    update access.membership set organization_id='tenant-zhudatuan',client='operator',status='active',
      access_version=access_version+1,left_at=null
    where id='membership-platform-owner-ethan-v1' and member_id=owner_member and status='suspended';
    if not found then raise exception 'OWNER_BOOTSTRAP_CONFLICT'; end if;
    owner_access_version:=owner_access_version+1;

    insert into identity.credential(
      id,principal_id,provider,subject_hash,subject_ciphertext,subject_key_version,secret_hash,encrypted_secret,
      status,rotated_at,created_at
    ) values('credential:password:zhudatuan-owner-ethan:v1',owner_principal,'password',p_subject_hash,
      null,null,p_secret_hash,null,'active',activated_at,activated_at);
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership-platform-owner-ethan-v1','role-platform-owner-v2',activated_at),
      ('membership-platform-owner-ethan-v1','role:self',activated_at);
    insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values
      ('scope:owner-legacy-rehydrate:v1:platform','membership-platform-owner-ethan-v1','platform',
        'organization-platform-root','organization-platform-root','allow',activated_at,owner_access_version),
      ('scope:owner-legacy-rehydrate:v1:tenant','membership-platform-owner-ethan-v1','tenant',
        'tenant-zhudatuan','tenant-zhudatuan','allow',activated_at,owner_access_version),
      ('scope:owner-legacy-rehydrate:v1:self','membership-platform-owner-ethan-v1','self',
        'self:'||owner_principal,'self:'||owner_principal,'allow',activated_at,owner_access_version);

    select record_hash into previous_hash from(
      select record_hash,recorded_at occurred_at from audit.record where scope_id='tenant-zhudatuan'
      union all select record_hash,accessed_at from audit.accessrecord where scope_id='tenant-zhudatuan'
      union all select last_record_hash,through_at from audit.archiveref where scope_id='tenant-zhudatuan'
    ) chain order by occurred_at desc limit 1;
    before_hash:=encode(public.digest(owner_principal||':disabled:membership-platform-owner-ethan-v1:suspended','sha256'),'hex');
    after_hash:=encode(public.digest(owner_principal||':'||p_subject_hash||':membership-platform-owner-ethan-v1:'
      ||p_password_fingerprint,'sha256'),'hex');
    audit_record_hash:=encode(public.digest('audit:zhudatuan:owner-bootstrap:v1:'||coalesce(previous_hash,'')
      ||':'||after_hash||':'||activated_at::text,'sha256'),'hex');
    insert into audit.record(
      id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
      previous_hash,record_hash,recorded_at
    ) values('audit:zhudatuan:owner-bootstrap:v1','tenant-zhudatuan',p_actor,'owner',
      'identity.owner.legacy_rehydrated','access.membership','membership-platform-owner-ethan-v1',before_hash,after_hash,
      jsonb_build_object('bootstrap','zhudatuan-owner-legacy-rehydrate-v1','principal',owner_principal,
        'membership','membership-platform-owner-ethan-v1','subjectFingerprint',p_subject_hash,
        'passwordFingerprint',p_password_fingerprint,'legacyPrimaryKeysPreserved',true,
        'legacyAliasReactivated',false,'plaintextSecretStored',false),
      'bootstrap:zhudatuan-owner-legacy-rehydrate-v1',previous_hash,audit_record_hash,activated_at);
    legacy_state:='created';
    rehydrate_legacy_tombstone:=true;
  else
    legacy_state:=deployment.bootstrap_zhudatuan_owner_legacy_v1(
      p_sentinel,p_subject_hash,p_secret_hash,p_password_fingerprint,p_actor);
  end if;

  select membership.id,profile.principal_id,membership.access_version
  into owner_membership,owner_principal,owner_access_version
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join access.membershiprole assignment on assignment.membership_id=membership.id
    and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
    and assignment.expires_at is null
  where membership.organization_id='tenant-zhudatuan' and membership.client='operator'
    and membership.status='active'
    and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
      and grantrow.scope_kind='platform' and grantrow.scope_id='organization-platform-root'
      and grantrow.effect='allow' and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
    and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
      and grantrow.scope_kind='tenant' and grantrow.scope_id='tenant-zhudatuan'
      and grantrow.effect='allow' and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null);
  if owner_membership is null or (select count(*) from access.membershiprole assignment
      where assignment.role_id='role-platform-owner-v2'
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))<>1
  then raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE'; end if;

  update access.membership set access_version=access_version+1 where id=owner_membership;
  update access.scopegrant set access_version=owner_access_version+1 where membership_id=owner_membership
    and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp());
  update identity.session set revoked_at=clock_timestamp(),revoked_reason='owner_bootstrapped'
    where membership_id=owner_membership and revoked_at is null;
  update access.platformowner set state='active',membership_id=owner_membership,
    version=ownerrow.version+1,initialized_at=clock_timestamp(),updated_at=clock_timestamp()
    where singleton=true and state='bootstrap_pending';
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values('event:owner-bootstrap:'||public.gen_random_uuid(),'access.owner.bootstrapped',1,'access',owner_membership,
    'tenant-zhudatuan',jsonb_build_object('actor',p_actor,'ownerMembership',owner_membership,
      'ownerPrincipal',owner_principal,'previousState','bootstrap_pending',
      'previousOwnershipVersion',ownerrow.version,'ownershipVersion',ownerrow.version+1,
      'legacyBootstrapState',legacy_state,'legacyTombstoneRehydrated',rehydrate_legacy_tombstone),
    'bootstrap:owner:'||owner_membership,clock_timestamp(),clock_timestamp());
  return legacy_state;
end
$function$;
revoke all on function deployment.bootstrap_zhudatuan_owner(text,text,text,text,text) from public;
grant usage on schema deployment to zhudatuanbootstrap;
grant execute on function deployment.bootstrap_zhudatuan_owner(text,text,text,text,text) to zhudatuanbootstrap;

-- The bootstrap process must discover the dynamic singleton before it decides whether the
-- one-time fixed Ethan secrets are needed.  Expose only the six values required for that
-- decision; the bootstrap role deliberately receives no direct catalogue-table reads.
create or replace function deployment.zhudatuan_owner_bootstrap_state(p_sentinel text)
returns table(
  state text,
  active_owner_count integer,
  principal_id text,
  membership_id text,
  current_owner_valid boolean,
  fixed_identity_collision boolean
)
language plpgsql
security definer
set search_path=pg_catalog,pg_temp
set row_security=off
as $function$
declare
  ownerrow access.platformowner%rowtype;
  owner_principal text;
  assignment_count integer;
  owner_is_valid boolean:=false;
  fixed_collision boolean:=false;
  recoverable_legacy_tombstone boolean:=false;
begin
  if session_user<>'zhudatuanbootstrap'
    or current_database()<>'zhudatuan_registration'
    or not deployment.registration_bootstrap_boundary(p_sentinel)
  then raise exception 'OWNER_BOOTSTRAP_BOUNDARY_INVALID'; end if;

  select * into ownerrow from access.platformowner where singleton=true;
  select count(distinct assignment.membership_id)::integer into assignment_count
  from access.membershiprole assignment
  where assignment.role_id='role-platform-owner-v2'
    and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp());

  if ownerrow.state='active' then
    select profile.principal_id into owner_principal
    from access.membership membership
    join member.profile profile on profile.id=membership.member_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where membership.id=ownerrow.membership_id
      and membership.organization_id='tenant-zhudatuan'
      and membership.client='operator'
      and membership.status='active';

    owner_is_valid:=owner_principal is not null
      and assignment_count=1
      and exists(select 1 from access.membershiprole assignment
        join access.role role on role.id=assignment.role_id and role.status='active'
        where assignment.membership_id=ownerrow.membership_id
          and assignment.role_id='role-platform-owner-v2'
          and assignment.effective_at<=clock_timestamp() and assignment.expires_at is null)
      and exists(select 1 from access.membershiprole assignment
        join access.role role on role.id=assignment.role_id and role.status='active'
        where assignment.membership_id=ownerrow.membership_id
          and assignment.role_id='role:self'
          and assignment.effective_at<=clock_timestamp() and assignment.expires_at is null)
      and (select count(*) from access.membershiprole assignment
        where assignment.membership_id=ownerrow.membership_id
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))=2
      and exists(select 1 from access.membership membership
        join access.scopegrant grantrow on grantrow.membership_id=membership.id
        where membership.id=ownerrow.membership_id
          and grantrow.scope_kind='platform'
          and grantrow.scope_id='organization-platform-root'
          and grantrow.scope_path='organization-platform-root'
          and grantrow.effect='allow'
          and grantrow.access_version>0 and grantrow.access_version<=membership.access_version
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
      and exists(select 1 from access.membership membership
        join access.scopegrant grantrow on grantrow.membership_id=membership.id
        where membership.id=ownerrow.membership_id
          and grantrow.scope_kind='tenant'
          and grantrow.scope_id='tenant-zhudatuan'
          and grantrow.scope_path='tenant-zhudatuan'
          and grantrow.effect='allow'
          and grantrow.access_version>0 and grantrow.access_version<=membership.access_version
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
      and exists(select 1 from access.membership membership
        join access.scopegrant grantrow on grantrow.membership_id=membership.id
        where membership.id=ownerrow.membership_id
          and grantrow.scope_kind='self'
          and grantrow.scope_id='self:'||owner_principal
          and grantrow.scope_path='self:'||owner_principal
          and grantrow.effect='allow'
          and grantrow.access_version>0 and grantrow.access_version<=membership.access_version
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
      and (select count(*) from access.scopegrant grantrow
        where grantrow.membership_id=ownerrow.membership_id
          and grantrow.effective_at<=clock_timestamp()
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp()))=3
      and not exists(select 1 from access.membershipoverride activeoverride
        where activeoverride.membership_id=ownerrow.membership_id
          and activeoverride.revoked_at is null
          and activeoverride.effective_at<=clock_timestamp()
          and (activeoverride.expires_at is null or activeoverride.expires_at>clock_timestamp()));
  elsif ownerrow.state='bootstrap_pending' then
    -- A disabled legacy principal may retain inert assurance evidence from the historical
    -- backfill. The wrapper expires it before re-enabling any authentication path.
    recoverable_legacy_tombstone:=exists(
      select 1 from access.membership membership
      join member.profile profile on profile.id=membership.member_id and profile.status='disabled'
      join identity.principal principal on principal.id=profile.principal_id and principal.status='disabled'
      where membership.id='membership-platform-owner-ethan-v1'
        and membership.organization_id='mall-demo' and membership.client='operator'
        and membership.status='suspended' and membership.joined_at is not null and membership.left_at is null
        and profile.mobile_ciphertext is null and profile.mobile_token is null
        and not exists(select 1 from access.membership sibling where sibling.member_id=membership.member_id
          and sibling.id<>membership.id and sibling.status in('active','invited'))
        and not exists(select 1 from access.membership sibling where sibling.member_id=membership.member_id
          and sibling.id<>membership.id and sibling.organization_id='tenant-zhudatuan' and sibling.client='operator')
        and (select count(*) from access.membershiprole assignment where assignment.membership_id=membership.id
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))=1
        and exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
          and assignment.role_id='role:self' and assignment.effective_at<=clock_timestamp()
          and assignment.expires_at is null)
        and exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
          and assignment.role_id='role-platform-owner-v2' and assignment.expires_at<=clock_timestamp())
        and (select count(*) from access.scopegrant grantrow where grantrow.membership_id=membership.id
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp()))=3
        and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
          and grantrow.scope_kind='platform' and grantrow.scope_id='organization-platform-root'
          and grantrow.scope_path='organization-platform-root' and grantrow.effect='allow'
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
          and grantrow.access_version>0 and grantrow.access_version<=membership.access_version)
        and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
          and grantrow.scope_kind='tenant' and grantrow.scope_id='tenant-smart-wing'
          and grantrow.scope_path='organization-platform-root/tenant-smart-wing' and grantrow.effect='allow'
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
          and grantrow.access_version>0 and grantrow.access_version<=membership.access_version)
        and exists(select 1 from access.scopegrant grantrow where grantrow.membership_id=membership.id
          and grantrow.scope_kind='self' and grantrow.scope_id='self:'||profile.principal_id
          and grantrow.scope_path='self:'||profile.principal_id and grantrow.effect='allow'
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
          and grantrow.access_version>0 and grantrow.access_version<=membership.access_version)
        and not exists(select 1 from access.membershipoverride activeoverride
          where activeoverride.membership_id=membership.id and activeoverride.revoked_at is null
            and (activeoverride.expires_at is null or activeoverride.expires_at>clock_timestamp()))
        and not exists(select 1 from identity.credential credential where credential.principal_id=profile.principal_id
          and credential.status='active')
        and not exists(select 1 from identity.federatedidentity identityrow
          where identityrow.principal_id=profile.principal_id and identityrow.status='active')
        and not exists(select 1 from identity.session session where session.principal_id=profile.principal_id
          and session.revoked_at is null and session.expires_at>clock_timestamp())
        and not exists(select 1 from identity.challenge challenge where challenge.principal_id=profile.principal_id
          and challenge.consumed_at is null and challenge.expires_at>clock_timestamp())
        and not exists(select 1 from access.ownertransfer transfer
          where transfer.source_membership_id=membership.id or transfer.target_membership_id=membership.id)
    )
      and not exists(select 1 from identity.principal where id='principal:zhudatuan:owner:ethan:v1')
      and not exists(select 1 from identity.credential where id='credential:password:zhudatuan-owner-ethan:v1')
      and not exists(select 1 from member.profile where id='member:zhudatuan:owner:ethan:v1')
      and not exists(select 1 from audit.record where id='audit:zhudatuan:owner-bootstrap:v1');
    fixed_collision:=exists(select 1 from identity.principal
        where id='principal:zhudatuan:owner:ethan:v1')
      or exists(select 1 from identity.credential
        where id='credential:password:zhudatuan-owner-ethan:v1')
      or exists(select 1 from member.profile
        where id='member:zhudatuan:owner:ethan:v1')
      or exists(select 1 from access.membership
        where id='membership-platform-owner-ethan-v1' and not recoverable_legacy_tombstone)
      or exists(select 1 from audit.record
        where id='audit:zhudatuan:owner-bootstrap:v1');
  end if;

  return query select
    coalesce(ownerrow.state,'absent'),
    assignment_count,
    case when ownerrow.state='active' then owner_principal else null end,
    case when ownerrow.state='active' then ownerrow.membership_id else null end,
    owner_is_valid,
    fixed_collision;
end
$function$;
revoke all on function deployment.zhudatuan_owner_bootstrap_state(text)
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,shopmigration;
grant execute on function deployment.zhudatuan_owner_bootstrap_state(text) to zhudatuanbootstrap;

-- Registration authorization is bound to the canonical identity subject HMAC.  The KMS mobile
-- token is an independent ciphertext lookup token and must never be treated as that HMAC.
create or replace function access.protect_zhudatuan_registration_access_write()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare
  candidate_membership access.membership%rowtype;
  candidate_principal text;
  candidate_subject_hash text;
  registration_allowed boolean := false;
begin
  if session_user<>'zhudatuanidentityapi'
    and coalesce(current_setting('role',true),'')<>'zhudatuanidentityapi'
  then return new; end if;

  if tg_table_name='membership' then
    candidate_membership := new;
  else
    select membership.* into candidate_membership
    from access.membership membership where membership.id=new.membership_id;
    if not found then raise exception 'ZHUDATUAN_REGISTRATION_MEMBERSHIP_REQUIRED'; end if;
  end if;

  select profile.principal_id,credential.subject_hash,
    exists(
      select 1 from member.invite invite
      where invite.status='active' and invite.max_uses=1 and invite.use_count=invite.max_uses
        and invite.accepted_at>=transaction_timestamp()
        and (
          (invite.target_client='storefront'
            and invite.role_id='role-zhudatuan-storefront-member'
            and invite.organization_id=candidate_membership.organization_id
            and candidate_membership.client='storefront')
          or (invite.target_client='operator'
            and invite.role_id='role-zhudatuan-pending-operator'
            and invite.organization_id='tenant-zhudatuan'
            and invite.storefront_organization_id='mall-zhudatuan'
            and invite.allowed_destination_hash=credential.subject_hash
            and (
              (candidate_membership.client='storefront'
                and candidate_membership.organization_id=invite.storefront_organization_id)
              or (candidate_membership.client='operator'
                and candidate_membership.organization_id=invite.organization_id)
            ))
        )
    ) and exists(
      select 1 from identity.challenge challenge
      where challenge.purpose='registration'
        and challenge.destination_hash=credential.subject_hash
        and challenge.consumed_at>=transaction_timestamp()
    ) into candidate_principal,candidate_subject_hash,registration_allowed
  from member.profile profile
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join identity.credential credential on credential.principal_id=principal.id
    and credential.provider='password' and credential.status='active'
    and credential.created_at>=transaction_timestamp()
  where profile.id=candidate_membership.member_id and profile.status='active'
    and profile.mobile_ciphertext is not null and profile.mobile_token is not null
    and profile.created_at>=transaction_timestamp();

  if candidate_subject_hash is null
    or candidate_membership.status<>'active' or candidate_membership.access_version<>1
    or candidate_membership.joined_at is null or candidate_membership.left_at is not null
    or candidate_membership.employee_no is not null or not coalesce(registration_allowed,false)
  then raise exception 'ZHUDATUAN_REGISTRATION_MEMBERSHIP_BOUNDARY_INVALID'; end if;

  if tg_table_name='membershiprole' then
    if new.expires_at is not null or new.delegated_by is not null
      or new.effective_at<transaction_timestamp()
      or not (
        new.role_id='role:self'
        or (candidate_membership.client='storefront'
          and candidate_membership.organization_id='mall-zhudatuan'
          and new.role_id='role-zhudatuan-storefront-member')
        or (candidate_membership.client='operator'
          and candidate_membership.organization_id='tenant-zhudatuan'
          and new.role_id='role-zhudatuan-pending-operator')
      )
    then raise exception 'ZHUDATUAN_REGISTRATION_ROLE_BOUNDARY_INVALID'; end if;
  elsif tg_table_name='scopegrant' then
    if new.effect<>'allow' or new.expires_at is not null or new.access_version<>1
      or new.effective_at<transaction_timestamp()
      or not (
        (candidate_membership.client='storefront' and (
          (new.scope_kind='mall' and new.scope_id='mall-zhudatuan' and new.scope_path='mall-zhudatuan')
          or (new.scope_kind='owner' and new.scope_id=candidate_membership.member_id
            and new.scope_path=candidate_membership.member_id)
          or (new.scope_kind='self' and new.scope_id='self:'||candidate_principal
            and new.scope_path='self:'||candidate_principal)
        ))
        or (candidate_membership.client='operator' and (
          (new.scope_kind='tenant' and new.scope_id='tenant-zhudatuan' and new.scope_path='tenant-zhudatuan')
          or (new.scope_kind='self' and new.scope_id='self:'||candidate_principal
            and new.scope_path='self:'||candidate_principal)
        ))
      )
    then raise exception 'ZHUDATUAN_REGISTRATION_SCOPE_BOUNDARY_INVALID'; end if;
  end if;
  return new;
end
$function$;
revoke all on function access.protect_zhudatuan_registration_access_write()
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi;

create or replace function access.protect_platform_owner_lifecycle()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
begin
  if tg_op='DELETE' or tg_op='INSERT' then raise exception 'PLATFORM_OWNER_LIFECYCLE_PROTECTED'; end if;
  if old.state='active' and (new.state<>'active' or new.membership_id is null) then
    raise exception 'PLATFORM_OWNER_LIFECYCLE_PROTECTED';
  end if;
  if old.state='bootstrap_pending' and new.state='active'
    and session_user<>'zhudatuanbootstrap'
    and coalesce(current_setting('role',true),'')<>'zhudatuanbootstrap' then
    raise exception 'PLATFORM_OWNER_LIFECYCLE_PROTECTED';
  end if;
  return new;
end
$function$;
revoke all on function access.protect_platform_owner_lifecycle()
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
create trigger platform_owner_lifecycle before insert or update or delete on access.platformowner
  for each row execute function access.protect_platform_owner_lifecycle();

create or replace function access.enforce_platform_owner_singleton()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare ownerrow access.platformowner%rowtype; owner_assignment_count integer;
begin
  if (select count(*) from access.platformowner)<>1 then raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE'; end if;
  select * into ownerrow from access.platformowner where singleton=true;
  select count(*)::integer into owner_assignment_count from access.membershiprole assignment
  where assignment.role_id='role-platform-owner-v2'
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp());
  if ownerrow.state='bootstrap_pending' then
    if ownerrow.membership_id is not null or owner_assignment_count<>0 then raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE'; end if;
  elsif owner_assignment_count<>1 or not exists(select 1 from access.membership membership
      join member.profile profile on profile.id=membership.member_id and profile.status='active'
      join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
      join access.membershiprole assignment on assignment.membership_id=membership.id
        and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
        and assignment.expires_at is null
      join access.role ownerrole on ownerrole.id=assignment.role_id and ownerrole.status='active'
      where membership.id=ownerrow.membership_id and membership.client='operator'
        and membership.status='active' and membership.organization_id='tenant-zhudatuan')
    or (select count(*) from access.membershiprole assignment
      where assignment.membership_id=ownerrow.membership_id
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))<>2
    or not exists(select 1 from access.membershiprole assignment
      join access.role selfrole on selfrole.id=assignment.role_id and selfrole.status='active'
      where assignment.membership_id=ownerrow.membership_id and assignment.role_id='role:self'
        and assignment.effective_at<=clock_timestamp() and assignment.expires_at is null)
    or exists(select 1 from access.membershiprole assignment
      where assignment.membership_id=ownerrow.membership_id
        and assignment.role_id not in('role-platform-owner-v2','role:self')
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
    or (select count(*) from access.scopegrant grantrow where grantrow.membership_id=ownerrow.membership_id
      and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp()))<>3
    or not exists(select 1 from access.membership membership join access.scopegrant grantrow
      on grantrow.membership_id=membership.id where membership.id=ownerrow.membership_id
      and grantrow.scope_kind='platform' and grantrow.scope_id='organization-platform-root'
      and grantrow.scope_path='organization-platform-root' and grantrow.effect='allow'
      and grantrow.access_version>0 and grantrow.access_version<=membership.access_version
      and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
    or not exists(select 1 from access.membership membership join access.scopegrant grantrow
      on grantrow.membership_id=membership.id where membership.id=ownerrow.membership_id
      and grantrow.scope_kind='tenant' and grantrow.scope_id='tenant-zhudatuan'
      and grantrow.scope_path='tenant-zhudatuan' and grantrow.effect='allow'
      and grantrow.access_version>0 and grantrow.access_version<=membership.access_version
      and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null)
    or (select count(*) from access.scopegrant grantrow where grantrow.membership_id=ownerrow.membership_id
      and grantrow.scope_kind='self'
      and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp()))<>1
    or not exists(select 1 from access.membership membership
      join member.profile profile on profile.id=membership.member_id
      join access.scopegrant grantrow on grantrow.membership_id=membership.id
        and grantrow.scope_kind='self' and grantrow.scope_id='self:'||profile.principal_id
        and grantrow.scope_path='self:'||profile.principal_id and grantrow.effect='allow'
        and grantrow.access_version>0 and grantrow.access_version<=membership.access_version
        and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
      where membership.id=ownerrow.membership_id)
    or exists(select 1 from access.membershipoverride overridepermission
      where overridepermission.membership_id=ownerrow.membership_id and overridepermission.revoked_at is null
        and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())) then
    raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE';
  end if;
  return null;
end
$function$;
revoke all on function access.enforce_platform_owner_singleton() from public;
create constraint trigger platform_owner_singleton_owner after insert or update or delete on access.platformowner
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_membership after insert or update or delete on access.membership
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_role after insert or update or delete on access.membershiprole
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_override after insert or update or delete on access.membershipoverride
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_role_definition after insert or update or delete on access.role
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_scope after insert or update or delete on access.scopegrant
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_profile after insert or update or delete on member.profile
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();
create constraint trigger platform_owner_singleton_principal after insert or update or delete on identity.principal
  deferrable initially deferred for each row execute function access.enforce_platform_owner_singleton();

insert into runtime.schemaversion(version,checksum)
values('20260829211000','8e5616553e7639467438029d37337593e5cc27be63a9460c69a7cda9916a0684');

set constraints all immediate;

do $assert$
begin
  if (select count(*) from access.platformowner)<>1 then raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE'; end if;
  if (select count(*) from runtime.operation where id like 'access.ownership.%')<>7
    or (select count(*) from capability.operation where operation_id like 'access.ownership.%' and audience='operator')<>7 then
    raise exception 'PLATFORM_OWNER_TRANSFER_CONTRACT_INVALID';
  end if;
  if not exists(select 1 from capability.operation operation join capability.entitlement entitlement
      on entitlement.capability_id=operation.capability_id and entitlement.scope_id='organization-platform-root'
      and entitlement.state='enabled' and entitlement.expires_at is null
      where operation.operation_id='identity.mobile.challenge' and operation.permission_code='identity.mobile.manage'
        and operation.audience='member')
    or not has_function_privilege('shopapp',
      'access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('shopapp',
      'identity.rotate_zhudatuan_owner_password(text,text,text,text,text)','EXECUTE') then
    raise exception 'PLATFORM_OWNER_MOBILE_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from access.resolve_scope(
    coalesce((select membership_id from access.platformowner where state='active'),
      (select id from access.membership where client='operator' and status='active' limit 1)),
    'access.ownership.read','organization-platform-root') resolved where resolved.scope->>'kind'='self')
    and exists(select 1 from access.membership where client='operator' and status='active') then
    raise exception 'PLATFORM_OWNER_TRANSFER_SCOPE_INVALID';
  end if;
  if (select count(*) from pg_trigger trigger
      where not trigger.tgisinternal
        and trigger.tgname in(
          'protect_zhudatuan_owner_role','protect_zhudatuan_owner_rolepermission',
          'protect_zhudatuan_owner_membership','protect_zhudatuan_owner_membershiprole',
          'protect_zhudatuan_owner_scopegrant','protect_zhudatuan_owner_membershipoverride',
          'protect_zhudatuan_owner_principal','protect_zhudatuan_owner_credential',
          'protect_zhudatuan_owner_profile')
        and trigger.tgfoid='access.protect_zhudatuan_owner()'::regprocedure)<>9 then
    raise exception 'PLATFORM_OWNER_PROTECTION_TRIGGER_DRIFT';
  end if;
end
$assert$;

commit;
