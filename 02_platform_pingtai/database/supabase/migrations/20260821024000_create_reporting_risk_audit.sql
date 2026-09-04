begin;

create table reporting.metric(
  id text not null,
  version integer not null check(version>0),
  name text not null,
  unit text not null,
  definition text not null,
  definition_link text not null,
  dimensions jsonb not null check(jsonb_typeof(dimensions)='array'),
  primary key(id,version)
);
insert into reporting.metric(id,version,name,unit,definition,definition_link,dimensions) values
  ('sales.amount',1,'成交金额','minor','支付成功订单的应付金额','05_docs_ziliao/docs_wendang/metrics/salesamount.md','["mall"]'),
  ('sales.orders',1,'成交订单数','count','支付成功的去重订单数','05_docs_ziliao/docs_wendang/metrics/salesorders.md','["mall"]'),
  ('refund.amount',1,'退款金额','minor','退款成功的原路退款金额','05_docs_ziliao/docs_wendang/metrics/refundamount.md','["mall"]'),
  ('refund.orders',1,'退款单数','count','退款成功的去重退款单数','05_docs_ziliao/docs_wendang/metrics/refundorders.md','["mall"]'),
  ('voucher.amount',1,'卡券消费金额','minor','核销成功的卡券消费金额','05_docs_ziliao/docs_wendang/metrics/voucheramount.md','["mall","store"]'),
  ('voucher.redemptions',1,'卡券消费次数','count','核销成功的卡券次数','05_docs_ziliao/docs_wendang/metrics/voucherredemptions.md','["mall","store"]'),
  ('product.amount',1,'商品成交金额','minor','订单行成交金额','05_docs_ziliao/docs_wendang/metrics/productamount.md','["product"]'),
  ('mall.amount',1,'商城成交金额','minor','按商城归集的成交金额','05_docs_ziliao/docs_wendang/metrics/mallamount.md','["mall"]'),
  ('category.amount',1,'分类成交金额','minor','按商品分类归集的订单行金额','05_docs_ziliao/docs_wendang/metrics/categoryamount.md','["category"]'),
  ('channel.amount',1,'供应渠道成交金额','minor','按供应Provider归集的订单行金额','05_docs_ziliao/docs_wendang/metrics/channelamount.md','["channel"]'),
  ('powderclass.amount',1,'粉类成交金额','minor','按工作簿原文粉类维度归集的订单行金额','05_docs_ziliao/docs_wendang/metrics/powderclassamount.md','["powderclass"]');
create table reporting.fact(
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
  projection_version bigint not null,
  primary key(metric_id,metric_version,scope_id,period_start,dimensions),
  foreign key(metric_id,metric_version) references reporting.metric(id,version)
);
create table reporting.export(
  id text primary key,
  scope_id text not null,
  report text not null,
  filter jsonb not null,
  state text not null check(state in('queued','running','completed','failed','expired')),
  object_ref text,
  sha256 char(64),
  expires_at timestamptz,
  created_at timestamptz not null
);
create table reporting.orderprojection(
  order_id text not null,
  scope_id text not null,
  order_number text not null,
  payment_state text not null,
  fulfillment_state text not null,
  aftersale_state text not null,
  lifecycle_state text not null,
  total_minor bigint not null,
  currency char(3) not null,
  occurred_at timestamptz not null,
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  watermark timestamptz not null,
  projection_version bigint not null,
  primary key(order_id,scope_id)
);
create table reporting.financeprojection(
  statement_id text primary key,
  scope_id text not null,
  period_start date not null,
  period_end date not null,
  currency char(3) not null,
  opening_minor bigint not null,
  debit_minor bigint not null,
  credit_minor bigint not null,
  closing_minor bigint not null,
  state text not null,
  watermark timestamptz not null,
  projection_version bigint not null
);

create table risk.policy(
  id text primary key,
  scope_id text not null,
  name text not null,
  active_version integer,
  status text not null check(status in('draft','active','retired')),
  unique(scope_id,name)
);
create table risk.policyversion(
  policy_id text not null references risk.policy(id),
  version integer not null,
  rule jsonb not null,
  rule_hash char(64) not null,
  primary key(policy_id,version)
);
create table risk.replay(
  policy_id text not null,
  candidate_version integer not null,
  state text not null check(state in('queued','running','passed','review','failed')),
  sample_count integer not null default 0 check(sample_count>=0),
  changed_count integer not null default 0 check(changed_count>=0),
  outcome_counts jsonb not null default '{}'::jsonb check(jsonb_typeof(outcome_counts)='object'),
  created_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  primary key(policy_id,candidate_version),
  foreign key(policy_id,candidate_version) references risk.policyversion(policy_id,version)
);
create table risk.signal(
  id text primary key,
  actor_id text,
  scope_id text not null,
  type text not null,
  value jsonb not null,
  observed_at timestamptz not null,
  expires_at timestamptz
);
create table risk.decision(
  id text primary key,
  operation text not null,
  actor_id text,
  resource_id text,
  policy_id text not null,
  policy_version integer not null,
  outcome text not null check(outcome in('allow','challenge','review','deny')),
  evidence jsonb not null,
  trace_id text not null,
  decided_at timestamptz not null,
  foreign key(policy_id,policy_version) references risk.policyversion(policy_id,version)
);
create table risk.case(
  id text primary key,
  decision_id text references risk.decision(id),
  state text not null check(state in('open','reviewing','cleared','confirmed','closed')),
  assigned_to text,
  created_at timestamptz not null,
  closed_at timestamptz
);
create table risk.listentry(
  id text primary key,
  list_type text not null,
  token char(64) not null,
  reason text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  unique(list_type,token,effective_at)
);

create table audit.record(
  id text not null,
  scope_id text not null,
  actor_id text,
  actor_type text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_hash char(64),
  after_hash char(64),
  evidence jsonb not null,
  trace_id text not null,
  previous_hash char(64),
  record_hash char(64) not null,
  recorded_at timestamptz not null,
  primary key(id,recorded_at)
) partition by range(recorded_at);
create table audit.recorddefault partition of audit.record default;
create table audit.accessrecord(
  id text primary key,
  actor_id text not null,
  resource_type text not null,
  resource_id text not null,
  fields jsonb not null,
  purpose text not null,
  trace_id text not null,
  accessed_at timestamptz not null
);
create table audit.archiveref(
  id text primary key,
  period_start date not null,
  period_end date not null,
  object_ref text not null,
  sha256 char(64) not null,
  record_count bigint not null check(record_count>=0),
  archived_at timestamptz not null,
  unique(period_start,period_end)
);

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('reporting','risk','audit') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
