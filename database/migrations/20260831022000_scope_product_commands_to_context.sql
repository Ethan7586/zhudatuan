begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831021000') then
    raise exception 'PRODUCT_COMMAND_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831022000') then
    raise exception 'PRODUCT_COMMAND_SCOPE_ALREADY_APPLIED';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831022000',1,1,0,0,
  'select operation_id,permission_code,audience from capability.operation where operation_id in (''catalog.products.update'',''catalog.products.archive'');',
  'select version,checksum from runtime.schemaversion where version=''20260831022000'';');

insert into runtime.schemaversion(version,checksum)
values('20260831022000','3d12c1e458331aec341ae37f0ace2bf6461b253a71d5c87ff01da3c2385483af');

do $assert$ begin
  if (select count(*) from capability.operation
      where operation_id in('catalog.products.update','catalog.products.archive')
        and permission_code='catalog.product.manage' and audience='console')<>2 then
    raise exception 'PRODUCT_COMMAND_AUTHORITY_INVALID';
  end if;
end $assert$;

commit;
