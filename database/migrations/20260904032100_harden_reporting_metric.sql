begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032000') then raise exception 'REPORTING_METRIC_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032100') then raise exception 'REPORTING_METRIC_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table reporting.metric rename column definition to formula;
alter table reporting.metric add column granularity text not null default 'day';
alter table reporting.metric add column timezone_policy text not null default 'event';
alter table reporting.metric add column owner text not null default 'reporting';
alter table reporting.metric alter column granularity drop default;
alter table reporting.metric alter column timezone_policy drop default;
alter table reporting.metric alter column owner drop default;

update reporting.metric set dimensions=case id
  when 'sales.amount' then '["mall","application"]'::jsonb
  when 'sales.orders' then '["mall","application"]'::jsonb
  when 'refund.amount' then '["mall","application"]'::jsonb
  when 'refund.orders' then '["mall","application"]'::jsonb
  when 'mall.amount' then '["mall","application"]'::jsonb
  when 'product.amount' then '["mall","application","product"]'::jsonb
  when 'category.amount' then '["mall","application","category"]'::jsonb
  when 'channel.amount' then '["mall","application","channel"]'::jsonb
  when 'voucher.amount' then '["voucherScope","channel","currency","store"]'::jsonb
  when 'voucher.redemptions' then '["voucherScope","channel","currency","store"]'::jsonb
  else dimensions end;

insert into reporting.metric(id,version,name,unit,formula,definition_link,dimensions,granularity,timezone_policy,owner) values
  ('voucher.refund.amount',1,'卡券退款金额','minor','卡券退款完成事件的退款金额合计','docs/metrics/voucherrefundamount.md','["voucherScope","channel","currency","store"]','day','event','reporting'),
  ('voucher.refunds',1,'卡券退款次数','count','卡券退款完成事件的去重次数','docs/metrics/voucherrefunds.md','["voucherScope","channel","currency","store"]','day','event','reporting');

alter table reporting.metric add constraint reporting_metric_formula check(length(btrim(formula)) between 1 and 2000);
alter table reporting.metric add constraint reporting_metric_granularity check(granularity='day');
alter table reporting.metric add constraint reporting_metric_timezone check(timezone_policy='event');
alter table reporting.metric add constraint reporting_metric_owner check(owner='reporting');
alter table reporting.metric add constraint reporting_metric_dimensions check(
  jsonb_typeof(dimensions)='array' and jsonb_array_length(dimensions)>0
);
alter table reporting.fact add constraint reporting_fact_currency check(
  (currency is null and metric_id not like '%.amount') or currency~'^[A-Z]{3}$'
);

create function reporting.reject_metric_mutation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  raise exception 'REPORTING_METRIC_VERSION_IMMUTABLE';
end
$function$;
revoke all on function reporting.reject_metric_mutation() from public,shopapp,shopjob;
create trigger reporting_metric_immutable before update or delete on reporting.metric
for each row execute function reporting.reject_metric_mutation();

alter table reporting.metric force row level security;
alter table reporting.fact force row level security;
create policy migrationaccess on reporting.metric for all to shopmigration using(true) with check(true);
create policy migrationaccess on reporting.fact for all to shopmigration using(true) with check(true);
revoke insert,update,delete on reporting.metric from shopapp,shopjob;
grant select on reporting.metric to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260904032100',0,0,0,0,
  'select id,version,name,formula,dimensions,granularity,timezone_policy,unit,owner from reporting.metric order by id,version;',
  'select metric_id,metric_version,timezone,currency,watermark,projection_version from reporting.fact order by watermark desc limit 50;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904032100',encode(public.digest('20260904032100_harden_reporting_metric','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from reporting.metric where id in('voucher.refund.amount','voucher.refunds'))<>2 then raise exception 'REPORTING_VOUCHER_REFUND_METRICS_MISSING'; end if;
  if exists(select 1 from reporting.metric where formula='' or granularity<>'day' or timezone_policy<>'event' or owner<>'reporting') then raise exception 'REPORTING_METRIC_DEFINITION_INVALID'; end if;
  if (select count(*) from pg_trigger where tgrelid='reporting.metric'::regclass and tgname='reporting_metric_immutable' and not tgisinternal)<>1 then raise exception 'REPORTING_METRIC_IMMUTABILITY_MISSING'; end if;
end
$assert$;

commit;
