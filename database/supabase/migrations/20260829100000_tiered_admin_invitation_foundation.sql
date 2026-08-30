begin;

-- Existing invitations remain storefront invitations. New administrator
-- invitations explicitly target the operator client and carry the storefront
-- role needed by the second membership created in the same registration
-- transaction.
alter table member.invite
  add column target_client text not null default 'storefront',
  add column storefront_role_id text;

update member.invite set storefront_role_id=role_id where storefront_role_id is null;

alter table member.invite
  alter column storefront_role_id set not null,
  add constraint member_invite_target_client
    check(target_client in('storefront','operator')),
  add constraint member_invite_storefront_role
    foreign key(storefront_role_id) references access.role(id);

-- One zero-operation role is provisioned for every existing tenant. The role
-- id is tenant-qualified so later tenant provisioning can apply the same
-- template without sharing a mutable role across tenants.
insert into access.role(id,scope_id,name,status,version)
select 'role-console-pending-v1:'||tenant.id,tenant.id,'待授权管理员','active',0
from organization.organization tenant
where tenant.kind='tenant' and tenant.status='active'
on conflict(scope_id,name) do nothing;

-- Until tier=500 delegation is introduced, invitation creation is Root-only.
-- This closes the broad historical grant inherited from member.read.
delete from access.rolepermission mapping
using access.permission permission
where mapping.permission_id=permission.id
  and permission.code='identity.invitation.manage'
  and mapping.role_id<>'role-platform-owner-v2';

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.code='identity.invitation.manage'
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260829100000','8eec97261d45df52cce53455ce736ad701435a555416c59aa0ea66ed443ef82f');

do $assert$
begin
  if exists(
    select 1 from organization.organization tenant
    where tenant.kind='tenant' and tenant.status='active'
      and not exists(
        select 1 from access.role role
        where role.id='role-console-pending-v1:'||tenant.id
          and role.scope_id=tenant.id and role.name='待授权管理员'
          and role.status='active'
      )
  ) then raise exception 'CONSOLE_PENDING_ROLE_MISSING'; end if;

  if exists(
    select 1 from access.rolepermission mapping
    join access.role role on role.id=mapping.role_id
    where role.id like 'role-console-pending-v1:%'
  ) then raise exception 'CONSOLE_PENDING_ROLE_NOT_EMPTY'; end if;

  if not exists(
    select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2'
      and permission.code='identity.invitation.manage'
      and mapping.effect='allow'
  ) then raise exception 'ROOT_INVITATION_PERMISSION_MISSING'; end if;

  if exists(
    select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where permission.code='identity.invitation.manage'
      and mapping.effect='allow'
      and mapping.role_id<>'role-platform-owner-v2'
  ) then raise exception 'INVITATION_PERMISSION_OVERDELEGATED'; end if;

  if exists(select 1 from member.invite where storefront_role_id is null)
    or not exists(select 1 from runtime.schemaversion where version='20260829100000')
  then raise exception 'TIERED_ADMIN_INVITATION_MIGRATION_INCOMPLETE'; end if;
end
$assert$;

commit;
