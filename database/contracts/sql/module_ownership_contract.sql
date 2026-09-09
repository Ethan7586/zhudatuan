begin;

do $contract$
declare violation text;
begin
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and contract_version='5.0.0' and migration_head='20260909018000'
  ) then raise exception 'IDEAL_SCHEMA_HEAD_INVALID'; end if;

  select namespace.nspname into violation
  from runtime.moduleauthority authority
  join pg_namespace namespace on namespace.nspname=authority.schema_name
  where namespace.nspowner::regrole::text<>authority.owner_role
  order by namespace.nspname limit 1;
  if violation is not null then raise exception 'IDEAL_SCHEMA_OWNER_INVALID:%',violation; end if;

  select namespace.nspname||'.'||relation.relname into violation
  from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  left join runtime.moduleauthority authority on authority.schema_name=namespace.nspname
  where namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
    and relation.relkind in('r','p')
    and relation.relowner::regrole::text<>case when namespace.nspname='invoice' then 'shopfinanceowner' else authority.owner_role end
  order by namespace.nspname,relation.relname limit 1;
  if violation is not null then raise exception 'IDEAL_TABLE_OWNER_INVALID:%',violation; end if;

  if exists(
    select 1 from runtime.moduleauthority authority
    join pg_roles owner on owner.rolname=authority.owner_role
    join pg_roles reader on reader.rolname=authority.reader_role
    join pg_roles writer on writer.rolname=authority.writer_role
    where owner.rolcanlogin or reader.rolcanlogin or writer.rolcanlogin
      or owner.rolbypassrls or reader.rolbypassrls or writer.rolbypassrls
  ) then raise exception 'IDEAL_MODULE_ROLE_UNSAFE'; end if;

  if exists(select 1 from pg_roles where rolname='shopmigration' and (rolcanlogin or rolinherit or rolbypassrls))
    then raise exception 'IDEAL_MIGRATION_ROLE_UNSAFE'; end if;
end
$contract$;

rollback;
