begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831031000') then
    raise exception 'STOREFRONT_BINDING_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831032000') then
    raise exception 'STOREFRONT_BINDING_CONTRACT_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from runtime.operation where id='storefront.bootstrap.read' and contract_version='3.0.0') then
    raise exception 'STOREFRONT_BOOTSTRAP_OPERATION_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831032000',0,0,0,0,
  'select id,contract_version from runtime.operation where id in(''storefront.bootstrap.read'',''storefront.catalog.read'') order by id;',
  'select id from runtime.operation where id in(''storefront.bootstrap.read'',''storefront.catalog.read'') and contract_version<>''3.0.0'';');
insert into runtime.schemaversion(version,checksum)
values('20260831032000','5966b2bc05de9e5c4d461d49493d2c7f4e2db8f25fb0fda7829890b53b61215c');

commit;
