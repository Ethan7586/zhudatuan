begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032200') then raise exception 'REPORTING_PROJECTION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032300') then raise exception 'REPORTING_PROJECTION_ALREADY_APPLIED'; end if;
end
$precondition$;

create table reporting.period(
  scope_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  timezone text not null,
  state text not null check(state in('open','closed')),
  last_event_id text not null,
  last_event_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(scope_id,period_start,timezone),
  check(period_end>period_start)
);

insert into reporting.period(scope_id,period_start,period_end,timezone,state,last_event_id,last_event_at,version)
select scope_id,period_start,max(period_end),timezone,'open','reporting:legacy:'||md5(scope_id||period_start::text||timezone),max(watermark),1
from reporting.fact group by scope_id,period_start,timezone;

create table reporting.factrevision(
  metric_id text not null,
  metric_version integer not null,
  scope_id text not null,
  dimensions jsonb not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  timezone text not null,
  value_numeric numeric(30,6) not null,
  currency char(3),
  watermark timestamptz not null,
  data_version bigint not null check(data_version>0),
  projection_version bigint not null check(projection_version>0),
  event_id text not null,
  recorded_at timestamptz not null,
  primary key(metric_id,metric_version,scope_id,period_start,dimensions,projection_version),
  unique(event_id,metric_id,metric_version,scope_id,period_start,dimensions),
  foreign key(metric_id,metric_version) references reporting.metric(id,version),
  foreign key(scope_id,period_start,timezone) references reporting.period(scope_id,period_start,timezone)
);

insert into reporting.factrevision(metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,
  watermark,data_version,projection_version,event_id,recorded_at)
select metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,watermark,
  coalesce((select version from reporting.watermark where projection='commerce' and scope_id=fact.scope_id),1),projection_version,
  'reporting:legacy:'||md5(metric_id||metric_version::text||scope_id||period_start::text||dimensions::text),clock_timestamp()
from reporting.fact fact;

create table reporting.orderrevision(
  order_id text not null,scope_id text not null,order_number text not null,payment_state text not null,fulfillment_state text not null,
  aftersale_state text not null,lifecycle_state text not null,total_minor bigint not null,currency char(3) not null,
  occurred_at timestamptz not null,snapshot jsonb not null,watermark timestamptz not null,data_version bigint not null,projection_version bigint not null,
  event_id text not null,recorded_at timestamptz not null,
  primary key(order_id,scope_id,projection_version),unique(event_id,order_id,scope_id)
);
insert into reporting.orderrevision(order_id,scope_id,order_number,payment_state,fulfillment_state,aftersale_state,lifecycle_state,
  total_minor,currency,occurred_at,snapshot,watermark,data_version,projection_version,event_id,recorded_at)
select order_id,scope_id,order_number,payment_state,fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,occurred_at,
  snapshot,watermark,coalesce((select version from reporting.watermark where projection='commerce' and scope_id=projection.scope_id),1),
  projection_version,'reporting:legacy:'||md5(order_id||scope_id),clock_timestamp() from reporting.orderprojection projection;

create table reporting.financerevision(
  statement_id text not null,scope_id text not null,period_start date not null,period_end date not null,currency char(3) not null,
  opening_minor bigint not null,debit_minor bigint not null,credit_minor bigint not null,closing_minor bigint not null,state text not null,
  watermark timestamptz not null,data_version bigint not null,projection_version bigint not null,event_id text not null,recorded_at timestamptz not null,
  primary key(statement_id,projection_version),unique(event_id,statement_id)
);
insert into reporting.financerevision(statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,
  closing_minor,state,watermark,data_version,projection_version,event_id,recorded_at)
select statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,watermark,
  coalesce((select version from reporting.watermark where projection='commerce' and scope_id=projection.scope_id),1),projection_version,
  'reporting:legacy:'||md5(statement_id),clock_timestamp() from reporting.financeprojection projection;

create index reporting_factrevision_snapshot on reporting.factrevision(scope_id,data_version,period_end desc,metric_id,metric_version);
create index reporting_orderrevision_snapshot on reporting.orderrevision(scope_id,data_version,order_id,projection_version desc);
create index reporting_financerevision_snapshot on reporting.financerevision(scope_id,data_version,statement_id,projection_version desc);
create index reporting_period_open on reporting.period(scope_id,last_event_at) where state='open';

create function reporting.reject_revision_mutation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  raise exception 'REPORTING_REVISION_IMMUTABLE';
end
$function$;
revoke all on function reporting.reject_revision_mutation() from public,shopapp,shopjob;
create trigger reporting_factrevision_immutable before update or delete on reporting.factrevision for each row execute function reporting.reject_revision_mutation();
create trigger reporting_orderrevision_immutable before update or delete on reporting.orderrevision for each row execute function reporting.reject_revision_mutation();
create trigger reporting_financerevision_immutable before update or delete on reporting.financerevision for each row execute function reporting.reject_revision_mutation();

alter table reporting.period enable row level security;
alter table reporting.period force row level security;
alter table reporting.factrevision enable row level security;
alter table reporting.factrevision force row level security;
alter table reporting.orderrevision enable row level security;
alter table reporting.orderrevision force row level security;
alter table reporting.financerevision enable row level security;
alter table reporting.financerevision force row level security;
create policy periodapp on reporting.period for select to shopapp using(access.scope_allowed(scope_id));
create policy periodjob on reporting.period for all to shopjob using(true) with check(true);
create policy factrevisionapp on reporting.factrevision for select to shopapp using(access.scope_allowed(scope_id));
create policy factrevisionjob on reporting.factrevision for all to shopjob using(true) with check(true);
create policy orderrevisionapp on reporting.orderrevision for select to shopapp using(access.scope_allowed(scope_id));
create policy orderrevisionjob on reporting.orderrevision for all to shopjob using(true) with check(true);
create policy financerevisionapp on reporting.financerevision for select to shopapp using(access.scope_allowed(scope_id));
create policy financerevisionjob on reporting.financerevision for all to shopjob using(true) with check(true);
revoke all on reporting.period,reporting.factrevision,reporting.orderrevision,reporting.financerevision from public;
grant select on reporting.period,reporting.factrevision,reporting.orderrevision,reporting.financerevision to shopapp;
grant select,insert,update on reporting.period to shopjob;
grant select,insert on reporting.factrevision,reporting.orderrevision,reporting.financerevision to shopjob;

select runtime.record_migration_evidence(
  '20260904032300',0,0,0,0,
  'select scope_id,period_start,period_end,timezone,state,last_event_id,last_event_at,version from reporting.period order by period_start desc;',
  'select event_id,metric_id,scope_id,watermark,projection_version from reporting.factrevision order by recorded_at desc limit 100;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904032300',encode(public.digest('20260904032300_version_reporting_projection','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from reporting.factrevision)<>(select count(*) from reporting.fact) then raise exception 'REPORTING_FACT_REVISION_BACKFILL_INVALID'; end if;
  if (select count(*) from reporting.orderrevision)<>(select count(*) from reporting.orderprojection) then raise exception 'REPORTING_ORDER_REVISION_BACKFILL_INVALID'; end if;
  if (select count(*) from reporting.financerevision)<>(select count(*) from reporting.financeprojection) then raise exception 'REPORTING_FINANCE_REVISION_BACKFILL_INVALID'; end if;
end
$assert$;

commit;
