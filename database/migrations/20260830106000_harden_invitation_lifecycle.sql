begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830105000') then
    raise exception 'INVITATION_LIFECYCLE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830106000') then
    raise exception 'INVITATION_LIFECYCLE_ALREADY_APPLIED';
  end if;
end $precondition$;

update identity.invitation set status='active',version=greatest(version+1,1) where status='reserved';
update identity.invitation set version=1 where version<1;
alter table identity.invitation alter column version set default 1;

do $constraints$
declare item record;
begin
  for item in select conname from pg_constraint where conrelid='identity.invitation'::regclass and contype='c'
    and (pg_get_constraintdef(oid) like '%status%reserved%' or pg_get_constraintdef(oid) like '%version >= 0%')
  loop execute format('alter table identity.invitation drop constraint %I',item.conname); end loop;
end $constraints$;
alter table identity.invitation add constraint invitation_status_valid
  check(status in('draft','active','exhausted','revoked','expired'));
alter table identity.invitation add constraint invitation_version_valid check(version>=1);

alter table identity.invitationclaim add column proof_method text;
alter table identity.invitationclaim add column proved_at timestamptz;
alter table identity.invitationclaim add column updated_at timestamptz not null default clock_timestamp();
update identity.invitationclaim set state='proofpending',proof_method='otp',updated_at=clock_timestamp() where state='active';

do $constraints$
declare item record;
begin
  for item in select conname from pg_constraint where conrelid='identity.invitationclaim'::regclass and contype='c'
    and (pg_get_constraintdef(oid) like '%state%active%consumed%revoked%expired%'
      or pg_get_constraintdef(oid) like '%state =%consumed%consumed_at%')
  loop execute format('alter table identity.invitationclaim drop constraint %I',item.conname); end loop;
end $constraints$;
alter table identity.invitationclaim add constraint invitationclaim_state_valid
  check(state in('reserved','proofpending','proved','consumed','expired','revoked'));
alter table identity.invitationclaim add constraint invitationclaim_proof_valid
  check(proof_method is null or proof_method in('otp','sso','terms'));
alter table identity.invitationclaim add constraint invitationclaim_lifecycle_valid check(
  (state='consumed' and consumed_at is not null and proved_at is not null)
  or (state='proved' and consumed_at is null and proved_at is not null)
  or (state in('reserved','proofpending','expired','revoked') and consumed_at is null)
);
alter table identity.invitationclaim add constraint invitationclaim_pending_proof_valid
  check(state<>'proofpending' or proof_method is not null);

drop index identity.identity_invitationclaim_active;
create unique index identity_invitationclaim_open on identity.invitationclaim(invitation_id)
  where state in('reserved','proofpending','proved');
create index identity_invitationclaim_expiry on identity.invitationclaim(state,expires_at,id)
  where state in('reserved','proofpending');
create index identity_preauth_invitation_expiry on identity.preauth(purpose,state,expires_at,id)
  where purpose in('invitationproof','enrollment') and state='active';

create policy jobdefinitionmigration on runtime.jobdefinition for all to shopmigration using(true) with check(true);
insert into runtime.jobdefinition(kind,owner,queue,concurrency,timeout_ms,retry_attempts,lease_seconds,resource_lease,dead_letter,runbook)
values('invitationcleanup','identity','maintenance',2,60000,8,90,false,'runtime.deadletter','docs/operations/invitationcleanup.md');
update runtime.schemaversion set checksum='da6a692837b03e7b15416e82788e3b0764e277644e7e57c6b900cba0c048a57d'
where version='20260830105000';

select runtime.record_migration_evidence('20260830106000',1,
  (select count(*) from runtime.jobdefinition where kind='invitationcleanup'),0,0,
  'create index concurrently if not exists identity_invitationclaim_expiry_live on identity.invitationclaim(state,expires_at,id) where state in(''reserved'',''proofpending'');',
  'select status,count(*) from identity.invitation group by status order by status;');
insert into runtime.schemaversion(version,checksum)
values('20260830106000',encode(public.digest('20260830106000_harden_invitation_lifecycle','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.invitation where status='reserved' or version<1) then
    raise exception 'INVITATION_LIFECYCLE_INVALID';
  end if;
  if exists(select 1 from identity.invitationclaim where state='active') then
    raise exception 'INVITATION_CLAIM_LIFECYCLE_INVALID';
  end if;
  if not exists(select 1 from runtime.jobdefinition where kind='invitationcleanup' and owner='identity'
    and queue='maintenance' and concurrency=2 and timeout_ms=60000) then
    raise exception 'INVITATION_CLEANUP_JOB_INVALID';
  end if;
end $assert$;

drop policy jobdefinitionmigration on runtime.jobdefinition;

commit;
