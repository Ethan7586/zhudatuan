begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830133000') then
    raise exception 'INVITATION_PERMISSION_SPLIT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830134000') then
    raise exception 'INVITATION_PERMISSION_SPLIT_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from access.permission where code='identity.invitation.manage') then
    raise exception 'INVITATION_LEGACY_PERMISSION_MISSING';
  end if;
end $precondition$;

insert into access.permission(id,code,risk,status) values
  ('permission:f4fdc6f978bdc660ad0950c4','identity.invitation.issue','critical','active'),
  ('permission:604198843876a9d459f41ec9','identity.invitation.read','elevated','active'),
  ('permission:98178eafb2c153e0ade5d989','identity.invitation.revoke','high','active')
on conflict(code) do update set risk=excluded.risk,status='active';

insert into access.rolepermission(role_id,permission_id,effect)
select legacy.role_id,replacement.id,legacy.effect
from access.rolepermission legacy
join access.permission permission on permission.id=legacy.permission_id and permission.code='identity.invitation.manage'
cross join access.permission replacement
where replacement.code in('identity.invitation.issue','identity.invitation.read','identity.invitation.revoke')
on conflict do nothing;

update capability.operation
set permission_code=case operation_id
  when 'identity.invitations.create' then 'identity.invitation.issue'
  when 'identity.invitations.read' then 'identity.invitation.read'
  when 'identity.invitations.revoke' then 'identity.invitation.revoke'
end,
audience='console'
where operation_id in('identity.invitations.create','identity.invitations.read','identity.invitations.revoke');

update access.role role
set version=role.version+1
where exists(
  select 1 from access.rolepermission mapping
  join access.permission permission on permission.id=mapping.permission_id
  where mapping.role_id=role.id
    and permission.code in('identity.invitation.issue','identity.invitation.read','identity.invitation.revoke')
);

update access.membership membership
set access_version=membership.access_version+1
where exists(
  select 1 from access.membershiprole assignment
  join access.rolepermission mapping on mapping.role_id=assignment.role_id
  join access.permission permission on permission.id=mapping.permission_id
  where assignment.membership_id=membership.id
    and permission.code in('identity.invitation.issue','identity.invitation.read','identity.invitation.revoke')
);

delete from access.rolepermission
where permission_id=(select id from access.permission where code='identity.invitation.manage');
delete from access.permission where code='identity.invitation.manage';

select runtime.record_migration_evidence('20260830134000',3,3,0,0,
  'select operation_id,permission_code,audience from capability.operation where operation_id like ''identity.invitations.%'' order by operation_id;',
  'select role.id,permission.code,mapping.effect from access.role role join access.rolepermission mapping on mapping.role_id=role.id join access.permission permission on permission.id=mapping.permission_id where permission.code like ''identity.invitation.%'' order by role.id,permission.code;');
insert into runtime.schemaversion(version,checksum)
values('20260830134000',encode(public.digest('20260830134000_split_invitation_permissions','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from access.permission where code='identity.invitation.manage') then
    raise exception 'INVITATION_LEGACY_PERMISSION_REMAINS';
  end if;
  if (select count(*) from access.permission
      where (code,risk,status) in(
        ('identity.invitation.issue','critical','active'),
        ('identity.invitation.read','elevated','active'),
        ('identity.invitation.revoke','high','active')))<>3 then
    raise exception 'INVITATION_SPLIT_PERMISSION_INVALID';
  end if;
  if exists(
    values
      ('identity.invitations.create','identity.invitation.issue'),
      ('identity.invitations.read','identity.invitation.read'),
      ('identity.invitations.revoke','identity.invitation.revoke')
    except
    select operation_id,permission_code from capability.operation where audience='console'
  ) then
    raise exception 'INVITATION_OPERATION_PERMISSION_INVALID';
  end if;
  if exists(
    select required.code from(values
      ('identity.invitation.issue'),('identity.invitation.read'),('identity.invitation.revoke')) required(code)
    where not exists(
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow' and permission.code=required.code)
  ) then
    raise exception 'INVITATION_OWNER_PERMISSION_MISSING';
  end if;
end $assert$;

commit;
