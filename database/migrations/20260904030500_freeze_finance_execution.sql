begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030400') then raise exception 'FINANCE_EXECUTION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030500') then raise exception 'FINANCE_EXECUTION_ALREADY_APPLIED'; end if;
  if exists(select 1 from finance.settlement settlement where not exists(
    select 1 from finance.settlementline line where line.settlement_id=settlement.id)) then
    raise exception 'FINANCE_SETTLEMENT_WITHOUT_FROZEN_LINES';
  end if;
end
$precondition$;

create temporary table finance_execution_before on commit drop as
select (select count(*) from finance.settlement)+(select count(*) from finance.withdrawal)+
  (select count(*) from invoice.request) rows_count,
  (select coalesce(sum(amount_minor),0) from finance.settlement)+
  (select coalesce(sum(amount_minor),0) from finance.withdrawal)+
  (select coalesce(sum(amount_minor),0) from invoice.request) minor;

alter table finance.settlement add column input_hash char(64);
alter table finance.settlement add column input_count integer;
alter table finance.settlement add column input_minor bigint;
alter table finance.settlement add column input_watermark timestamptz;

update finance.settlement settlement set
  input_hash=encode(public.digest(concat_ws(chr(31),settlement.id,reconciliation.scope_id,reconciliation.partner_id,
    reconciliation.period,reconciliation.credit_minor::text,reconciliation.statement_hash,reconciliation.version::text,
    coalesce(policy.rule::text,'{}'),coalesce(source.lines,'')),'sha256'),'hex'),
  input_count=source.line_count,input_minor=source.input_minor,input_watermark=reconciliation.updated_at
from finance.reconciliation reconciliation
left join finance.policy policy on policy.scope_id=reconciliation.scope_id and policy.kind='settlement' and policy.state='active'
cross join lateral(
  select count(*)::integer line_count,
    coalesce(sum(case when line.kind in('refund','fee') then -item.internal_minor else item.internal_minor end),0) input_minor,
    string_agg(concat_ws(chr(31),item.id,coalesce(item.internal_type,''),
    coalesce(item.internal_id,''),item.internal_minor::text,item.version::text,line.external_reference,line.kind,
    line.tax_minor::text,line.raw_hash),chr(30) order by item.id) lines
  from finance.reconciliationitem item join finance.statementline line on line.id=item.statement_line_id
  where item.reconciliation_id=reconciliation.id and item.state in('matched','resolved') and item.internal_minor>0
) source
where reconciliation.id=settlement.reconciliation_id;

alter table finance.settlement alter column input_hash set not null;
alter table finance.settlement alter column input_count set not null;
alter table finance.settlement alter column input_minor set not null;
alter table finance.settlement alter column input_watermark set not null;
alter table finance.settlement add constraint finance_settlement_input_hash check(input_hash~'^[a-f0-9]{64}$');
alter table finance.settlement add constraint finance_settlement_input_count check(input_count>0);
alter table finance.settlement add constraint finance_settlement_input_minor check(input_minor>0);
alter table finance.settlement add constraint finance_settlement_input_watermark check(input_watermark<=frozen_at);
create unique index finance_settlement_reconciliation on finance.settlement(reconciliation_id);

alter table finance.withdrawal add column request_hash char(64);
alter table finance.withdrawal add column input_watermark timestamptz;
alter table finance.withdrawal add column provider text;
alter table finance.withdrawal add column provider_state text;
alter table finance.withdrawal add column response_hash char(64);

update finance.withdrawal set
  request_hash=encode(public.digest(concat_ws(chr(31),'payout-v1',id,scope_id,settlement_id,destination_ref,
    amount_minor::text,currency),'sha256'),'hex'),input_watermark=created_at,
  provider_state=case when state='paid' then 'paid' when state='failed' then 'failed' else 'processing' end
where state in('processing','paid','failed','uncertain');

