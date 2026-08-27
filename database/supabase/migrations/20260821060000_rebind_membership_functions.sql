begin;

do $repair$
declare
  signature regprocedure;
  definition text;
begin
  foreach signature in array array[
    'identity.resolve_session(text)'::regprocedure,
    'access.resolve_membership(text)'::regprocedure,
    'access.membership_version(text)'::regprocedure,
    'access.resource_scope(text,text,text)'::regprocedure,
    'capability.membership_operations(text)'::regprocedure
  ] loop
    definition=pg_get_functiondef(signature);
    if position('member.membership' in definition)=0 then
      raise exception 'MEMBERSHIP_FUNCTION_SOURCE_UNEXPECTED:%',signature;
    end if;
    execute replace(definition,'member.membership','access.membership');
  end loop;
end
$repair$;

insert into runtime.schemaversion(version,checksum)
values('20260821060000','0e80858cc999ab361860cce10ba94d5f3132b9a564ce782f2c780af013f7e244');

do $assert$ begin
  if exists(
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where procedure.prokind in('f','p') and namespace.nspname in('identity','access','capability')
      and pg_get_functiondef(procedure.oid) like '%member.membership%'
  ) then raise exception 'REMOVED_MEMBERSHIP_TABLE_REFERENCE_REMAINS'; end if;
  if (select count(*) from access.resolve_membership(
    (select id from access.membership where client='storefront' and status='active' order by id limit 1)
  ))<>1 then raise exception 'MEMBERSHIP_RESOLVER_INVALID'; end if;
end $assert$;

commit;
