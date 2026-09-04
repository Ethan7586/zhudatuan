begin;

create table finance.hold(
  id text primary key,
  scope_id text not null,
  account_id text not null references finance.account(id),
  owner_type text not null,
  owner_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('active','captured','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(account_id,owner_type,owner_id)
);

alter table finance.reconciliation drop constraint reconciliation_state_check;
alter table finance.reconciliation add constraint reconciliation_state_check
  check(state in('received','matching','balanced','difference','resolved','approved'));
alter table finance.reconciliation add column updated_at timestamptz not null default clock_timestamp();
alter table finance.reconciliation add column version bigint not null default 0;

create table finance.statementline(
  id text primary key,
  reconciliation_id text not null references finance.reconciliation(id),
  scope_id text not null,
  sequence integer not null check(sequence>0),
  external_reference text not null,
  kind text not null check(kind in('payment','refund','fulfillment','fee','adjustment')),
  amount_minor bigint not null check(amount_minor>0),
  tax_minor bigint not null default 0 check(tax_minor>=0),
  currency char(3) not null,
  occurred_at timestamptz,
  raw_hash char(64) not null,
  unique(reconciliation_id,sequence),
  unique(reconciliation_id,external_reference,kind)
);

create table finance.reconciliationitem(
  id text primary key,
  reconciliation_id text not null references finance.reconciliation(id),
  statement_line_id text not null unique references finance.statementline(id),
  scope_id text not null,
  internal_type text,
  internal_id text,
  external_minor bigint not null,
  internal_minor bigint not null,
  difference_minor bigint not null,
  state text not null check(state in('matched','difference','resolutionpending','resolved')),
  reason_code text,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  resolution jsonb,
  resolved_by text,
  approved_by text,
  resolved_at timestamptz,
  approved_at timestamptz,
  version bigint not null default 0,
  check((state in('matched','difference') and resolution is null and resolved_by is null and resolved_at is null and approved_by is null and approved_at is null)
    or (state='resolutionpending' and jsonb_typeof(resolution)='object' and resolved_by is not null and resolved_at is not null
      and approved_by is null and approved_at is null)
    or (state='resolved' and jsonb_typeof(resolution)='object' and resolved_by is not null and approved_by is not null
      and resolved_by<>approved_by and resolved_at is not null and approved_at is not null))
);

alter table finance.settlement add column scope_id text;
update finance.settlement settlement set scope_id=reconciliation.scope_id from finance.reconciliation reconciliation
where reconciliation.id=settlement.reconciliation_id;
alter table finance.settlement alter column scope_id set not null;
alter table finance.settlement add column requested_by text;
alter table finance.settlement add column approved_by text;
alter table finance.settlement add column frozen_at timestamptz;
alter table finance.settlement add column approved_at timestamptz;
alter table finance.settlement add column paid_at timestamptz;
alter table finance.settlement add column evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object');
alter table finance.settlement add column version bigint not null default 0;
alter table finance.settlement add column gross_minor bigint;
update finance.settlement set gross_minor=amount_minor;
alter table finance.settlement alter column gross_minor set not null;
alter table finance.settlement add column fee_minor bigint not null default 0 check(fee_minor>=0);
alter table finance.settlement add column invoice_basis text not null default 'gross' check(invoice_basis in('gross','net'));
alter table finance.settlement add check(amount_minor=gross_minor-fee_minor and amount_minor>0);
alter table finance.settlement add check(approved_by is null or approved_by<>requested_by);

create table finance.settlementline(
  id text primary key,
  settlement_id text not null references finance.settlement(id),
  reconciliation_item_id text not null references finance.reconciliationitem(id),
  scope_id text not null,
  source_type text not null,
  source_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  invoice_minor bigint not null check(invoice_minor>=0),
  tax_minor bigint not null default 0 check(tax_minor>=0),
  direction text not null default 'increase' check(direction in('increase','decrease')),
  state text not null check(state in('frozen','adjusted')),
  adjustment_of text references finance.settlementline(id),
  created_at timestamptz not null,
  unique(settlement_id,reconciliation_item_id,adjustment_of)
);

create table finance.settlementadjustment(
  id text primary key,
  settlement_id text not null references finance.settlement(id),
  settlement_line_id text not null references finance.settlementline(id),
  scope_id text not null,
  direction text not null check(direction in('increase','decrease')),
  amount_minor bigint not null check(amount_minor>0),
  tax_minor bigint not null default 0 check(tax_minor>=0),
  state text not null check(state in('pending','approved','rejected')),
  requested_by text not null,
  approved_by text,
  reason text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  created_at timestamptz not null,
  decided_at timestamptz,
  version bigint not null default 0,
  check(approved_by is null or approved_by<>requested_by),
  check((state='pending' and approved_by is null and decided_at is null)
    or (state in('approved','rejected') and approved_by is not null and decided_at is not null))
);

create table finance.split(
  id text primary key,
  settlement_id text not null references finance.settlement(id),
  scope_id text not null,
  beneficiary_type text not null check(beneficiary_type in('partner','platform')),
  beneficiary_id text not null,
  amount_minor bigint not null check(amount_minor>=0),
  basis_points integer not null check(basis_points between 0 and 10000),
  state text not null check(state in('frozen','paid')),
  created_at timestamptz not null,
  unique(settlement_id,beneficiary_type,beneficiary_id)
);

create table finance.withdrawal(
  id text primary key,
  scope_id text not null,
  settlement_id text not null references finance.settlement(id),
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  destination_ref text not null,
  state text not null check(state in('submitted','approved','processing','paid','rejected','failed','uncertain','cancelled')),
  requested_by text not null,
  approved_by text,
  reason text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  provider_reference text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  paid_at timestamptz,
  version bigint not null default 0,
  unique(settlement_id,destination_ref),
  check(approved_by is null or approved_by<>requested_by)
);

create table finance.periodclose(
  id text primary key,
  scope_id text not null,
  period text not null,
  state text not null check(state in('pending','approved','rejected')),
  source_hash char(64) not null,
  requested_by text not null,
  approved_by text,
  reason text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  requested_at timestamptz not null,
  decided_at timestamptz,
  version bigint not null default 0,
  unique(scope_id,period),
  foreign key(scope_id,period) references finance.period(scope_id,period),
  check(approved_by is null or approved_by<>requested_by),
  check((state='pending' and approved_by is null and decided_at is null)
    or (state in('approved','rejected') and approved_by is not null and decided_at is not null))
);

alter table invoice.request drop constraint request_state_check;
alter table invoice.request add constraint request_state_check
  check(state in('submitted','approved','issuing','issued','rejected','cancelled','failed','red'));
alter table invoice.request add column requested_by text;
alter table invoice.request add column approved_by text;
alter table invoice.request add column reason text;
alter table invoice.request add column evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object');
alter table invoice.request add column source_hash char(64);
alter table invoice.request add column kind text not null default 'original' check(kind in('original','red'));
alter table invoice.request add column red_of_request_id text references invoice.request(id);
alter table invoice.request add check(approved_by is null or approved_by<>requested_by);
alter table invoice.request add check((kind='original' and red_of_request_id is null) or (kind='red' and red_of_request_id is not null));
alter table invoice.document add column kind text not null default 'original' check(kind in('original','red'));
alter table invoice.document add column red_of_id text references invoice.document(id);
alter table invoice.document add check((kind='original' and red_of_id is null) or (kind='red' and red_of_id is not null));
alter table invoice.line add column source_line_id text references finance.settlementline(id);

create table invoice.requestline(
  id text primary key,
  request_id text not null references invoice.request(id),
  settlement_line_id text not null references finance.settlementline(id),
  kind text not null check(kind in('original','red')),
  amount_minor bigint not null check(amount_minor>0),
  tax_minor bigint not null check(tax_minor>=0),
  source_hash char(64) not null,
  unique(request_id,settlement_line_id)
);

create table invoice.requestprofile(
  request_id text primary key references invoice.request(id),
  owner_id text not null,
  title_ciphertext text not null,
  title_key_version text not null,
  taxid_ciphertext text not null,
  taxid_token char(64) not null,
  taxid_key_version text not null,
  address_ciphertext text,
  address_key_version text,
  profile_version bigint not null,
  check((address_ciphertext is null)=(address_key_version is null))
);
insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,taxid_key_version,
  address_ciphertext,address_key_version,profile_version) select request.id,profile.owner_id,profile.title_ciphertext,profile.title_key_version,
  profile.taxid_ciphertext,profile.taxid_token,profile.taxid_key_version,profile.address_ciphertext,profile.address_key_version,profile.version
  from invoice.request request join invoice.profile profile on profile.id=request.profile_id;

