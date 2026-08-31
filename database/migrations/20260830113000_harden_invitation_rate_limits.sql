begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830112000') then
    raise exception 'INVITATION_RATE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830113000') then
    raise exception 'INVITATION_RATE_ALREADY_APPLIED';
  end if;
end $precondition$;

drop policy if exists jobscope on identity.loginattempt;
drop policy if exists invitationratejob on identity.loginattempt;
create policy invitationratejob on identity.loginattempt for all to shopjob
  using(current_setting('app.workload',true)='jobs' and current_setting('app.job_kind',true)='invitationcleanup')
  with check(current_setting('app.workload',true)='jobs' and current_setting('app.job_kind',true)='invitationcleanup');
revoke all privileges on identity.loginattempt from shopjob;
grant select,delete on identity.loginattempt to shopjob;

select runtime.record_migration_evidence('20260830113000',1,
  (select count(*) from pg_policies where schemaname='identity' and tablename='loginattempt' and policyname='invitationratejob'),0,0,
  'create index concurrently if not exists identity_loginattempt_window_live on identity.loginattempt(window_started_at,client_hash);',
  'select client_hash,count(*) from identity.loginattempt group by client_hash order by client_hash;');
insert into runtime.schemaversion(version,checksum)
values('20260830113000',encode(public.digest('20260830113000_harden_invitation_rate_limits','sha256'),'hex'));

do $assert$ begin
  if not has_table_privilege('shopjob','identity.loginattempt','SELECT,DELETE') then
    raise exception 'INVITATION_RATE_JOB_PRIVILEGE_MISSING';
  end if;
  if has_table_privilege('shopjob','identity.loginattempt','INSERT,UPDATE,TRUNCATE') then
    raise exception 'INVITATION_RATE_JOB_EXCESS_PRIVILEGE';
  end if;
  if not exists(select 1 from pg_policies where schemaname='identity' and tablename='loginattempt'
    and policyname='invitationratejob' and coalesce(qual,'') like '%invitationcleanup%') then
    raise exception 'INVITATION_RATE_JOB_POLICY_INVALID';
  end if;
end $assert$;

commit;
