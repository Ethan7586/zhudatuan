begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909015000') then
    raise exception 'IDENTITY_STOREFRONT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909016000') then
    raise exception 'IDENTITY_STOREFRONT_ALREADY_APPLIED';
  end if;
  if exists(
    select application.mall_id from experience.application application
    where application.status='active' and application.is_primary
    group by application.mall_id having count(*)>1
  ) then raise exception 'IDENTITY_STOREFRONT_PRIMARY_AMBIGUOUS'; end if;
end
$precondition$;

create function experience.identity_storefront(p_organization text)
returns table(handle text)
language sql stable security definer
set search_path=experience,pg_temp
as $function$
  select application.public_slug
  from experience.application application
  where application.mall_id=p_organization and application.status='active' and application.is_primary
  order by application.id
  limit 1
$function$;

alter function experience.identity_storefront(text) owner to shopexperienceowner;
revoke all on function experience.identity_storefront(text) from public,anon,authenticated,service_role;
grant execute on function experience.identity_storefront(text) to shopapp;

select runtime.record_migration_evidence(
  '20260909016000',
  (select count(*) from access.membership where status='active' and client='storefront'),
  (select count(*) from access.membership membership where membership.status='active' and membership.client='storefront'
    and exists(select 1 from experience.identity_storefront(membership.organization_id))),
  0,0,
  'select membership.id,membership.organization_id,storefront.handle from access.membership membership cross join lateral experience.identity_storefront(membership.organization_id) storefront where membership.status=''active'' and membership.client=''storefront'' order by membership.id;',
  'select application.mall_id,application.id,application.public_slug from experience.application application where application.status=''active'' and application.is_primary order by application.mall_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909016000',encode(public.digest('20260909016000_publish_identity_storefront','sha256'),'hex'));
update runtime.schemahead set
  migration_head='20260909016000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:experience',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if to_regprocedure('experience.identity_storefront(text)') is null then
    raise exception 'IDENTITY_STOREFRONT_FUNCTION_MISSING';
  end if;
  if not has_function_privilege('shopapp','experience.identity_storefront(text)','EXECUTE')
    or has_function_privilege('anon','experience.identity_storefront(text)','EXECUTE')
    or has_function_privilege('authenticated','experience.identity_storefront(text)','EXECUTE')
    or has_function_privilege('service_role','experience.identity_storefront(text)','EXECUTE') then
    raise exception 'IDENTITY_STOREFRONT_PRIVILEGE_INVALID';
  end if;
  if not exists(
    select 1 from pg_proc procedure join pg_roles owner on owner.oid=procedure.proowner
    where procedure.oid='experience.identity_storefront(text)'::regprocedure
      and procedure.prosecdef and owner.rolname='shopexperienceowner'
  ) or pg_get_functiondef('experience.identity_storefront(text)'::regprocedure) not like '%application.is_primary%' then
    raise exception 'IDENTITY_STOREFRONT_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260909016000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'IDENTITY_STOREFRONT_SCHEMA_HEAD_INVALID';
  end if;
end
$assert$;

commit;
