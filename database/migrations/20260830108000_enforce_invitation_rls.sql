begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830107000') then
    raise exception 'INVITATION_RLS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830108000') then
    raise exception 'INVITATION_RLS_ALREADY_APPLIED';
  end if;
end $precondition$;

drop policy invitationapi on identity.invitation;
create policy invitationapi on identity.invitation for all to shopapp using(
  current_setting('app.workload',true)='api' and (
    current_setting('app.operation_id',true) in('identity.sessions.create','identity.sessions.complete','identity.invitations.resolve',
      'identity.enrollments.read','identity.enrollments.complete')
    or access.scope_allowed(organization_id)
  )
) with check(
  current_setting('app.workload',true)='api' and (
    current_setting('app.operation_id',true) in('identity.sessions.create','identity.sessions.complete','identity.enrollments.complete')
    or access.scope_allowed(organization_id)
  )
);

drop policy invitationclaimapi on identity.invitationclaim;
create policy invitationclaimapi on identity.invitationclaim for all to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.create','identity.sessions.complete','identity.enrollments.read','identity.enrollments.complete')
) with check(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.create','identity.sessions.complete','identity.enrollments.complete')
);

drop policy invitationreceiptapiread on identity.invitationreceipt;
drop policy invitationreceiptapiwrite on identity.invitationreceipt;
create policy invitationreceiptapiread on identity.invitationreceipt for select to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true)='identity.invitations.read'
  and exists(select 1 from identity.invitation invitation where invitation.id=invitation_id
    and access.scope_allowed(invitation.organization_id))
);
create policy invitationreceiptapiwrite on identity.invitationreceipt for insert to shopapp with check(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.create','identity.sessions.complete','identity.enrollments.complete')
);
create index identity_invitation_scope on identity.invitation(organization_id,id);

select runtime.record_migration_evidence('20260830108000',4,
  (select count(*) from pg_policies where schemaname='identity'
    and policyname in('invitationapi','invitationclaimapi','invitationreceiptapiread','invitationreceiptapiwrite')),0,0,
  'create index concurrently if not exists identity_invitation_scope_live on identity.invitation(organization_id,id);',
  'select schemaname,tablename,policyname from pg_policies where schemaname=''identity'' and tablename like ''invitation%'' order by tablename,policyname;');
insert into runtime.schemaversion(version,checksum)
values('20260830108000',encode(public.digest('20260830108000_enforce_invitation_rls','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from pg_policies where schemaname='identity' and tablename in('invitation','invitationclaim','invitationreceipt')
    and policyname not like '%job%' and coalesce(qual,with_check,'') not like '%app.operation_id%') then
    raise exception 'INVITATION_RLS_OPERATION_UNBOUND';
  end if;
end $assert$;

commit;
