begin;

create table payment.tender(
  id text primary key,
  kind text not null check(kind in('wechat','benefit','voucher','external')),
  provider text,
  currency char(3) not null,
  status text not null check(status in('active','disabled'))
);
create table payment.intent(
  id text primary key,
  order_id text not null,
  member_id text not null,
  currency char(3) not null,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('created','authorizing','authorized','captured','failed','cancelled','expired')),
  idempotency_key text not null,
  provider_reference text not null unique,
  expires_at timestamptz not null,
  version bigint not null default 0,
  unique(order_id,idempotency_key)
);
create table payment.attempt(
  id text primary key,
  intent_id text not null references payment.intent(id),
  tender_id text not null references payment.tender(id),
  provider text not null,
  external_transaction text,
  state text not null check(state in('started','pending','succeeded','failed','unknown')),
  requested_at timestamptz not null,
  completed_at timestamptz,
  unique(provider,external_transaction)
);
create table payment.prepay(
  intent_id text primary key references payment.intent(id),
  parameters jsonb not null check(jsonb_typeof(parameters)='object'),
  provider_request_id text,
  created_at timestamptz not null
);
create table payment.observation(
  id text primary key,
  attempt_id text not null references payment.attempt(id),
  provider_event_id text not null,
  state text not null,
  amount_minor bigint not null check(amount_minor>=0),
  currency char(3) not null,
  payload_hash char(64) not null,
  observed_at timestamptz not null,
  unique(provider_event_id)
);
create table payment.providerattempt(
  id text primary key,
  refund_id text not null,
  sequence integer not null check(sequence>0),
  operation text not null,
  worker_id text not null,
  outcome text not null,
  provider_state text,
  provider_reference text,
  request_id text,
  error_code text,
  started_at timestamptz not null,
  completed_at timestamptz,
  unique(refund_id,sequence)
);
create table payment.effect(
  id text primary key,
  order_id text not null,
  payment_id text not null,
  kind text not null check(kind in('accounting','fulfillment','notification')),
  state text not null check(state in('pending','processing','succeeded','deadletter','ignored')),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  available_at timestamptz not null,
  attempts integer not null check(attempts>=0),
  error_code text,
  completed_at timestamptz,
  deadlettered_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table payment.capture(
  id text primary key,
  scope_id text not null,
  mall_id text not null,
  member_id text not null,
  order_id text not null unique,
  source text not null,
  currency char(3) not null,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('succeeded')),
  idempotency_key text not null,
  completed_at timestamptz not null,
  created_at timestamptz not null,
  unique(scope_id,mall_id,idempotency_key)
);
create table payment.payment(
  id text primary key,
  intent_id text not null unique references payment.intent(id),
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  captured_minor bigint not null default 0 check(captured_minor>=0 and captured_minor<=amount_minor),
  refunded_minor bigint not null default 0 check(refunded_minor>=0 and refunded_minor<=captured_minor),
  state text not null check(state in('authorized','captured','partially_refunded','refunded','cancelled')),
  version bigint not null default 0
);
create table payment.allocation(
  payment_id text not null references payment.payment(id),
  target_type text not null,
  target_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  primary key(payment_id,target_type,target_id)
);
create table payment.refund(
  id text primary key,
  payment_id text not null references payment.payment(id),
  provider text not null,
  provider_reference text not null unique,
  external_transaction text,
  idempotency_key text not null,
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  state text not null check(state in('requested','submitted','processing','succeeded','failed','cancelled')),
  reason text not null,
  version bigint not null default 0,
  unique(payment_id,idempotency_key),
  unique(provider,external_transaction)
);
create table payment.refundcommand(
  id text primary key,
  refund_id text not null references payment.refund(id),
  aftersale_id text not null,
  order_id text not null,
  attempt_id text not null,
  external_refund_number text not null unique,
  external_trade_number text not null,
  transaction_id text not null,
  payment_total_minor bigint not null check(payment_total_minor>0),
  next_operation text not null check(next_operation in('apply','query')),
  provider_state text,
  provider_refund_id text,
  provider_request_id text,
  attempts integer not null check(attempts>=0),
  state text not null,
  available_at timestamptz not null,
  error_code text,
  completed_at timestamptz,
  idempotency_key text not null,
  request_hash text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table payment.deadletterreview(
  id text primary key,
  deadletter_id text not null unique,
  payment_id text,
  refund_id text,
  decision text check(decision in('replay','ignore','repair')),
  evidence jsonb not null,
  reviewed_by text,
  reviewed_at timestamptz
);
create table payment.recoverycase(
  id text primary key,
  scope_id text not null,
  order_id text,
  resource_type text not null,
  resource_id text not null,
  severity text not null check(severity in('high','critical')),
  state text not null check(state in('open','resolved')),
  error_code text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  occurrence_count integer not null check(occurrence_count>0),
  opened_at timestamptz not null,
  resolved_at timestamptz,
  resolution_request_id text,
  unique(resource_type,resource_id)
);
create table payment.recoveryrequest(
  id text primary key,
  case_id text references payment.recoverycase(id),
  scope_id text not null,
  actor_id text not null,
  membership_id text not null,
  reason text not null,
  evidence_hash char(64) not null,
  trace_id text not null unique,
  created_at timestamptz not null
);

create table voucher.program(
  id text primary key,
  scope_id text not null,
  name text not null,
  value_minor bigint not null check(value_minor>=0),
  default_valid_days integer not null check(default_valid_days between 1 and 3650),
  currency char(3) not null,
  status text not null check(status in('draft','active','paused','retired')),
  approval_required boolean not null,
  version bigint not null default 0
);
create table voucher.cardpool(
  id text primary key,
  scope_id text not null,
  code_prefix text not null,
  next_sequence bigint not null check(next_sequence>0),
  provider text,
  status text not null check(status in('draft','ready','depleted','disabled')),
  version bigint not null default 0
);
create table voucher.issuebatch(
  id text primary key,
  program_id text not null references voucher.program(id),
  cardpool_id text references voucher.cardpool(id),
  state text not null check(state in('draft','approval','approved','issuing','completed','failed','cancelled')),
  requested_count integer not null check(requested_count>0),
  issued_count integer not null default 0 check(issued_count>=0),
  created_at timestamptz not null
);
create table voucher.reserverequest(
  id text primary key,
  request_number text not null unique,
  scope_id text not null,
  program_id text not null references voucher.program(id),
  requested_count integer not null check(requested_count>0),
  requested_minor bigint not null check(requested_minor>0),
  reason text not null,
  state text not null check(state in('draft','submitted','approved','rejected','cancelled','fulfilled')),
  requested_by text not null,
  submitted_at timestamptz,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table voucher.approval(
  id text primary key,
  request_id text not null references voucher.reserverequest(id),
  sequence integer not null check(sequence>0),
  decision text not null check(decision in('approved','rejected')),
  reason text not null,
  evidence text,
  actor_id text not null,
  membership_id text not null,
  grant_evidence jsonb not null check(jsonb_typeof(grant_evidence)='object'),
  trace_id text not null,
  occurred_at timestamptz not null,
  unique(request_id,sequence)
);
create table voucher.voucher(
  id text primary key,
  program_id text not null references voucher.program(id),
  batch_id text not null references voucher.issuebatch(id),
  member_id text,
  code_ciphertext text not null,
  code_fingerprint char(64) not null unique,
  code_key_version text not null,
  initial_minor bigint not null check(initial_minor>0),
  remaining_minor bigint not null check(remaining_minor>=0 and remaining_minor<=initial_minor),
  state text not null check(state in('created','active','bound','reserved','redeemed','expired','void')),
  expires_at timestamptz not null,
  version bigint not null default 0
);
create table voucher.statusevent(
  voucher_id text not null references voucher.voucher(id),
  sequence bigint not null,
  previous_state text,
  next_state text not null,
  reason text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  primary key(voucher_id,sequence)
);
create table voucher.reserve(
  id text primary key,
  voucher_id text not null references voucher.voucher(id),
  owner_id text not null,
  state text not null check(state in('requested','approved','rejected','released','consumed')),
  expires_at timestamptz not null,
  version bigint not null default 0,
  unique(voucher_id,owner_id)
);
create table voucher.redemption(
  id text primary key,
  voucher_id text not null references voucher.voucher(id),
  verification_id text not null unique,
  order_id text,
  amount_minor bigint not null check(amount_minor>=0),
  redeemed_at timestamptz not null,
  reversed_at timestamptz,
  version bigint not null default 0
);
create table voucher.reversal(
  id text primary key,
  redemption_id text not null unique references voucher.redemption(id),
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('requested','approved','rejected','reversed')),
  reason text not null,
  evidence jsonb not null,
  occurred_at timestamptz not null
);
create table voucher.hold(
  id text primary key,
  voucher_id text not null unique references voucher.voucher(id),
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('open','reconciled')),
  reason text not null,
  reconciliation_reference text,
  evidence jsonb not null,
  created_at timestamptz not null,
  reconciled_at timestamptz,
  check((state='open' and reconciled_at is null) or (state='reconciled' and reconciled_at is not null))
);

