begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:support-message-visibility:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260914150000'
      and checksum='56fc6fb789e904fe929720c30ba98756abf470c12372dbc5b6a1255e8444710e') then
    raise exception 'SUPPORT_MESSAGE_VISIBILITY_PREDECESSOR_MISSING';
  end if;
  if to_regclass('support.message') is null then
    raise exception 'SUPPORT_MESSAGE_VISIBILITY_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

alter table support.message add column visibility text not null default 'public';
alter table support.message add constraint support_message_visibility_check
  check(visibility in('public','internal'));

insert into runtime.schemaversion(version,checksum)
values('20260914231500','f5e2c63f3351f910d32434b4ad829f88fece45b83b30ca9e30a903fc0b30ffb4');

do $assert$
begin
  if not exists(select 1 from pg_attribute
      where attrelid='support.message'::regclass and attname='visibility' and attnotnull)
    or not exists(select 1 from runtime.schemaversion
      where version='20260914231500'
        and checksum='f5e2c63f3351f910d32434b4ad829f88fece45b83b30ca9e30a903fc0b30ffb4') then
    raise exception 'SUPPORT_MESSAGE_VISIBILITY_SCHEMA_INVALID';
  end if;
end
$assert$;

commit;
