begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032800') then raise exception 'IDEAL_MODULE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904040000') then raise exception 'IDEAL_MODULE_ALREADY_APPLIED'; end if;
  if (select count(*) from runtime.moduleauthority)<>33 then raise exception 'IDEAL_MODULE_COUNT_INVALID'; end if;
end
$precondition$;

do $ownership$
declare authority record;
begin
  for authority in select * from runtime.moduleauthority order by module_id loop
    if not exists(select 1 from pg_namespace where nspname=authority.schema_name) then
      raise exception 'IDEAL_MODULE_SCHEMA_MISSING:%',authority.schema_name;
    end if;
    execute format('revoke all on schema %I from public',authority.schema_name);
    execute format('alter default privileges for role shopmigration in schema %I revoke all on tables from public',authority.schema_name);
    execute format('alter default privileges for role shopmigration in schema %I revoke all on sequences from public',authority.schema_name);
    execute format('alter default privileges for role shopmigration in schema %I revoke all on functions from public',authority.schema_name);
  end loop;
end
$ownership$;

select runtime.record_migration_evidence('20260904040000',33,33,0,0,
  'select module_id,schema_name,owner_role,reader_role,writer_role from runtime.moduleauthority order by module_id;',
  'select schema_name,privilege_type from information_schema.schema_privileges where grantee=''PUBLIC'' order by schema_name;');
insert into runtime.schemaversion(version,checksum)
values('20260904040000',encode(public.digest('20260904040000_prepare_module_schemas','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from runtime.moduleauthority authority where
    not exists(select 1 from pg_roles where rolname=authority.owner_role and not rolcanlogin and not rolinherit)
    or not exists(select 1 from pg_roles where rolname=authority.reader_role and not rolcanlogin and not rolinherit)
    or not exists(select 1 from pg_roles where rolname=authority.writer_role and not rolcanlogin and not rolinherit))
  then raise exception 'IDEAL_MODULE_ROLE_INVALID'; end if;
end
$assert$;

commit;
