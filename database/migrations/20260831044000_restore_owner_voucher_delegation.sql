begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831043000') then
    raise exception 'OWNER_VOUCHER_DELEGATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831044000') then
    raise exception 'OWNER_VOUCHER_DELEGATION_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from access.permission where code='voucher.redemption.read' and status='active') then
    raise exception 'OWNER_VOUCHER_DELEGATION_PERMISSION_MISSING';
  end if;
end $precondition$;

create temporary table changed_owner_role on commit drop as
select role.id from access.role role
where role.kind='owner' and role.status='active'
  and not exists(
    select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id=role.id and mapping.effect='allow' and permission.code='voucher.redemption.read'
  );

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow'
from changed_owner_role role
join access.permission permission on permission.code='voucher.redemption.read' and permission.status='active'
on conflict do nothing;

update access.role role set version=role.version+1
where role.id in(select id from changed_owner_role);

with changed as(
  update access.membership membership
  set access_version=membership.access_version+1
  where membership.status='active' and exists(
    select 1 from access.membershiprole assignment
    where assignment.membership_id=membership.id and assignment.role_id in(select id from changed_owner_role)
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  )
  returning membership.id,membership.organization_id,membership.access_version
)
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
select 'event:'||gen_random_uuid(),'access.version.changed',1,'membership',changed.id,changed.organization_id,
  jsonb_build_object('membership',changed.id,'version',changed.access_version,'reason','ownervoucherdelegation'),
  'migration:20260831044000',clock_timestamp(),clock_timestamp()
from changed;

select runtime.record_migration_evidence('20260831044000',1,1,0,0,
  'select role.id,role.version from access.role role where role.kind=''owner'' and role.status=''active'' order by role.id;',
  'select membership_id,payload from runtime.outbox where event_type=''access.version.changed'' and trace_id=''migration:20260831044000'' order by membership_id;');

insert into runtime.schemaversion(version,checksum)
values('20260831044000',encode(public.digest('20260831044000_restore_owner_voucher_delegation','sha256'),'hex'));

do $assert$ begin
  if exists(
    select 1 from access.role role
    where role.kind='owner' and role.status='active' and not exists(
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=role.id and mapping.effect='allow' and permission.code='voucher.redemption.read'
    )
  ) then
    raise exception 'OWNER_VOUCHER_DELEGATION_GRANT_MISSING';
  end if;
end $assert$;

commit;
