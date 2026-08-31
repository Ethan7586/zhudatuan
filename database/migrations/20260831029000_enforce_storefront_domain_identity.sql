begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831028000') then
    raise exception 'STOREFRONT_DOMAIN_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831029000') then
    raise exception 'STOREFRONT_DOMAIN_ALREADY_APPLIED';
  end if;
  if exists(select 1 from experience.binding group by lower(domain) having count(*)>1) then
    raise exception 'STOREFRONT_DOMAIN_AMBIGUOUS';
  end if;
end $precondition$;

create unique index experience_binding_domain_unique on experience.binding(lower(domain));

select runtime.record_migration_evidence('20260831029000',0,0,0,0,
  'select application_id,lower(domain) domain,mall_id,pool_id from experience.binding order by lower(domain);',
  'select lower(domain),count(*) from experience.binding group by lower(domain) having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260831029000','9d25803290be248ccb3fbc10cd4abd3c5df31991c1c8023aff1abb60536bc203');

commit;
