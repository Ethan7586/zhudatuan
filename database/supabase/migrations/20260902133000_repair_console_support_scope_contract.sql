begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:console-support-scope-contract:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902132000'
      and checksum='cf4ea3faa16fd6a64b06adfb3ab5488a7c1a8e8c11c13462c0421a72a6f5665d')
    or exists(select 1 from runtime.schemaversion where version>'20260902132000') then
    raise exception 'CONSOLE_SUPPORT_SCOPE_PREDECESSOR_INVALID';
  end if;
  if to_regrole('shopconsole') is null
    or to_regrole('zhudatuanconsoleapi') is null
    or to_regprocedure('access.resolve_scope(text,text,text,text)') is null then
    raise exception 'CONSOLE_SUPPORT_SCOPE_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

grant execute on function access.resolve_scope(text,text,text,text) to shopconsole;

insert into runtime.schemaversion(version,checksum)
values('20260902133000','0773015646b923fcf9e66a68c444fc164f6fadfb49d48f19344d59d638d66c4a');

do $assert$
begin
  if not has_function_privilege('shopconsole','access.resolve_scope(text,text,text,text)','EXECUTE')
    or has_function_privilege('public','access.resolve_scope(text,text,text,text)','EXECUTE') then
    raise exception 'CONSOLE_SUPPORT_SCOPE_CONTRACT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902133000'
      and checksum='0773015646b923fcf9e66a68c444fc164f6fadfb49d48f19344d59d638d66c4a') then
    raise exception 'CONSOLE_SUPPORT_SCOPE_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