alter table finance.withdrawal add constraint finance_withdrawal_request_hash check(request_hash is null or request_hash~'^[a-f0-9]{64}$');
alter table finance.withdrawal add constraint finance_withdrawal_response_hash check(response_hash is null or response_hash~'^[a-f0-9]{64}$');
alter table finance.withdrawal add constraint finance_withdrawal_provider check(provider is null or provider~'^[a-z][a-z0-9]{1,31}$');
alter table finance.withdrawal add constraint finance_withdrawal_provider_state check(provider_state is null or provider_state in('processing','paid','failed'));
alter table finance.withdrawal add constraint finance_withdrawal_input_binding check(
  (state in('submitted','rejected','cancelled') and request_hash is null and input_watermark is null)
  or (state in('approved','processing','paid','failed','uncertain') and (request_hash is null)=(input_watermark is null))
);
alter table finance.withdrawal add constraint finance_withdrawal_provider_binding check(
  (provider is null and provider_reference is null and provider_state is null and response_hash is null)
  or (provider_reference is not null and provider_state is not null)
);

alter table invoice.request add column issue_hash char(64);
alter table invoice.request add column issue_count integer;
alter table invoice.request add column issue_watermark timestamptz;
alter table invoice.request add column provider text;
alter table invoice.request add column provider_reference text;
alter table invoice.request add column response_hash char(64);

with frozen as(
  select request.id,encode(public.digest(concat_ws(chr(31),'invoice-v1',request.id,profile.owner_id,request.profile_id,
    request.settlement_id,request.kind,coalesce(request.red_of_request_id,''),coalesce(original.external_id,''),
    request.amount_minor::text,request.currency,coalesce(request.source_hash,''),profile.profile_version::text,
    profile.title_ciphertext,profile.taxid_ciphertext,coalesce(profile.address_ciphertext,''),coalesce(source.lines,'')),'sha256'),'hex') issue_hash,
    source.line_count,request.created_at,document.provider,document.external_id,
    case when document.id is null then null else encode(public.digest(concat_ws(chr(31),'invoice-result-v1',
      document.provider,document.external_id,document.sha256),'sha256'),'hex') end response_hash
  from invoice.request request join invoice.requestprofile profile on profile.request_id=request.id
  left join invoice.document document on document.request_id=request.id
  left join invoice.request original_request on original_request.id=request.red_of_request_id
  left join invoice.document original on original.request_id=original_request.id and original.kind='original'
  cross join lateral(
    select count(*)::integer line_count,string_agg(concat_ws(chr(31),line.sequence::text,line.description,
      line.amount_minor::text,line.tax_minor::text),chr(30) order by line.sequence) lines
    from invoice.line line where line.request_id=request.id
  ) source where request.state in('issuing','issued','red')
)
update invoice.request request set issue_hash=frozen.issue_hash,issue_count=frozen.line_count,
  issue_watermark=frozen.created_at,provider=frozen.provider,provider_reference=frozen.external_id,
  response_hash=frozen.response_hash from frozen where frozen.id=request.id;

alter table invoice.request add constraint invoice_request_issue_hash check(issue_hash is null or issue_hash~'^[a-f0-9]{64}$');
alter table invoice.request add constraint invoice_request_issue_count check(issue_count is null or issue_count between 1 and 1000);
alter table invoice.request add constraint invoice_request_response_hash check(response_hash is null or response_hash~'^[a-f0-9]{64}$');
alter table invoice.request add constraint invoice_request_provider check(provider is null or provider~'^[a-z][a-z0-9]{1,31}$');
alter table invoice.request add constraint invoice_request_issue_binding check(
  (state in('submitted','rejected','cancelled') and issue_hash is null and issue_count is null and issue_watermark is null)
  or (state in('approved','failed') and (issue_hash is null)=(issue_count is null) and (issue_hash is null)=(issue_watermark is null))
  or (state in('issuing','issued','red') and issue_hash is not null and issue_count is not null and issue_watermark is not null)
);
alter table invoice.request add constraint invoice_request_provider_binding check(
  (provider is null and provider_reference is null and response_hash is null)
  or (provider is not null and provider_reference is not null)
);

create function finance.guard_settlement_input() returns trigger language plpgsql set search_path=pg_catalog,finance as $body$
begin
  if old.input_hash is not null and (new.id,new.scope_id,new.partner_id,new.period,new.reconciliation_id,
    new.requested_by,new.input_hash,new.input_count,new.input_minor,new.input_watermark) is distinct from
    (old.id,old.scope_id,old.partner_id,old.period,old.reconciliation_id,old.requested_by,
      old.input_hash,old.input_count,old.input_minor,old.input_watermark) then
    raise exception 'FINANCE_SETTLEMENT_INPUT_IMMUTABLE';
  end if;
  return new;
