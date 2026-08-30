begin;

-- Provider-effect integrity constraints hash canonical JSON while rows are
-- written by API and job roles. Keep pgcrypto unavailable to Public and grant
-- only schema lookup plus the exact overload required by those constraints.
grant usage on schema public to shopapp,shopjob;
revoke all on function public.digest(text,text) from public;
grant execute on function public.digest(text,text) to shopapp,shopjob;

insert into runtime.schemaversion(version,checksum)
values('20260830102000','4bcf458925db1854a87612585f1920492cbf4cae392845ef9e93f0f511c2d80b');

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
