begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831042000') then
    raise exception 'INVITATION_RECEIPT_RETURNING_PUBLISH_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831043000') then
    raise exception 'INVITATION_RECEIPT_RETURNING_PUBLISH_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from pg_policies where schemaname='identity' and tablename='invitationreceipt'
      and policyname='invitationreceiptapiwriteview'
  ) then
    raise exception 'INVITATION_RECEIPT_RETURNING_REPAIR_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831043000',1,1,0,0,
  'select policyname,cmd,qual,with_check from pg_policies where schemaname=''identity'' and tablename=''invitationreceipt'' order by policyname;',
  'select version,checksum from runtime.schemaversion where version in(''20260831042000'',''20260831043000'') order by version;');

insert into runtime.schemaversion(version,checksum)
values('20260831043000','848ae95b92bde2a45498e83e442ed5832593d8571117324076517128c0fc01d0');

commit;
