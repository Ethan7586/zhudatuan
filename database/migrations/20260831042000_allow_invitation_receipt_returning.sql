begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831041000') then
    raise exception 'INVITATION_RECEIPT_RETURNING_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831042000') then
    raise exception 'INVITATION_RECEIPT_RETURNING_ALREADY_APPLIED';
  end if;
end $precondition$;

create policy invitationreceiptapiwriteview on identity.invitationreceipt for select to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.create','identity.sessions.complete','identity.enrollments.complete')
);

do $verify$ begin
  if not exists(
    select 1 from pg_policies where schemaname='identity' and tablename='invitationreceipt'
      and policyname='invitationreceiptapiwriteview' and cmd='SELECT'
      and position('identity.enrollments.complete' in coalesce(qual,''))>0
  ) then
    raise exception 'INVITATION_RECEIPT_RETURNING_POLICY_MISSING';
  end if;
end $verify$;

select runtime.record_migration_evidence('20260831042000',1,1,0,0,
  'select policyname,cmd,qual,with_check from pg_policies where schemaname=''identity'' and tablename=''invitationreceipt'' order by policyname;',
  'select count(*) receipts from identity.invitationreceipt;');
insert into runtime.schemaversion(version,checksum)
values('20260831042000',encode(public.digest('20260831042000_allow_invitation_receipt_returning','sha256'),'hex'));

commit;
