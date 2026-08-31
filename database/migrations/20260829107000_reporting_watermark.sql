begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829106000') then raise exception 'REPORTING_WATERMARK_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829107000') or to_regclass('reporting.watermark') is not null then
    raise exception 'REPORTING_WATERMARK_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table reporting_reconcile on commit drop as select count(*)::bigint rows,0::numeric minor from runtime.projectionoffset;
create table reporting.watermark(
  projection text not null,
  scope_id text not null,
  event_id text not null,
  occurred_at timestamptz not null,
  version bigint not null check(version>0),
  stale_after interval not null check(stale_after between interval '1 second' and interval '24 hours'),
  advanced_at timestamptz not null,
  primary key(projection,scope_id)
);
alter table reporting.watermark alter column stale_after set default interval '2 minutes';
insert into reporting.watermark(projection,scope_id,event_id,occurred_at,version,stale_after,advanced_at)
select projection,shard,offset_value,watermark,greatest(version,1),interval '2 minutes',clock_timestamp()
from runtime.projectionoffset;
alter table reporting.watermark add constraint reporting_watermark_event check(length(event_id) between 1 and 255) not valid;
alter table reporting.watermark validate constraint reporting_watermark_event;

create or replace function reporting.enforce_watermark() returns trigger language plpgsql set search_path=reporting,pg_temp as $function$
begin
  if tg_op='UPDATE' and (new.occurred_at<old.occurred_at or new.version<=old.version) then
    raise exception 'REPORTING_WATERMARK_REGRESSION';
  end if;
  return new;
end $function$;
create trigger reporting_watermark_monotonic before update on reporting.watermark for each row execute function reporting.enforce_watermark();
create index reporting_watermark_staleness on reporting.watermark(occurred_at,scope_id,projection);
alter table reporting.watermark enable row level security;
create policy appselect on reporting.watermark for select to shopapp using(access.scope_allowed(scope_id));
create policy jobscope on reporting.watermark for all to shopjob using(true) with check(true);
grant select on reporting.watermark to shopapp;
grant select,insert,update on reporting.watermark to shopjob;

select runtime.record_migration_evidence('20260829107000',(select rows from reporting_reconcile),(select count(*) from reporting.watermark),0,0,
  'create index concurrently if not exists reporting_watermark_staleness_live on reporting.watermark(occurred_at,scope_id,projection);',
  'select projection,scope_id from reporting.watermark where occurred_at+stale_after<clock_timestamp();');
insert into runtime.schemaversion(version,checksum)
values('20260829107000',encode(public.digest('20260829107000_reporting_watermark','sha256'),'hex'));

commit;
