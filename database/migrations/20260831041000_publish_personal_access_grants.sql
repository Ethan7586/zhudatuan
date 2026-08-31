begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831040000') then
    raise exception 'PERSONAL_ACCESS_GRANT_PUBLISH_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831041000') then
    raise exception 'PERSONAL_ACCESS_GRANT_PUBLISH_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from pg_policies where schemaname='access' and tablename='scopegrant' and policyname='appscope'
      and position('membership.member_id' in coalesce(qual,''))>0
      and position('membership.principal_id' in coalesce(with_check,''))>0
  ) then
    raise exception 'PERSONAL_ACCESS_GRANT_REPAIR_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831041000',1,1,0,0,
  'select policyname,qual,with_check from pg_policies where schemaname=''access'' and tablename=''scopegrant'' order by policyname;',
  'select version,checksum from runtime.schemaversion where version in(''20260831040000'',''20260831041000'') order by version;');

insert into runtime.schemaversion(version,checksum)
values('20260831041000','848ae95b92bde2a45498e83e442ed5832593d8571117324076517128c0fc01d0');

commit;
