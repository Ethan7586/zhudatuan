begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:separate-l0-l1-auth-return-targets:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'AUTH_RETURN_TARGET_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907110000'
        and checksum='db19bf4098a3758b6831fdfee624c2260daf70c7757c34c729d0bb4025cad554')
    or exists(select 1 from runtime.schemaversion where version>'20260907110000') then
    raise exception 'AUTH_RETURN_TARGET_PREDECESSOR_INVALID';
  end if;
  if to_regclass('identity.authticket') is null then raise exception 'AUTH_TICKET_TABLE_MISSING'; end if;
end
$precondition$;

alter table identity.authticket drop constraint authticket_target_check;
alter table identity.authticket add constraint authticket_target_check
  check(target in('console','console-hbbtzn','storefront','storefront-hbbtzn','store','supplier'));

insert into runtime.schemaversion(version,checksum)
values('20260907113000','8f76706e2dcccbb24c984f0f000fd4d2846832dc0b2b304046283345e1022e4f');

do $assert$
begin
  if not exists(select 1 from pg_constraint constraint_record
      join pg_class relation on relation.oid=constraint_record.conrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='identity' and relation.relname='authticket'
        and constraint_record.conname='authticket_target_check'
        and pg_get_constraintdef(constraint_record.oid) like '%storefront-hbbtzn%')
    or not exists(select 1 from runtime.schemaversion
      where version='20260907113000'
        and checksum='8f76706e2dcccbb24c984f0f000fd4d2846832dc0b2b304046283345e1022e4f') then
    raise exception 'AUTH_RETURN_TARGET_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
