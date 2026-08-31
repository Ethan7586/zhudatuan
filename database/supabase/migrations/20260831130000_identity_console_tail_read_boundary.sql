begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-console-tail-read-boundary:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_CONSOLE_TAIL_READ_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831120000'
      and checksum='b2b9fd82cba3e317a9ac237b2226ca0d5149d15dbe33656e15cb7ae1c36c5c9a') then
    raise exception 'IDENTITY_CONSOLE_TAIL_READ_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260831120000') then
    raise exception 'IDENTITY_CONSOLE_TAIL_READ_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or array_position(array[
      to_regclass('catalog.importjob'),to_regclass('catalog.importerror'),
      to_regclass('experience.application'),to_regclass('experience.version'),to_regclass('experience.release'),
      to_regclass('experience.binding'),to_regclass('invoice.request'),to_regclass('invoice.requestprofile'),
      to_regclass('invoice.document'),to_regclass('invoice.requestline'),to_regclass('member.importjob'),
      to_regclass('member.importerror'),to_regclass('notification.announcement'),to_regclass('notification.template'),
      to_regclass('qualification.policy'),to_regclass('qualification.policyversion'),
      to_regclass('voucher.importjob'),to_regclass('voucher.importerror')
    ],null) is not null then
    raise exception 'IDENTITY_CONSOLE_TAIL_READ_RELATION_MISSING';
  end if;
end
$precondition$;

grant usage on schema catalog,experience,invoice,member,notification,qualification,voucher to zhudatuanidentityapi;
grant select on table
  catalog.importjob,catalog.importerror,experience.application,experience.version,experience.release,experience.binding,
  invoice.request,invoice.requestprofile,invoice.document,invoice.requestline,member.importjob,member.importerror,
  notification.announcement,notification.template,qualification.policy,qualification.policyversion,
  voucher.importjob,voucher.importerror
to zhudatuanidentityapi;
revoke insert,update,delete,truncate,references,trigger on table
  catalog.importjob,catalog.importerror,experience.application,experience.version,experience.release,experience.binding,
  invoice.request,invoice.requestprofile,invoice.document,invoice.requestline,member.importjob,member.importerror,
  notification.announcement,notification.template,qualification.policy,qualification.policyversion,
  voucher.importjob,voucher.importerror
from zhudatuanidentityapi;

do $policies$
declare relation_name text;
begin
  foreach relation_name in array array[
    'catalog.importjob','catalog.importerror','experience.application','experience.version','experience.release',
    'experience.binding','invoice.request','invoice.requestprofile','invoice.document','invoice.requestline',
    'member.importjob','member.importerror','notification.announcement','notification.template',
    'qualification.policy','qualification.policyversion'
  ] loop
    execute format('create policy identityapiread on %I.%I for select to zhudatuanidentityapi using (true)',
      split_part(relation_name,'.',1),split_part(relation_name,'.',2));
  end loop;
end
$policies$;

insert into runtime.schemaversion(version,checksum)
values('20260831130000','f11d5ada12dcec2ffe3cdbf42b3c244e0774eac28b4ff5780f1f822f2b252f1c');

do $assert$
declare schema_name text;
declare relation_name text;
begin
  foreach schema_name in array array['catalog','experience','invoice','member','notification','qualification','voucher'] loop
    if not has_schema_privilege('zhudatuanidentityapi',schema_name,'USAGE') then
      raise exception 'IDENTITY_CONSOLE_TAIL_READ_SCHEMA_USAGE_INVALID:%',schema_name;
    end if;
  end loop;
  foreach relation_name in array array[
    'catalog.importjob','catalog.importerror','experience.application','experience.version','experience.release',
    'experience.binding','invoice.request','invoice.requestprofile','invoice.document','invoice.requestline',
    'member.importjob','member.importerror','notification.announcement','notification.template',
    'qualification.policy','qualification.policyversion','voucher.importjob','voucher.importerror'
  ] loop
    if not has_table_privilege('zhudatuanidentityapi',relation_name,'SELECT')
      or has_table_privilege('zhudatuanidentityapi',relation_name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'IDENTITY_CONSOLE_TAIL_READ_TABLE_ACL_INVALID:%',relation_name;
    end if;
    if not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname=split_part(relation_name,'.',1)
        and relation.relname=split_part(relation_name,'.',2) and relation.relrowsecurity) then
      raise exception 'IDENTITY_CONSOLE_TAIL_READ_RLS_DISABLED:%',relation_name;
    end if;
    if not exists(select 1 from pg_policies where schemaname=split_part(relation_name,'.',1)
      and tablename=split_part(relation_name,'.',2) and policyname='identityapiread' and cmd='SELECT'
      and 'zhudatuanidentityapi'=any(roles::text[])) then
      raise exception 'IDENTITY_CONSOLE_TAIL_READ_POLICY_INVALID:%',relation_name;
    end if;
  end loop;
end
$assert$;

commit;