create table benefit.account(
  id text primary key,
  member_id text not null,
  scope_id text not null,
  kind text not null check(kind in('welfare','meal','allowance')),
  currency char(3) not null,
  status text not null check(status in('active','frozen','closed')),
  version bigint not null default 0,
  unique(member_id,scope_id,kind,currency)
);
create table benefit.plan(
  id text primary key,
  scope_id text not null,
  name text not null,
  kind text not null check(kind in('welfare','meal','allowance')),
  currency char(3) not null,
  state text not null check(state in('draft','active','paused','retired')),
  version bigint not null default 0,
  unique(scope_id,name)
);
create table benefit.budget(
  id text primary key,
  plan_id text not null references benefit.plan(id),
  period text not null,
  total_minor bigint not null check(total_minor>=0),
  granted_minor bigint not null default 0 check(granted_minor>=0 and granted_minor<=total_minor),
  version bigint not null default 0,
  unique(plan_id,period)
);
create table benefit.grantbatch(
  id text primary key,
  plan_id text not null references benefit.plan(id),
  budget_id text not null references benefit.budget(id),
  state text not null check(state in('submitted','approved','rejected','running','completed','failed','cancelled')),
  requested_by text not null,
  approved_by text,
  requested_count integer not null check(requested_count>0),
  amount_minor bigint not null check(amount_minor>0),
  reason text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(approved_by is null or approved_by<>requested_by)
);
create table benefit.grantitem(
  batch_id text not null references benefit.grantbatch(id),
  member_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('queued','granted','failed','skipped')),
  error_code text,
  primary key(batch_id,member_id)
);
create table benefit.grantdecision(
  batch_id text not null references benefit.grantbatch(id),
  sequence integer not null,
  decision text not null check(decision in('approved','rejected')),
  actor_id text not null,
  membership_id text not null,
  reason text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  trace_id text not null,
  occurred_at timestamptz not null,
  primary key(batch_id,sequence)
);
create table benefit.entry(
  id text primary key,
  account_id text not null references benefit.account(id),
  kind text not null check(kind in('grant','reserve','release','consume','expire','adjust')),
  amount_minor bigint not null check(amount_minor<>0),
  reference_type text not null,
  reference_id text not null,
  occurred_at timestamptz not null,
  unique(account_id,kind,reference_type,reference_id)
);
create table benefit.reservation(
  id text primary key,
  account_id text not null references benefit.account(id),
  owner_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('active','consumed','released','expired')),
  expires_at timestamptz not null,
  unique(account_id,owner_id)
);

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('payment','voucher','benefit') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
