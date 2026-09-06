begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-stepup-session-hash-reconcile:v1'));

do $boundary_guard$
declare
  existing_type text;
  existing_length integer;
begin
  if current_user<>'shopmigration'
    and not coalesce((select rolsuper from pg_roles where rolname=current_user),false) then
    raise exception 'IDENTITY_STEPUP_SESSION_HASH_REPAIR_ROLE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260821057000'
        and checksum='bf87d5d0d67aff6b547ebaac0e5dee047914bfc449ba3ae0cc627bc9e385ab4a')
    or exists(select 1 from runtime.schemaversion where version>'20260821057000') then
    raise exception 'IDENTITY_STEPUP_SESSION_HASH_REPAIR_HEAD_INVALID';
  end if;
  if to_regclass('identity.challenge') is null then
    raise exception 'IDENTITY_STEPUP_SESSION_HASH_REPAIR_TABLE_MISSING';
  end if;
  select data_type,character_maximum_length into existing_type,existing_length
  from information_schema.columns
  where table_schema='identity' and table_name='challenge' and column_name='session_hash';
  if existing_type is not null and (existing_type<>'character' or existing_length<>64) then
    raise exception 'IDENTITY_STEPUP_SESSION_HASH_REPAIR_COLUMN_INVALID';
  end if;
end
$boundary_guard$;

alter table identity.challenge add column if not exists session_hash char(64);

do $assert$
begin
  if not exists(select 1 from information_schema.columns
    where table_schema='identity' and table_name='challenge' and column_name='session_hash'
      and data_type='character' and character_maximum_length=64 and is_nullable='YES') then
    raise exception 'IDENTITY_STEPUP_SESSION_HASH_REPAIR_INCOMPLETE';
  end if;
end
$assert$;

commit;
