begin;
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,scope_id,payload,trace_id,occurred_at,available_at)
values('contract:outbox:1','identity.session.created',1,'contract','contract:aggregate',1,'contract:scope','{}','contract:trace',clock_timestamp(),clock_timestamp());
update runtime.outbox set claimed_by='contract:worker',claim_until=clock_timestamp()+interval '30 seconds',fencing_token=fencing_token+1
where id='contract:outbox:1';
do $contract$ begin
  if not exists(select 1 from runtime.outbox where id='contract:outbox:1' and fencing_token=1) then
    raise exception 'OUTBOX_FENCING_TOKEN_INVALID';
  end if;
  begin
    insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,scope_id,payload,trace_id,occurred_at,available_at)
    values('contract:outbox:2','identity.session.created',1,'contract','contract:aggregate',1,'contract:scope','{}','contract:trace',clock_timestamp(),clock_timestamp());
    raise exception 'OUTBOX_AGGREGATE_DUPLICATE_ACCEPTED';
  exception when unique_violation then null; end;
end $contract$;
rollback;
