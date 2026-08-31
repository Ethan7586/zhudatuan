begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260831018000') then
    raise exception 'CATALOG_PRODUCT_READ_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831019000') then
    raise exception 'CATALOG_PRODUCT_READ_ALREADY_APPLIED';
  end if;
end
$precondition$;

insert into access.permission(id,code,risk,status)
values('permission:3002915032d0a97ce28b1e3d','catalog.product.read','low','active')
on conflict(code) do update set risk=excluded.risk,status='active';

insert into access.rolepermission(role_id,permission_id,effect)
select distinct mapping.role_id,'permission:3002915032d0a97ce28b1e3d','allow'
from access.rolepermission mapping
join access.permission managed on managed.id=mapping.permission_id
where managed.code='catalog.product.manage' and mapping.effect='allow'
on conflict do nothing;

select runtime.record_migration_evidence(
  '20260831019000',1,1,0,0,
  'select code,status from access.permission where code=''catalog.product.read'';',
  'select version,checksum from runtime.schemaversion where version=''20260831019000'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260831019000','2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285');

do $assert$
begin
  if not exists(select 1 from access.permission where code='catalog.product.read' and risk='low' and status='active') then
    raise exception 'CATALOG_PRODUCT_READ_PERMISSION_MISSING';
  end if;
  if exists(
    select 1 from capability.operation operation
    left join access.permission permission on permission.code=operation.permission_code
    where operation.permission_code is not null and permission.code is null
  ) then
    raise exception 'CAPABILITY_OPERATION_PERMISSION_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260831019000'
    and checksum='2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285') then
    raise exception 'CATALOG_PRODUCT_READ_HEAD_MISSING';
  end if;
end
$assert$;

commit;
