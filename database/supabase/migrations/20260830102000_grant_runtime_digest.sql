begin;

-- Provider-effect integrity constraints hash canonical JSON while rows are
-- written by API and job roles. Keep pgcrypto unavailable to Public and grant
-- only schema lookup plus the exact overload required by those constraints.
grant usage on schema public to shopapp,shopjob;
revoke all on function public.digest(text,text) from public;
grant execute on function public.digest(text,text) to shopapp,shopjob;

insert into runtime.schemaversion(version,checksum)
values('20260830102000','0c277dba0bf8af1e8bef9a6419cba87be8bb7e220f293193130e7d81e4cf2e1c');

do $assert$
begin
  if not has_schema_privilege('shopapp','public','usage')
    or not has_schema_privilege('shopjob','public','usage')
    or not has_function_privilege('shopapp','public.digest(text,text)','execute')
    or not has_function_privilege('shopjob','public.digest(text,text)','execute')
  then raise exception 'RUNTIME_DIGEST_PERMISSION_MISSING'; end if;
end
$assert$;

commit;
