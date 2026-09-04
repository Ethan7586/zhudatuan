begin;

create table qualification.policy(
  id text primary key,
  scope_id text not null,
  name text not null,
  status text not null check(status in('draft','published','retired')),
  active_version integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,name)
);
create table qualification.profile(
  member_id text primary key,
  scope_id text not null,
  city_code text,
  city_name text,
  attributes jsonb not null check(jsonb_typeof(attributes)='object'),
  status text not null check(status in('active','disabled')),
  version bigint not null check(version>0),
  updated_at timestamptz not null
);
create table qualification.tag(
  member_id text not null references qualification.profile(member_id),
  code text not null,
  source text not null,
  effective_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null,
  primary key(member_id,code)
);
create table qualification.policyversion(
  policy_id text not null references qualification.policy(id),
  version integer not null check(version>0),
  rule jsonb not null check(jsonb_typeof(rule)='object'),
  rule_hash char(64) not null,
  published_at timestamptz,
  created_by text not null,
  primary key(policy_id,version),
  unique(policy_id,rule_hash)
);
create table qualification.subject(
  policy_id text not null,
  policy_version integer not null,
  kind text not null,
  selector jsonb not null,
  primary key(policy_id,policy_version,kind,selector),
  foreign key(policy_id,policy_version) references qualification.policyversion(policy_id,version)
);
create table qualification.resource(
  policy_id text not null,
  policy_version integer not null,
  kind text not null,
  resource_id text not null,
  primary key(policy_id,policy_version,kind,resource_id),
  foreign key(policy_id,policy_version) references qualification.policyversion(policy_id,version)
);
create table qualification.purchaselimit(
  policy_id text not null,
  policy_version integer not null,
  period text not null check(period in('order','day','week','month','lifetime')),
  quantity bigint,
  amount_minor bigint,
  currency char(3),
  check(quantity is not null or amount_minor is not null),
  check(amount_minor is null or currency is not null),
  foreign key(policy_id,policy_version) references qualification.policyversion(policy_id,version)
);
create table qualification.evidence(
  id text primary key,
  member_id text not null,
  resource_id text not null,
  policy_id text not null,
  policy_version integer not null,
  decision text not null check(decision in('eligible','ineligible','review')),
  facts jsonb not null,
  facts_hash char(64) not null,
  decided_at timestamptz not null,
  expires_at timestamptz,
  foreign key(policy_id,policy_version) references qualification.policyversion(policy_id,version)
);
create table qualification.changerequest(
  id text primary key,
  policy_id text references qualification.policy(id),
  target_kind text not null,
  target_id text,
  proposed_version integer not null,
  state text not null check(state in('draft','submitted','approved','rejected','applied')),
  requested_by text not null,
  decided_by text,
  requested_at timestamptz not null,
  decided_at timestamptz,
  reason text not null,
  risk text not null check(risk in('high','critical')),
  proposal jsonb not null check(jsonb_typeof(proposal)='object'),
  preview jsonb not null check(jsonb_typeof(preview)='object'),
  decision_reason text,
  applied_result jsonb,
  idempotency_key text not null unique,
  request_hash char(64) not null
);

do $$ declare item record; begin for item in select tablename from pg_tables where schemaname='qualification' loop execute format('alter table qualification.%I enable row level security',item.tablename); end loop; end $$;
commit;
