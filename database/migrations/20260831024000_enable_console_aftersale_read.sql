begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831023000') then
    raise exception 'CONSOLE_AFTERSALE_READ_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831024000') then
    raise exception 'CONSOLE_AFTERSALE_READ_ALREADY_APPLIED';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831024000',0,0,0,0,
  'select id,state,version from ordering.aftersale order by id;',
  'select version,checksum from runtime.schemaversion where version=''20260831024000'';');
insert into runtime.schemaversion(version,checksum)
values('20260831024000','5b3a82f7b265f50817668da30b0e389627e1f941cfcba03e1737624fecbe81d8');

commit;
