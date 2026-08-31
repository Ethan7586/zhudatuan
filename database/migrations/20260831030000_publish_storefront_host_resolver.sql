begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831029000') then
    raise exception 'STOREFRONT_HOST_RESOLVER_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831030000') then
    raise exception 'STOREFRONT_HOST_RESOLVER_ALREADY_APPLIED';
  end if;
end $precondition$;

create or replace function experience.resolve_storefront_host(p_domain text)
returns table(application text,mall text,pool text,release text,version text,scope text)
language sql stable security definer set search_path=experience,pg_temp as $function$
  select application.id,binding.mall_id,binding.pool_id,release.id,version.id,application.scope_id
  from experience.binding binding
  join experience.application application on application.id=binding.application_id and application.status='active'
  join lateral(select item.id,item.version_id from experience.release item where item.application_id=application.id
    and item.state='active' and item.effective_at<=clock_timestamp()
    order by item.effective_at desc,item.id desc limit 1) release on true
  join experience.version version on version.id=release.version_id and version.validation_state='valid'
  where lower(binding.domain)=lower(p_domain)
$function$;

revoke all on function experience.resolve_storefront_host(text) from public;
grant execute on function experience.resolve_storefront_host(text) to shopapp,shopjob;

select runtime.record_migration_evidence('20260831030000',0,0,0,0,
  'select application,mall,pool,release,version,scope from experience.resolve_storefront_host(''127.0.0.1'');',
  'select lower(domain),count(*) from experience.binding group by lower(domain) having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260831030000','9d25803290be248ccb3fbc10cd4abd3c5df31991c1c8023aff1abb60536bc203');

commit;
