begin;
insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
values('contract:job','contractjob','contract','contract:scope','{}','queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp());
select id from runtime.claim_job('contractjob','contract:worker:1',1,5,'jobs');
update runtime.job set lease_deadline=clock_timestamp()-interval '1 second' where id='contract:job';
select id from runtime.claim_job('contractjob','contract:worker:2',1,5,'jobs');
do $contract$ begin
  if not exists(select 1 from runtime.job where id='contract:job' and lease_owner='contract:worker:2' and fencing_token=2) then
    raise exception 'JOB_STALE_WORKER_FENCING_INVALID';
  end if;
end $contract$;
rollback;
