begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830134000') then
    raise exception 'INVITATION_DELEGATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830135000') then
    raise exception 'INVITATION_DELEGATION_ALREADY_APPLIED';
  end if;
  if exists(
    select 1 from capability.operation where permission_code in(
      'catalog.read','credential.password.change.self','credential.phone.change.self','profile.read.self',
      'profile.update.self','session.read.self','session.revoke.self')
  ) then raise exception 'INVITATION_LEGACY_PERMISSION_STILL_REFERENCED'; end if;
end $precondition$;

create temporary table affected_invitation_role on commit drop as
select distinct role.id
from access.role role
left join access.rolepermission mapping on mapping.role_id=role.id
left join access.permission permission on permission.id=mapping.permission_id
where role.kind='owner' and role.status='active'
   or permission.code in(
     'catalog.read','credential.password.change.self','credential.phone.change.self','profile.read.self',
     'profile.update.self','session.read.self','session.revoke.self');

insert into access.permission(id,code,risk,status) values
  ('permission:f9add8c972e54afee52d4fee','access.membership.activate','critical','active'),
  ('permission:0f363cc4aecc2765baa10ab0','access.role.delegate','critical','active'),
  ('permission:6dd865f2a5499bb2ad2084b4','access.scope.delegate','critical','active'),
  ('permission:8a7698fe283a55fe4c9c8cf9','identity.invitation.audit','high','active')
on conflict(code) do update set risk=excluded.risk,status='active';

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow'
from access.role role
cross join access.permission permission
where role.kind='owner' and role.status='active'
  and permission.code in('access.role.delegate','access.scope.delegate','identity.invitation.audit')
on conflict do nothing;

delete from access.rolepermission mapping
using access.permission permission
where mapping.permission_id=permission.id and permission.code in(
  'catalog.read','credential.password.change.self','credential.phone.change.self','profile.read.self',
  'profile.update.self','session.read.self','session.revoke.self');
delete from access.permission where code in(
  'catalog.read','credential.password.change.self','credential.phone.change.self','profile.read.self',
  'profile.update.self','session.read.self','session.revoke.self');

update access.role role set version=role.version+1
where role.id in(select id from affected_invitation_role);

with changed as(
  update access.membership membership
  set access_version=membership.access_version+1
  where exists(
    select 1 from access.membershiprole assignment
    where assignment.membership_id=membership.id
      and assignment.role_id in(select id from affected_invitation_role))
  returning membership.id,membership.organization_id,membership.access_version
)
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
select 'event:'||gen_random_uuid(),'access.version.changed',1,'membership',changed.id,changed.organization_id,
  jsonb_build_object('membership',changed.id,'version',changed.access_version,'reason','invitationpermissionhardcut'),
  'migration:20260830135000',clock_timestamp(),clock_timestamp()
from changed;

select runtime.record_migration_evidence('20260830135000',11,11,0,0,
  'select code,risk,status from access.permission where code in(''access.role.delegate'',''access.scope.delegate'',''access.membership.activate'',''identity.invitation.audit'') order by code;',
  'select membership_id,payload from runtime.outbox where event_type=''access.version.changed'' and trace_id=''migration:20260830135000'' order by membership_id;');
insert into runtime.schemaversion(version,checksum)
values('20260830135000',encode(public.digest('20260830135000_hardcut_invitation_delegation_permissions','sha256'),'hex'));

do $assert$ begin
  if (select count(*) from access.permission where (code,risk,status) in(
    ('access.membership.activate','critical','active'),
    ('access.role.delegate','critical','active'),
    ('access.scope.delegate','critical','active'),
    ('identity.invitation.audit','high','active')))<>4 then
    raise exception 'INVITATION_DELEGATION_PERMISSION_INVALID';
  end if;
  if exists(select 1 from access.permission where code in(
    'catalog.read','credential.password.change.self','credential.phone.change.self','profile.read.self',
    'profile.update.self','session.read.self','session.revoke.self')) then
    raise exception 'INVITATION_LEGACY_DELEGATION_PERMISSION_REMAINS';
  end if;
  if exists(
    select required.code from(values('access.role.delegate'),('access.scope.delegate'),('identity.invitation.audit')) required(code)
    where not exists(
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow' and permission.code=required.code)
  ) then raise exception 'INVITATION_OWNER_DELEGATION_PERMISSION_MISSING'; end if;
end $assert$;

commit;