create table finance.backfill(
  id text primary key,
  scope_id text not null,
  source_hash char(64) not null,
  target_hash char(64) not null,
  source_count bigint not null,
  target_count bigint not null,
  source_minor bigint not null,
  target_minor bigint not null,
  state text not null check(state in('pending','approved','rejected')),
  prepared_by text not null,
  signed_by text,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  prepared_at timestamptz not null,
  signed_at timestamptz,
  check(signed_by is null or signed_by<>prepared_by),
  check((state='pending' and signed_by is null and signed_at is null) or (state in('approved','rejected') and signed_by is not null and signed_at is not null))
);
insert into finance.backfill(id,scope_id,source_hash,target_hash,source_count,target_count,source_minor,target_minor,state,prepared_by,evidence,prepared_at)
select 'backfill:finance-cutover','organization-platform-root',summary.hash,summary.hash,summary.count,summary.count,summary.minor,summary.minor,
  'pending','migration:20260821043000',jsonb_build_object('runtimeEvidence',evidence.items,'runtimeHashes',hashes.items),clock_timestamp()
from (select encode(public.digest(coalesce(string_agg(journal.id||':'||entry.id||':'||entry.amount_minor,',' order by journal.id,entry.id),''),'sha256'),'hex') hash,
  count(entry.id) count,coalesce(sum(entry.amount_minor),0) minor from finance.journal journal left join finance.entry entry on entry.journal_id=journal.id) summary
