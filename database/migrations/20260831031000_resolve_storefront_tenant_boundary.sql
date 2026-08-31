begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831030000') then
    raise exception 'STOREFRONT_TENANT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831031000') then
    raise exception 'STOREFRONT_TENANT_ALREADY_APPLIED';
  end if;
  if exists(select 1 from experience.application application join experience.binding binding on binding.application_id=application.id
    where application.status='active' and not exists(
    select 1 from organization.unitclosure closure join organization.organization tenant
      on tenant.id=closure.ancestor_id and tenant.kind='tenant'
    where closure.descendant_id=application.scope_id)) then
    raise exception 'STOREFRONT_APPLICATION_TENANT_MISSING';
  end if;
end $precondition$;

drop function experience.resolve_storefront_host(text);
create function experience.resolve_storefront_host(p_domain text)
returns table(application text,mall text,pool text,release text,version text,tenant text)
language sql stable security definer set search_path=experience,organization,pg_temp as $function$
  select application.id,binding.mall_id,binding.pool_id,release.id,version.id,tenant.id
  from experience.binding binding
  join experience.application application on application.id=binding.application_id and application.status='active'
  join lateral(select ancestor.id from organization.unitclosure closure
    join organization.organization ancestor on ancestor.id=closure.ancestor_id and ancestor.kind='tenant'
    where closure.descendant_id=application.scope_id order by closure.depth limit 1) tenant on true
  join lateral(select item.id,item.version_id from experience.release item where item.application_id=application.id
    and item.state='active' and item.effective_at<=clock_timestamp()
    order by item.effective_at desc,item.id desc limit 1) release on true
  join experience.version version on version.id=release.version_id and version.validation_state='valid'
  where lower(binding.domain)=lower(p_domain)
$function$;

revoke all on function experience.resolve_storefront_host(text) from public;
grant execute on function experience.resolve_storefront_host(text) to shopapp,shopjob;

select runtime.record_migration_evidence('20260831031000',0,0,0,0,
  'select application,mall,pool,release,version,tenant from experience.resolve_storefront_host(''127.0.0.1'');',
  'select application.id from experience.application application join experience.binding binding on binding.application_id=application.id where application.status=''active'' and not exists(select 1 from organization.unitclosure closure join organization.organization tenant on tenant.id=closure.ancestor_id and tenant.kind=''tenant'' where closure.descendant_id=application.scope_id);');
insert into runtime.schemaversion(version,checksum)
values('20260831031000','9d25803290be248ccb3fbc10cd4abd3c5df31991c1c8023aff1abb60536bc203');

commit;
