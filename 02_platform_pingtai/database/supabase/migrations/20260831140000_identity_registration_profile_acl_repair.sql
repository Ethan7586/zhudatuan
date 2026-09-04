begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-registration-profile-acl-repair:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831130000'
      and checksum='f11d5ada12dcec2ffe3cdbf42b3c244e0774eac28b4ff5780f1f822f2b252f1c') then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260831130000') then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null or to_regclass('member.profile') is null then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_TARGET_MISSING';
  end if;
  if not has_table_privilege('zhudatuanidentityapi','member.profile','SELECT')
    or has_table_privilege('zhudatuanidentityapi','member.profile','INSERT,UPDATE,DELETE') then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_STATE_INVALID';
  end if;
  if not exists(select 1 from pg_policies
    where schemaname='member' and tablename='profile' and policyname='zhudatuanidentityapi'
      and cmd='ALL' and 'zhudatuanidentityapi'=any(roles::text[])) then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_POLICY_MISSING';
  end if;
end
$precondition$;

grant insert,update on table member.profile to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260831140000','a392995b225ffc0c05fbab55772b549ed3db503fbcc889a7c8e5dcb460e597f7');

do $assert$
begin
  if not has_table_privilege('zhudatuanidentityapi','member.profile','SELECT,INSERT,UPDATE')
    or has_table_privilege('zhudatuanidentityapi','member.profile','DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_FAILED';
  end if;
  if not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='member' and relation.relname='profile' and relation.relrowsecurity) then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_RLS_DISABLED';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831140000'
      and checksum='a392995b225ffc0c05fbab55772b549ed3db503fbcc889a7c8e5dcb460e597f7') then
    raise exception 'IDENTITY_REGISTRATION_PROFILE_ACL_REPAIR_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