cross join (select coalesce(jsonb_agg(to_jsonb(source)),'[]'::jsonb) items from runtime.reconciliationevidence source) evidence
cross join (select coalesce(jsonb_agg(to_jsonb(source)),'[]'::jsonb) items from runtime.reconciliationhash source) hashes;

create or replace function finance.reject_ledger_mutation() returns trigger language plpgsql set search_path=finance,pg_temp as $function$
begin raise exception 'FINANCE_LEDGER_APPEND_ONLY'; end $function$;
create trigger finance_journal_immutable before update or delete on finance.journal for each row execute function finance.reject_ledger_mutation();
create trigger finance_entry_immutable before update or delete on finance.entry for each row execute function finance.reject_ledger_mutation();
create trigger finance_settlementline_immutable before update or delete on finance.settlementline for each row execute function finance.reject_ledger_mutation();
create trigger invoice_requestline_immutable before update or delete on invoice.requestline for each row execute function finance.reject_ledger_mutation();
create trigger invoice_requestprofile_immutable before update or delete on invoice.requestprofile for each row execute function finance.reject_ledger_mutation();

create or replace function finance.resource_scope(p_resource text) returns text language plpgsql stable security definer
set search_path=finance,invoice,pg_temp as $function$
declare resolved text;
begin
  select scope_id into resolved from finance.reconciliation where id=p_resource;
  if resolved is null then select scope_id into resolved from finance.settlement where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.settlementadjustment where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.withdrawal where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.hold where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.periodclose where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.backfill where id=p_resource; end if;
  if resolved is null then select profile.owner_id into resolved from invoice.request request join invoice.profile profile on profile.id=request.profile_id where request.id=p_resource; end if;
  return resolved;
end $function$;
revoke all on function finance.resource_scope(text) from public;
grant execute on function finance.resource_scope(text) to shopapp,shopjob;

alter table finance.hold enable row level security;
alter table finance.statementline enable row level security;
alter table finance.reconciliationitem enable row level security;
alter table finance.settlementline enable row level security;
alter table finance.settlementadjustment enable row level security;
alter table finance.split enable row level security;
alter table finance.withdrawal enable row level security;
alter table finance.periodclose enable row level security;
alter table finance.backfill enable row level security;
alter table invoice.requestline enable row level security;
alter table invoice.requestprofile enable row level security;
create policy appscope on finance.hold for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.hold for all to shopjob using(true) with check(true);
create policy appscope on finance.statementline for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.statementline for all to shopjob using(true) with check(true);
create policy appscope on finance.reconciliationitem for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.reconciliationitem for all to shopjob using(true) with check(true);
create policy appscope on finance.settlementline for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.settlementline for all to shopjob using(true) with check(true);
create policy appscope on finance.settlementadjustment for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.settlementadjustment for all to shopjob using(true) with check(true);
create policy appscope on finance.split for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.split for all to shopjob using(true) with check(true);
create policy appscope on finance.withdrawal for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.withdrawal for all to shopjob using(true) with check(true);
create policy appscope on finance.periodclose for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.periodclose for all to shopjob using(true) with check(true);
create policy appscope on finance.backfill for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.backfill for all to shopjob using(true) with check(true);
create policy appscope on invoice.requestline for all to shopapp using(exists(select 1 from invoice.request request
  join invoice.profile profile on profile.id=request.profile_id where request.id=request_id and access.scope_allowed(profile.owner_id)))
  with check(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
    where request.id=request_id and access.scope_allowed(profile.owner_id)));
