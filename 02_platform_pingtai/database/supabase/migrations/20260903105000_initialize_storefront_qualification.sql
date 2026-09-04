begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:initialize-storefront-qualification:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903104000'
        and checksum='ce6dddb4d15a527a16593a75b20dd57c985c8a5d424bc7c20a7d9b63ef232601')
    or exists(select 1 from runtime.schemaversion where version>'20260903104000') then
    raise exception 'STOREFRONT_QUALIFICATION_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create function access.initialize_storefront_qualification()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
begin
  if (session_user='zhudatuanidentityapi'
      or coalesce(current_setting('role',true),'')='zhudatuanidentityapi')
    and new.client='storefront' and new.status='active'
    and exists(select 1 from organization.organization mall
      where mall.id=new.organization_id and mall.kind='mall' and mall.status='active') then
    insert into qualification.profile(
      member_id,scope_id,city_code,city_name,attributes,status,version,updated_at
    ) values(
      new.member_id,new.organization_id,null,null,
      jsonb_build_object('source','phone_registration'),'active',1,clock_timestamp()
    ) on conflict(member_id) do nothing;
  end if;
  return new;
end
$function$;

revoke all on function access.initialize_storefront_qualification()
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi;

drop trigger if exists initialize_storefront_qualification on access.membership;
create trigger initialize_storefront_qualification
after insert on access.membership
for each row execute function access.initialize_storefront_qualification();

alter policy zhudatuanprovisioningapi on runtime.schemaversion
  using(version in('20260821032000','20260821054000','20260901223000','20260902012000',
    '20260903103000','20260903104000','20260903105000'));

insert into runtime.schemaversion(version,checksum)
values('20260903105000','382abadcefe08c037c15d34d56af7f85236368b199f382cfa71ac63f2bef77cf');

do $assert$
begin
  if to_regprocedure('access.initialize_storefront_qualification()') is null
    or has_function_privilege('public','access.initialize_storefront_qualification()','EXECUTE')
    or not exists(select 1 from pg_trigger trigger
      where trigger.tgrelid='access.membership'::regclass
        and trigger.tgname='initialize_storefront_qualification' and not trigger.tgisinternal) then
    raise exception 'STOREFRONT_QUALIFICATION_TRIGGER_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260903105000'
      and checksum='382abadcefe08c037c15d34d56af7f85236368b199f382cfa71ac63f2bef77cf') then
    raise exception 'STOREFRONT_QUALIFICATION_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
