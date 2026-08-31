begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831025000') then
    raise exception 'CATALOG_PRODUCT_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831026000') then
    raise exception 'CATALOG_PRODUCT_CONTRACT_ALREADY_APPLIED';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831026000',0,0,0,0,
  'select id,scope_id,status,version from catalog.product order by id;',
  'select version,checksum from runtime.schemaversion where version=''20260831026000'';');
insert into runtime.schemaversion(version,checksum)
values('20260831026000','50b706efc6860de58d90c335bb23be10f03b081178035cbe7b729c80404f6119');

commit;
