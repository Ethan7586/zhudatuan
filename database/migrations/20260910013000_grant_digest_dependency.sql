begin;

do $precondition$
begin
  if current_user<>'shopmigration'
    or not pg_has_role(session_user,'shopmigration','set') then
    raise exception 'DIGEST_DEPENDENCY_MIGRATION_ROLE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260910012500') then
    raise exception 'DIGEST_DEPENDENCY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910013000') then
    raise exception 'DIGEST_DEPENDENCY_ALREADY_APPLIED';
  end if;
  if to_regprocedure('public.digest(text,text)') is null
    or to_regprocedure('public.digest(bytea,text)') is null then
    raise exception 'DIGEST_EXTENSION_MISSING';
  end if;
end
$precondition$;

reset role;

do $grant_dependency$
declare target record;
begin
  if current_user<>session_user
    or not pg_has_role(current_user,(select nspowner from pg_namespace where nspname='public'),'set')
    or exists(
      select 1 from pg_proc
      where oid in('public.digest(text,text)'::regprocedure,'public.digest(bytea,text)'::regprocedure)
        and proowner::regrole<>current_user::regrole
    ) then
    raise exception 'DIGEST_EXTENSION_OWNER_INVALID';
  end if;
  for target in
    select distinct role_name from (
      select owner_role role_name from runtime.moduleauthority
      union all select 'shopmigration'
      union all select 'shopapp'
      union all select 'shopjob'
    ) roles
    order by role_name
  loop
    execute format('grant usage on schema public to %I',target.role_name);
    execute format(
      'grant execute on function public.digest(text,text),public.digest(bytea,text) to %I',
      target.role_name
    );
  end loop;
end
$grant_dependency$;

set role shopmigration;

select runtime.record_migration_evidence(
  '20260910013000',
  2,
  2,
  0,
  0,
  'select namespace.nspname,procedure.proname,pg_get_function_identity_arguments(procedure.oid),procedure.proowner::regrole from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=''public'' and procedure.proname=''digest'' order by 3;',
  'select role_name from (select owner_role role_name from runtime.moduleauthority union all select ''shopmigration'' union all select ''shopapp'' union all select ''shopjob'') roles where not has_schema_privilege(role_name,''public'',''usage'') or not has_function_privilege(role_name,''public.digest(text,text)'',''execute'') or not has_function_privilege(role_name,''public.digest(bytea,text)'',''execute'') order by role_name;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910013000',encode(public.digest('20260910013000_grant_digest_dependency','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910013000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:platform',
  published_at=clock_timestamp()
where artifact='commerce';

do $assert$
declare target record;
begin
  if current_user<>'shopmigration' then
    raise exception 'DIGEST_DEPENDENCY_ROLE_NOT_RESTORED';
  end if;
  for target in
    select distinct role_name from (
      select owner_role role_name from runtime.moduleauthority
      union all select 'shopmigration'
      union all select 'shopapp'
      union all select 'shopjob'
    ) roles
  loop
    if not has_schema_privilege(target.role_name,'public','usage')
      or not has_function_privilege(target.role_name,'public.digest(text,text)','execute')
      or not has_function_privilege(target.role_name,'public.digest(bytea,text)','execute') then
      raise exception 'DIGEST_DEPENDENCY_PRIVILEGE_INVALID:%',target.role_name;
    end if;
  end loop;
  if exists(
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    cross join lateral regexp_matches(procedure.prosrc,'public\.([a-zA-Z_][a-zA-Z0-9_]*)','g') reference(name)
    where namespace.nspname in(select schema_name from runtime.moduleauthority)
      and reference.name[1]<>'digest'
  ) then raise exception 'UNAPPROVED_EXTENSION_FUNCTION_DEPENDENCY'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260910013000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'DIGEST_DEPENDENCY_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
