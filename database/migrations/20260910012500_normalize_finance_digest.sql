begin;

do $precondition$
declare source text;
begin
  if not exists(select 1 from runtime.schemaversion where version='20260910012000') then
    raise exception 'FINANCE_DIGEST_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910012500') then
    raise exception 'FINANCE_DIGEST_ALREADY_APPLIED';
  end if;
  if to_regprocedure('public.digest(text,text)') is null
    or to_regprocedure('finance.account_id(text,text,text)') is null then
    raise exception 'FINANCE_DIGEST_DEPENDENCY_MISSING';
  end if;
  select pg_get_functiondef('finance.account_id(text,text,text)'::regprocedure) into source;
  if source not like '%public.digest(%' and source not like '%extensions.digest(%' then
    raise exception 'FINANCE_DIGEST_SOURCE_UNRECOGNIZED';
  end if;
end
$precondition$;

create or replace function finance.account_id(p_scope text,p_code text,p_currency text)
returns text language sql immutable strict parallel safe as $function$
  select 'account:'||substr(encode(public.digest(p_scope||':'||p_code||':'||p_currency,'sha256'::text),'hex'),1,40)
$function$;

revoke all on function finance.account_id(text,text,text) from public;
grant execute on function finance.account_id(text,text,text) to shopmigration,shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260910012500',
  1,
  1,
  0,
  0,
  'select pg_get_functiondef(''finance.account_id(text,text,text)''::regprocedure);',
  'select namespace.nspname,procedure.proname from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=''finance'' and procedure.prosrc like ''%extensions.digest(%'' order by procedure.proname;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910012500',encode(public.digest('20260910012500_normalize_finance_digest','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910012500',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:finance',
  published_at=clock_timestamp()
where artifact='commerce';

do $assert$
declare source text;
begin
  select pg_get_functiondef('finance.account_id(text,text,text)'::regprocedure) into source;
  if source not like '%public.digest(%' or source like '%extensions.digest(%' then
    raise exception 'FINANCE_DIGEST_NORMALIZATION_FAILED';
  end if;
  if not has_function_privilege('shopfinanceowner','finance.account_id(text,text,text)','execute')
    or not has_function_privilege('shopmigration','finance.account_id(text,text,text)','execute')
    or not has_function_privilege('shopapp','finance.account_id(text,text,text)','execute')
    or not has_function_privilege('shopjob','finance.account_id(text,text,text)','execute') then
    raise exception 'FINANCE_DIGEST_EXECUTION_PRIVILEGE_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260910012500'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'FINANCE_DIGEST_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
