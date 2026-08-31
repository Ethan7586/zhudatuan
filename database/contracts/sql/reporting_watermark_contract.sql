begin;
insert into reporting.watermark(projection,scope_id,event_id,occurred_at,version,stale_after,advanced_at)
values('contract','contract:scope','contract:event:1',clock_timestamp(),1,interval '2 minutes',clock_timestamp());
update reporting.watermark set event_id='contract:event:2',occurred_at=occurred_at+interval '1 second',version=2,advanced_at=clock_timestamp()
where projection='contract' and scope_id='contract:scope';
do $contract$ begin
  begin
    update reporting.watermark set occurred_at=occurred_at-interval '1 hour',version=3
    where projection='contract' and scope_id='contract:scope';
    raise exception 'REPORTING_WATERMARK_REGRESSION_ACCEPTED';
  exception when others then if sqlerrm='REPORTING_WATERMARK_REGRESSION_ACCEPTED' then raise; end if; end;
end $contract$;
rollback;
