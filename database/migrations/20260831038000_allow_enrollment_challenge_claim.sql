begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831037000') then
    raise exception 'ENROLLMENT_CHALLENGE_CLAIM_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831038000') then
    raise exception 'ENROLLMENT_CHALLENGE_CLAIM_ALREADY_APPLIED';
  end if;
end $precondition$;

drop policy invitationapi on identity.invitation;
create policy invitationapi on identity.invitation for all to shopapp using(
  current_setting('app.workload',true)='api' and (
    current_setting('app.operation_id',true) in('identity.sessions.create','identity.sessions.complete','identity.invitations.resolve',
      'identity.enrollments.read','identity.enrollments.complete','identity.challenges.create')
    or access.scope_allowed(organization_id)
  )
) with check(
  current_setting('app.workload',true)='api' and (
    current_setting('app.operation_id',true) in('identity.sessions.create','identity.sessions.complete','identity.enrollments.complete',
      'identity.challenges.create')
    or access.scope_allowed(organization_id)
  )
);

drop policy invitationclaimapi on identity.invitationclaim;
create policy invitationclaimapi on identity.invitationclaim for all to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.create','identity.sessions.complete','identity.enrollments.read','identity.enrollments.complete',
    'identity.challenges.create')
) with check(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.create','identity.sessions.complete','identity.enrollments.complete','identity.challenges.create')
);

do $verify$
declare invitation_using text; invitation_check text; claim_using text; claim_check text;
begin
  select qual,with_check into invitation_using,invitation_check from pg_policies
  where schemaname='identity' and tablename='invitation' and policyname='invitationapi';
  select qual,with_check into claim_using,claim_check from pg_policies
  where schemaname='identity' and tablename='invitationclaim' and policyname='invitationclaimapi';
  if position('identity.challenges.create' in coalesce(invitation_using,''))=0
      or position('identity.challenges.create' in coalesce(invitation_check,''))=0
      or position('identity.challenges.create' in coalesce(claim_using,''))=0
      or position('identity.challenges.create' in coalesce(claim_check,''))=0 then
    raise exception 'ENROLLMENT_CHALLENGE_CLAIM_POLICY_MISSING';
  end if;
end $verify$;

select runtime.record_migration_evidence('20260831038000',2,2,0,0,
  'select tablename,policyname,qual,with_check from pg_policies where schemaname=''identity'' and tablename in(''invitation'',''invitationclaim'') order by tablename,policyname;',
  'select state,count(*) from identity.invitationclaim group by state order by state;');
insert into runtime.schemaversion(version,checksum)
values('20260831038000',encode(public.digest('20260831038000_allow_enrollment_challenge_claim','sha256'),'hex'));

commit;