create policy jobscope on invoice.requestline for all to shopjob using(true) with check(true);
create policy appscope on invoice.requestprofile for all to shopapp using(access.scope_allowed(owner_id)) with check(access.scope_allowed(owner_id));
create policy jobscope on invoice.requestprofile for all to shopjob using(true) with check(true);
grant select,insert,update,delete on finance.hold,finance.statementline,finance.reconciliationitem,finance.settlementline,finance.settlementadjustment,
  finance.split,finance.withdrawal,
  finance.periodclose,finance.backfill to shopapp,shopjob;
grant select,insert,update,delete on invoice.requestline,invoice.requestprofile to shopapp,shopjob;

create index finance_hold_scope_state on finance.hold(scope_id,state,expires_at,id);
create index finance_statementline_reference on finance.statementline(scope_id,external_reference,kind);
create index finance_reconciliationitem_work on finance.reconciliationitem(reconciliation_id,state,id);
create index finance_settlement_scope on finance.settlement(scope_id,state,period,id);
create index finance_settlementline_source on finance.settlementline(source_type,source_id,settlement_id);
create index finance_settlementadjustment_work on finance.settlementadjustment(scope_id,state,created_at,id);
create index finance_split_settlement on finance.split(settlement_id,beneficiary_type,beneficiary_id);
create index finance_withdrawal_scope on finance.withdrawal(scope_id,state,created_at desc,id desc);
create index finance_periodclose_scope on finance.periodclose(scope_id,state,period desc,id);
create index finance_backfill_scope on finance.backfill(scope_id,state,prepared_at desc,id desc);
create index invoice_requestline_request on invoice.requestline(request_id,settlement_line_id);

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.reconciliations.read','finance','GET','/api/v1/finance/reconciliations','1.0.0'),
  ('finance.settlements.read','finance','GET','/api/v1/finance/settlements','1.0.0'),
  ('finance.settlements.decide','finance','POST','/api/v1/finance/settlements/{settlementid}/decide','1.0.0'),
  ('finance.settlements.adjust','finance','POST','/api/v1/finance/settlements/{settlementid}/adjust','1.0.0'),
  ('finance.withdrawals.read','finance','GET','/api/v1/finance/withdrawals','1.0.0'),
  ('finance.withdrawals.create','finance','POST','/api/v1/finance/withdrawals','1.0.0'),
  ('finance.withdrawals.decide','finance','POST','/api/v1/finance/withdrawals/{withdrawalid}/decide','1.0.0'),
  ('finance.withdrawals.recover','finance','POST','/api/v1/finance/withdrawals/{withdrawalid}/recover','1.0.0'),
  ('finance.holds.read','finance','GET','/api/v1/finance/holds','1.0.0'),
  ('finance.periods.read','finance','GET','/api/v1/finance/periods','1.0.0'),
  ('finance.periods.manage','finance','POST','/api/v1/finance/periods/{period}/manage','1.0.0'),
  ('finance.backfills.read','finance','GET','/api/v1/finance/backfills','1.0.0'),
  ('finance.backfills.decide','finance','POST','/api/v1/finance/backfills/{backfillid}/decide','1.0.0'),
  ('invoice.requests.decide','finance','POST','/api/v1/invoices/requests/{requestid}/decide','1.0.0'),
  ('invoice.requests.red','finance','POST','/api/v1/invoices/requests/{requestid}/red','1.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:b551fe3dae175e93488fd8ac','finance.reconciliation.read','elevated','active'),
  ('permission:b41e06bf6abdbb472201db56','finance.settlement.read','elevated','active'),
  ('permission:e0257b189679f7ca8621eadf','finance.settlement.decide','critical','active'),
  ('permission:c600e60d9ee25f3fa18c01fe','finance.settlement.adjust','critical','active'),
  ('permission:d9dfcc07d3b5cfde4d0be60e','finance.withdrawal.read','elevated','active'),
  ('permission:34730ddf747c1e4911028f36','finance.withdrawal.create','critical','active'),
  ('permission:22fca77f1b27d5a90008663c','finance.withdrawal.decide','critical','active'),
  ('permission:0e0dd759660048bad5c2046e','finance.withdrawal.recover','critical','active'),
  ('permission:e6cb395556a246d01aa64042','finance.hold.read','elevated','active'),
  ('permission:ef09eeff00fc66ea9a66698b','finance.period.read','elevated','active'),
  ('permission:8c8cf681934bac0ed29ae341','finance.period.manage','critical','active'),
  ('permission:702a7ecf94bc1daf6d730077','finance.backfill.read','high','active'),
  ('permission:e39069d1993b3a07b6790977','finance.backfill.decide','critical','active'),
  ('permission:617dd8d40dc9e27600a974e5','invoice.request.decide','critical','active'),
  ('permission:2945962da4c9d079782a21c0','invoice.request.red','critical','active');
