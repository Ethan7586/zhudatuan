begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831045000') then
    raise exception 'STOREFRONT_CSRF_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831046000') then
    raise exception 'STOREFRONT_CSRF_CONTRACT_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260831043000'
      and checksum='848ae95b92bde2a45498e83e442ed5832593d8571117324076517128c0fc01d0'
  ) then
    raise exception 'STOREFRONT_CSRF_CONTRACT_PREVIOUS_IDENTITY_INVALID';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='a9846680ce3534a98a0e2c44b2050a0b3bb2c1fba3413da8675e757a922ccb8d',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260831046000',1,1,0,0,
  'select version,checksum from runtime.schemaversion where version in(''20260831043000'',''20260831045000'') order by version;',
  'select artifact,version,checksum,operation_count,event_count from runtime.contractcatalog where artifact=''commerce'' and status=''active'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260831046000','a9846680ce3534a98a0e2c44b2050a0b3bb2c1fba3413da8675e757a922ccb8d');

do $assert$ begin
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260831046000'
      and checksum='a9846680ce3534a98a0e2c44b2050a0b3bb2c1fba3413da8675e757a922ccb8d'
  ) then
    raise exception 'STOREFRONT_CSRF_CONTRACT_HEAD_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='a9846680ce3534a98a0e2c44b2050a0b3bb2c1fba3413da8675e757a922ccb8d'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)
  ) then
    raise exception 'STOREFRONT_CSRF_CONTRACT_CATALOG_INVALID';
  end if;
end $assert$;

commit;
