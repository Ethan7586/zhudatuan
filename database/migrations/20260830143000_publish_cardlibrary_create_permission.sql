begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830142000') then
    raise exception 'CARD_LIBRARY_CREATE_PERMISSION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830143000') then
    raise exception 'CARD_LIBRARY_CREATE_PERMISSION_ALREADY_APPLIED';
  end if;
end $precondition$;

insert into access.permission(id,code,risk,status)
values('permission:561e88fabc8cf19995d5473b','voucher.cardlibrary.create','high','active')
on conflict(code) do update set risk=excluded.risk,status='active';

update capability.operation
set permission_code='voucher.cardlibrary.create'
where operation_id='voucher.cardlibraries.create'
  and capability_id='voucher.cardlibraries.create'
  and audience='console';

delete from access.rolepermission mapping
using access.permission permission
where mapping.role_id='role-platform-owner-v2'
  and mapping.permission_id=permission.id
  and permission.code='voucher.cardlibrary.create'
  and mapping.effect='deny';

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.code='voucher.cardlibrary.create' and permission.status='active'
on conflict do nothing;

update access.membership membership
set access_version=membership.access_version+1
where membership.status='active'
  and exists(select 1 from access.membershiprole assignment
    where assignment.membership_id=membership.id and assignment.role_id='role-platform-owner-v2'
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()));

update runtime.contractcatalog
set checksum='5d39c4f1e7fdddece8f24869c7a4038ef05611bf045425fd1f2622efb6f0d156',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830143000',1,1,0,0,
  'select operation_id,permission_code,audience from capability.operation where operation_id=''voucher.cardlibraries.create'';',
  'select scope_id,capability_id,state from capability.entitlement where capability_id=''voucher.cardlibraries.create'';');
insert into runtime.schemaversion(version,checksum)
values('20260830143000','5d39c4f1e7fdddece8f24869c7a4038ef05611bf045425fd1f2622efb6f0d156');

do $assert$ begin
  if not exists(select 1 from access.permission where code='voucher.cardlibrary.create' and risk='high' and status='active')
    or not exists(select 1 from capability.operation where operation_id='voucher.cardlibraries.create'
      and permission_code='voucher.cardlibrary.create' and audience='console')
    or not exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2' and permission.code='voucher.cardlibrary.create' and mapping.effect='allow')
    or not exists(select 1 from capability.entitlement entitlement where entitlement.scope_id='organization-platform-root'
      and entitlement.capability_id='voucher.cardlibraries.create' and entitlement.state='enabled') then
    raise exception 'CARD_LIBRARY_CREATE_PERMISSION_INVALID';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='5d39c4f1e7fdddece8f24869c7a4038ef05611bf045425fd1f2622efb6f0d156'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)) then
    raise exception 'CARD_LIBRARY_CREATE_PERMISSION_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
