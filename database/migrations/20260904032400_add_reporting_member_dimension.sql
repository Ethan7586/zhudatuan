begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032300') then raise exception 'REPORTING_MEMBER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032400') then raise exception 'REPORTING_MEMBER_ALREADY_APPLIED'; end if;
  if exists(select 1 from runtime.operation where id='reporting.powderclass.read')
    or exists(select 1 from capability.capability where id='reporting.powderclass.read')
    or exists(select 1 from access.permission where code='reporting.powderclass.read')
    or exists(select 1 from reporting.metric where id='powderclass.amount') then
    raise exception 'REPORTING_REMOVED_DIMENSION_PRESENT';
  end if;
end
$precondition$;

insert into reporting.metric(id,version,name,unit,formula,definition_link,dimensions,granularity,timezone_policy,owner) values
  ('member.amount',1,'会员成交金额','minor','按订单支付事件中的购买会员汇总支付金额','docs/metrics/catalog.md','["customer","member","mall","application"]','day','event','reporting'),
  ('member.orders',1,'会员支付订单','count','按订单支付事件中的购买会员统计去重支付订单数','docs/metrics/catalog.md','["customer","member","mall","application"]','day','event','reporting');

select runtime.record_migration_evidence(
  '20260904032400',0,0,0,0,
  'select id,version,name,formula,dimensions,granularity,timezone_policy,unit,owner from reporting.metric where id like ''member.%'' order by id;',
  'select metric_id,scope_id,dimensions,value_numeric,currency,watermark from reporting.fact where metric_id like ''member.%'' order by watermark desc limit 50;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904032400',encode(public.digest('20260904032400_add_reporting_member_dimension','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from reporting.metric where id in('member.amount','member.orders') and version=1 and owner='reporting' and granularity='day' and timezone_policy='event')<>2 then
    raise exception 'REPORTING_MEMBER_METRICS_MISSING';
  end if;
  if exists(select 1 from runtime.operation where id='reporting.powderclass.read')
    or exists(select 1 from capability.capability where id='reporting.powderclass.read')
    or exists(select 1 from access.permission where code='reporting.powderclass.read')
    or exists(select 1 from reporting.metric where id='powderclass.amount') then
    raise exception 'REPORTING_REMOVED_DIMENSION_RESTORED';
  end if;
end
$assert$;

commit;
