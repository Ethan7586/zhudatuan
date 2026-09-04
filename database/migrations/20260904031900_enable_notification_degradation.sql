begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031800') then raise exception 'NOTIFICATION_DEGRADATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031900') then raise exception 'NOTIFICATION_DEGRADATION_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table notification.attempt add column route_index integer;
update notification.attempt set route_index=1;
alter table notification.attempt alter column route_index set not null;
alter table notification.attempt add constraint notification_attempt_route check(route_index between 1 and 20);
drop index notification.notification_attempt_dispatch_sequence;
create index notification_attempt_dispatch_sequence on notification.attempt(dispatch_id,sequence,route_index,attempted_at);

select runtime.record_migration_evidence(
  '20260904031900',0,0,0,0,
  'select dispatch_id,sequence,route_index,provider,state,error_class,error_code from notification.attempt order by dispatch_id,sequence,route_index,attempted_at;',
  'select id,state,attempt_count,max_attempts,last_error_class,last_error_code from notification.dispatch order by scope_id,id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904031900',encode(public.digest('20260904031900_enable_notification_degradation','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from notification.attempt where route_index is null or route_index<1) then raise exception 'NOTIFICATION_ATTEMPT_ROUTE_INVALID'; end if;
end
$assert$;

commit;
