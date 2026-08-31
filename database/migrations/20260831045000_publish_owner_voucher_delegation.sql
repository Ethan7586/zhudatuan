begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831044000') then
    raise exception 'OWNER_VOUCHER_DELEGATION_PUBLISH_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831045000') then
    raise exception 'OWNER_VOUCHER_DELEGATION_PUBLISH_ALREADY_APPLIED';
  end if;
  if exists(
    select 1 from access.role role
    where role.kind='owner' and role.status='active' and not exists(
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=role.id and mapping.effect='allow' and permission.code='voucher.redemption.read'
    )
  ) then
    raise exception 'OWNER_VOUCHER_DELEGATION_REPAIR_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831045000',1,1,0,0,
  'select role.id,role.version from access.role role where role.kind=''owner'' and role.status=''active'' order by role.id;',
  'select role.id,permission.code,mapping.effect from access.role role join access.rolepermission mapping on mapping.role_id=role.id join access.permission permission on permission.id=mapping.permission_id where role.kind=''owner'' and permission.code=''voucher.redemption.read'' order by role.id,mapping.effect;');

insert into runtime.schemaversion(version,checksum)
values('20260831045000',encode(public.digest('20260831045000_publish_owner_voucher_delegation','sha256'),'hex'));

commit;