end
$body$;
create trigger finance_settlement_input_immutable before update on finance.settlement
for each row execute function finance.guard_settlement_input();

create function finance.guard_withdrawal_input() returns trigger language plpgsql set search_path=pg_catalog,finance as $body$
begin
  if old.request_hash is not null and (new.id,new.scope_id,new.settlement_id,new.amount_minor,new.currency,new.destination_ref,
    new.request_hash,new.input_watermark) is distinct from (old.id,old.scope_id,old.settlement_id,old.amount_minor,old.currency,
      old.destination_ref,old.request_hash,old.input_watermark) then
    raise exception 'FINANCE_WITHDRAWAL_INPUT_IMMUTABLE';
  end if;
  return new;
end
$body$;
create trigger finance_withdrawal_input_immutable before update on finance.withdrawal
for each row execute function finance.guard_withdrawal_input();

create function invoice.guard_request_input() returns trigger language plpgsql set search_path=pg_catalog,invoice as $body$
begin
  if old.issue_hash is not null and (new.id,new.profile_id,new.settlement_id,new.amount_minor,new.currency,new.source_hash,
    new.kind,new.red_of_request_id,new.issue_hash,new.issue_count,new.issue_watermark) is distinct from
    (old.id,old.profile_id,old.settlement_id,old.amount_minor,old.currency,old.source_hash,old.kind,old.red_of_request_id,
      old.issue_hash,old.issue_count,old.issue_watermark) then
    raise exception 'INVOICE_REQUEST_INPUT_IMMUTABLE';
  end if;
  return new;
end
$body$;
create trigger invoice_request_input_immutable before update on invoice.request
for each row execute function invoice.guard_request_input();

create function invoice.guard_child_input() returns trigger language plpgsql set search_path=pg_catalog,invoice as $body$
declare target text;
begin
  target:=case when tg_op='DELETE' then old.request_id else new.request_id end;
  if exists(select 1 from invoice.request where id=target and issue_hash is not null) then
    raise exception 'INVOICE_CHILD_INPUT_IMMUTABLE';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$body$;
create trigger invoice_line_input_immutable before insert or update or delete on invoice.line
for each row execute function invoice.guard_child_input();
create trigger invoice_requestline_input_immutable before insert or update or delete on invoice.requestline
for each row execute function invoice.guard_child_input();
create trigger invoice_requestprofile_input_immutable before insert or update or delete on invoice.requestprofile
for each row execute function invoice.guard_child_input();

select runtime.record_migration_evidence('20260904030500',before.rows_count,after.rows_count,before.minor,after.minor,
  'select conrelid::regclass,conname,convalidated from pg_constraint where conname like ''finance_settlement_input%'' or conname like ''finance_withdrawal_%hash'' or conname like ''invoice_request_issue%'' order by conname;',
  'select id,input_hash,input_count,input_minor,input_watermark from finance.settlement where input_hash is null or input_count<1 or input_minor<1;')
from finance_execution_before before cross join(
  select (select count(*) from finance.settlement)+(select count(*) from finance.withdrawal)+
    (select count(*) from invoice.request) rows_count,
    (select coalesce(sum(amount_minor),0) from finance.settlement)+
    (select coalesce(sum(amount_minor),0) from finance.withdrawal)+
    (select coalesce(sum(amount_minor),0) from invoice.request) minor
) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030500',encode(public.digest('20260904030500_freeze_finance_execution','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from pg_trigger where not tgisinternal and tgname in(
    'finance_settlement_input_immutable','finance_withdrawal_input_immutable','invoice_request_input_immutable',
    'invoice_line_input_immutable','invoice_requestline_input_immutable','invoice_requestprofile_input_immutable'))<>6 then
    raise exception 'FINANCE_EXECUTION_FREEZE_TRIGGERS_MISSING';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='finance' and indexname='finance_settlement_reconciliation') then
    raise exception 'FINANCE_SETTLEMENT_RECONCILIATION_INDEX_MISSING';
  end if;
  if exists(select 1 from finance.settlement where input_hash is null or input_count<1 or input_minor<1 or input_watermark is null) then
    raise exception 'FINANCE_SETTLEMENT_WATERMARK_MISSING';
  end if;
end
$assert$;

commit;
