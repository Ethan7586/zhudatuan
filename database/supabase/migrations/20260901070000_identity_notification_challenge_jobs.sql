begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-notification-challenge-jobs:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_NOTIFICATION_CHALLENGE_JOBS_DATABASE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260901060000'
      and checksum='7df7a9d670de5071431a8f3539582f05fd949336f530ce7781adff5d76dc2097')
    or exists(select 1 from runtime.schemaversion where version>'20260901060000') then
    raise exception 'IDENTITY_NOTIFICATION_CHALLENGE_JOBS_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

update runtime.job job
set kind='identitynotification',updated_at=clock_timestamp()
where job.kind='notification'
  and job.owner='identity'
  and job.state='queued'
  and jsonb_typeof(job.payload)='object'
  and job.payload ? 'challenge'
  and job.payload-'challenge'='{}'::jsonb
  and exists(select 1 from identity.challenge challenge where challenge.id=job.payload->>'challenge');

insert into runtime.schemaversion(version,checksum)
values('20260901070000','f00c95f5eb787b621b6ef72468611ba6827523aaf622beae06935b3f9af9059f');

do $assert$
begin
  if exists(select 1 from runtime.job
    where kind='notification' and owner='identity' and state='queued' and payload ? 'challenge') then
    raise exception 'IDENTITY_NOTIFICATION_CHALLENGE_JOBS_NOT_REPAIRED';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260901070000'
      and checksum='f00c95f5eb787b621b6ef72468611ba6827523aaf622beae06935b3f9af9059f') then
    raise exception 'IDENTITY_NOTIFICATION_CHALLENGE_JOBS_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
