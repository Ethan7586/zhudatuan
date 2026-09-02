begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902022000') then
    raise exception 'INVITATION_RESOLVE_RECEIPT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902023000') then
    raise exception 'INVITATION_RESOLVE_RECEIPT_ALREADY_APPLIED';
  end if;
end
$precondition$;

drop policy invitationreceiptapiwrite on identity.invitationreceipt;
drop policy invitationreceiptapiwriteview on identity.invitationreceipt;
create policy invitationreceiptapiwrite on identity.invitationreceipt for insert to shopapp with check(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.invitations.resolve','identity.sessions.complete','identity.enrollments.complete')
);
create policy invitationreceiptapiwriteview on identity.invitationreceipt for select to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.invitations.resolve','identity.sessions.complete','identity.enrollments.complete')
);

select runtime.record_migration_evidence(
  '20260902023000',
  (select count(*) from pg_policies where schemaname='identity' and tablename='invitationreceipt'
    and policyname in('invitationreceiptapiwrite','invitationreceiptapiwriteview')),
  (select count(*) from pg_policies where schemaname='identity' and tablename='invitationreceipt'
    and policyname in('invitationreceiptapiwrite','invitationreceiptapiwriteview')
    and position('identity.invitations.resolve' in coalesce(qual,with_check,''))>0),
  0,0,
  'select policyname,cmd,qual,with_check from pg_policies where schemaname=''identity'' and tablename=''invitationreceipt'' order by policyname;',
  'select invitation_id,count(*) from identity.invitationreceipt group by invitation_id order by invitation_id;'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902023000',
  encode(public.digest('20260902023000_allow_invitation_resolve_receipt','sha256'),'hex')
);

do $assert$
begin
  if (
    select count(*) from pg_policies where schemaname='identity' and tablename='invitationreceipt'
      and policyname in('invitationreceiptapiwrite','invitationreceiptapiwriteview')
      and position('identity.invitations.resolve' in coalesce(qual,with_check,''))>0
  )<>2 then raise exception 'INVITATION_RESOLVE_RECEIPT_POLICY_MISSING'; end if;
end
$assert$;

commit;
