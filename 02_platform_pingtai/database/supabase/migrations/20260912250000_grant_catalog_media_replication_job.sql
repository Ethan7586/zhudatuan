begin;

select pg_advisory_xact_lock(hashtext('catalog:media-replication-job-grants:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912240000'
        and checksum='9fa01e96c2698e0da588f0b82780ecdf31eeebd34c78aaffc1b35664d9dc1174')
    or exists(select 1 from runtime.schemaversion where version>'20260912240000') then
    raise exception 'CATALOG_MEDIA_JOB_GRANTS_PREDECESSOR_INVALID';
  end if;
  if to_regclass('catalog.mediaobject') is null
    or to_regclass('catalog.mediareplica') is null
    or to_regclass('catalog.productmedia') is null then
    raise exception 'CATALOG_MEDIA_JOB_GRANTS_TARGET_MISSING';
  end if;
end
$precondition$;

grant select,insert,update,delete on
  catalog.mediaobject,catalog.mediareplica,catalog.productmedia to shopjob;

insert into runtime.schemaversion(version,checksum)
values('20260912250000','24f71fb162010ad5da92d48532535e387f7b49cef24130835a86ea0e50997f5a');

do $assert$
begin
  if not has_table_privilege('shopjob','catalog.mediaobject','SELECT,INSERT,UPDATE,DELETE')
    or not has_table_privilege('shopjob','catalog.mediareplica','SELECT,INSERT,UPDATE,DELETE')
    or not has_table_privilege('shopjob','catalog.productmedia','SELECT,INSERT,UPDATE,DELETE')
    or not has_table_privilege('shopjob','catalog.product','SELECT,UPDATE')
    or not exists(select 1 from runtime.schemaversion
      where version='20260912250000'
        and checksum='24f71fb162010ad5da92d48532535e387f7b49cef24130835a86ea0e50997f5a') then
    raise exception 'CATALOG_MEDIA_JOB_GRANTS_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
