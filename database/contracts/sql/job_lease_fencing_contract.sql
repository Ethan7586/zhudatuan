begin;
insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,idempotency_key,
  authorization_snapshot,retention_until,version,created_by,updated_by,created_at,updated_at)
values('job:contract','tenant:contract','contract:scope','contractjob','contract','contract','{}','queued',1,clock_timestamp(),
  'contract:job','{"kind":"system","actor":"contract","scope":"contract:scope","operation":"runtime.contract","source":"jobs","capturedAt":"2026-09-05T00:00:00.000Z"}',
  clock_timestamp()+interval '1 day',1,'contract','contract',clock_timestamp(),clock_timestamp());
select id from runtime.claim_job('contractjob','contract:worker:1',1,5,'jobs');
update runtime.jobs set lease_deadline=clock_timestamp()-interval '1 second' where id='job:contract';
select id from runtime.claim_job('contractjob','contract:worker:2',1,5,'jobs');
do $contract$ begin
  if not exists(select 1 from runtime.jobs where id='job:contract' and lease_owner='contract:worker:2' and fencing_token=2) then
    raise exception 'JOB_STALE_WORKER_FENCING_INVALID';
  end if;
end $contract$;
rollback;
