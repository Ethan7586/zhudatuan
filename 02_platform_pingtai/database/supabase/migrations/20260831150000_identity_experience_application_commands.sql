begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-experience-application-commands:v1'));

do $precondition$
declare
  required_operation text;
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831140000'
      and checksum='a392995b225ffc0c05fbab55772b549ed3db503fbcc889a7c8e5dcb460e597f7') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260831140000') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or to_regclass('experience.application') is null
    or to_regclass('experience.version') is null then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_TARGET_MISSING';
  end if;
  if not has_table_privilege('zhudatuanidentityapi','experience.application','SELECT')
    or has_table_privilege('zhudatuanidentityapi','experience.application','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or not has_table_privilege('zhudatuanidentityapi','experience.version','SELECT')
    or has_table_privilege('zhudatuanidentityapi','experience.version','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_ACL_STATE_INVALID';
  end if;
  if exists(select 1 from pg_policies where schemaname='experience'
    and ((tablename='application' and policyname in('identityapiapplicationinsert','identityapiapplicationupdate'))
      or (tablename='version' and policyname='identityapiversioninsert'))) then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_POLICY_EXISTS';
  end if;
  if not exists(select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
      and permission.code='experience.application.manage') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_OWNER_PERMISSION_MISSING';
  end if;
  foreach required_operation in array array[
    'experience.applications.create','experience.applications.update','experience.applications.copy'
  ] loop
    if not exists(select 1 from capability.membership_operations('membership-platform-owner-ethan-v1') available
      where available.operation_id=required_operation) then
      raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_OWNER_OPERATION_MISSING:%',required_operation;
    end if;
  end loop;
end
$precondition$;

grant insert,update on table experience.application to zhudatuanidentityapi;
grant insert on table experience.version to zhudatuanidentityapi;

revoke delete,truncate,references,trigger on table experience.application from zhudatuanidentityapi;
revoke update,delete,truncate,references,trigger on table experience.version from zhudatuanidentityapi;

create policy identityapiapplicationinsert on experience.application
  for insert to zhudatuanidentityapi with check(true);
create policy identityapiapplicationupdate on experience.application
  for update to zhudatuanidentityapi using(true) with check(true);
create policy identityapiversioninsert on experience.version
  for insert to zhudatuanidentityapi with check(true);

insert into runtime.schemaversion(version,checksum)
values('20260831150000','0ff4aba32aa64206955513760655589f9d0537598f1e47b174b49ae98fd7b074');

do $assert$
declare
  required_operation text;
begin
  if not has_table_privilege('zhudatuanidentityapi','experience.application','SELECT,INSERT,UPDATE')
    or has_table_privilege('zhudatuanidentityapi','experience.application','DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_APPLICATION_ACL_INVALID';
  end if;
  if not has_table_privilege('zhudatuanidentityapi','experience.version','SELECT,INSERT')
    or has_table_privilege('zhudatuanidentityapi','experience.version','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_VERSION_ACL_INVALID';
  end if;
  if has_table_privilege('zhudatuanidentityapi','experience.release','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('zhudatuanidentityapi','experience.binding','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_OTHER_WRITE_INVALID';
  end if;
  if exists(
    select 1
    from (values('application'),('version')) target(relation_name)
    where not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='experience' and relation.relname=target.relation_name and relation.relrowsecurity)
  ) then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_RLS_DISABLED';
  end if;
  if not exists(select 1 from pg_policies where schemaname='experience' and tablename='application'
      and policyname='identityapiapplicationinsert' and cmd='INSERT' and 'zhudatuanidentityapi'=any(roles::text[]))
    or not exists(select 1 from pg_policies where schemaname='experience' and tablename='application'
      and policyname='identityapiapplicationupdate' and cmd='UPDATE' and 'zhudatuanidentityapi'=any(roles::text[]))
    or not exists(select 1 from pg_policies where schemaname='experience' and tablename='version'
      and policyname='identityapiversioninsert' and cmd='INSERT' and 'zhudatuanidentityapi'=any(roles::text[])) then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_POLICY_INVALID';
  end if;
  if not exists(select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
      and permission.code='experience.application.manage') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_OWNER_PERMISSION_INVALID';
  end if;
  foreach required_operation in array array[
    'experience.applications.create','experience.applications.update','experience.applications.copy'
  ] loop
    if not exists(select 1 from capability.membership_operations('membership-platform-owner-ethan-v1') available
      where available.operation_id=required_operation) then
      raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_OWNER_OPERATION_INVALID:%',required_operation;
    end if;
  end loop;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831150000' and checksum='0ff4aba32aa64206955513760655589f9d0537598f1e47b174b49ae98fd7b074') then
    raise exception 'IDENTITY_EXPERIENCE_APPLICATION_COMMANDS_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