insert into capability.capability(id,kind,name,version,status)
select id,'operation',id,1,'active' from runtime.operation where id in(
  'finance.reconciliations.read','finance.settlements.read','finance.settlements.decide','finance.settlements.adjust','finance.withdrawals.read','finance.withdrawals.create',
  'finance.withdrawals.decide','finance.withdrawals.recover','finance.holds.read','finance.periods.read','finance.periods.manage',
  'finance.backfills.read','finance.backfills.decide','invoice.requests.decide','invoice.requests.red');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('finance.reconciliations.read','finance.reconciliations.read','finance.reconciliation.read','operator'),
  ('finance.settlements.read','finance.settlements.read','finance.settlement.read','operator'),
  ('finance.settlements.decide','finance.settlements.decide','finance.settlement.decide','operator'),
  ('finance.settlements.adjust','finance.settlements.adjust','finance.settlement.adjust','operator'),
  ('finance.withdrawals.read','finance.withdrawals.read','finance.withdrawal.read','operator'),
  ('finance.withdrawals.create','finance.withdrawals.create','finance.withdrawal.create','operator'),
  ('finance.withdrawals.decide','finance.withdrawals.decide','finance.withdrawal.decide','operator'),
  ('finance.withdrawals.recover','finance.withdrawals.recover','finance.withdrawal.recover','operator'),
  ('finance.holds.read','finance.holds.read','finance.hold.read','operator'),
  ('finance.periods.read','finance.periods.read','finance.period.read','operator'),
  ('finance.periods.manage','finance.periods.manage','finance.period.manage','operator'),
  ('finance.backfills.read','finance.backfills.read','finance.backfill.read','operator'),
  ('finance.backfills.decide','finance.backfills.decide','finance.backfill.decide','operator'),
  ('invoice.requests.decide','invoice.requests.decide','invoice.request.decide','operator'),
  ('invoice.requests.red','invoice.requests.red','invoice.request.red','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in(
  'finance.reconciliations.read','finance.settlements.read','finance.settlements.decide','finance.settlements.adjust','finance.withdrawals.read','finance.withdrawals.create',
  'finance.withdrawals.decide','finance.withdrawals.recover','finance.holds.read','finance.periods.read','finance.periods.manage',
  'finance.backfills.read','finance.backfills.decide','invoice.requests.decide','invoice.requests.red');

insert into runtime.event(type,version,owner,schema_ref) values
  ('finance.reconciliation.difference',1,'finance','contract://events/finance.reconciliation.difference/v1'),
  ('finance.settlement.approved',1,'finance','contract://events/finance.settlement.approved/v1'),
  ('finance.settlement.adjusted',1,'finance','contract://events/finance.settlement.adjusted/v1'),
  ('finance.period.closed',1,'finance','contract://events/finance.period.closed/v1'),
  ('finance.withdrawal.paid',1,'finance','contract://events/finance.withdrawal.paid/v1'),
  ('finance.withdrawal.uncertain',1,'finance','contract://events/finance.withdrawal.uncertain/v1'),
  ('invoice.issued',1,'finance','contract://events/invoice.issued/v1'),
  ('invoice.red.issued',1,'finance','contract://events/invoice.red.issued/v1');

insert into runtime.schemaversion(version,checksum) values('20260821043000','ae6ed3284ea1f966144274bb5cc3b64a06229432dad6fe514206269451938c4c');

do $assert$ begin
  if (select count(*) from runtime.operation)<>187 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select journal_id from finance.entry group by journal_id having sum(case when side='debit' then amount_minor else -amount_minor end)<>0)
    then raise exception 'FINANCE_LEDGER_UNBALANCED'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821043000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
