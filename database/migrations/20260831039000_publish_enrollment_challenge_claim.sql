begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831038000') then
    raise exception 'ENROLLMENT_CHALLENGE_CLAIM_PUBLISH_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831039000') then
    raise exception 'ENROLLMENT_CHALLENGE_CLAIM_PUBLISH_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from pg_policies where schemaname='identity' and tablename='invitationclaim'
      and policyname='invitationclaimapi' and position('identity.challenges.create' in coalesce(qual,''))>0
      and position('identity.challenges.create' in coalesce(with_check,''))>0
  ) then
    raise exception 'ENROLLMENT_CHALLENGE_CLAIM_REPAIR_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831039000',1,1,0,0,
  'select tablename,policyname,qual,with_check from pg_policies where schemaname=''identity'' and tablename in(''invitation'',''invitationclaim'') order by tablename,policyname;',
  'select version,checksum from runtime.schemaversion where version in(''20260831038000'',''20260831039000'') order by version;');

insert into runtime.schemaversion(version,checksum)
values('20260831039000','848ae95b92bde2a45498e83e442ed5832593d8571117324076517128c0fc01d0');

commit;
