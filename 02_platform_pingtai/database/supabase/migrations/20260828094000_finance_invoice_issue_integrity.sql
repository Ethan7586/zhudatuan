begin;

do $tax_preflight$
begin
  if exists(select 1 from finance.statementline where tax_minor>amount_minor)
    or exists(select 1 from finance.settlementadjustment where tax_minor>amount_minor)
    or exists(select 1 from finance.settlementline where tax_minor>amount_minor)
    or exists(select 1 from invoice.requestline where tax_minor>amount_minor)
    or exists(select 1 from invoice.line where tax_minor>amount_minor) then
    raise exception 'FINANCE_TAX_AMOUNT_INTEGRITY_VIOLATION';
  end if;
end $tax_preflight$;

do $owner_preflight$
begin
  if exists(
    select 1 from invoice.request request
    join invoice.profile profile on profile.id=request.profile_id
    left join invoice.requestprofile snapshot on snapshot.request_id=request.id
    where snapshot.request_id is null or snapshot.owner_id is distinct from profile.owner_id
  ) then raise exception 'INVOICE_REQUEST_OWNER_SNAPSHOT_MISMATCH'; end if;
end $owner_preflight$;

alter table finance.statementline
  add constraint finance_statementline_tax_within_amount check(tax_minor<=amount_minor);
alter table invoice.requestline
  add constraint invoice_requestline_tax_within_amount check(tax_minor<=amount_minor);
alter table invoice.line
  add constraint invoice_line_tax_within_amount check(tax_minor<=amount_minor);

alter table invoice.request
  add column issue_claim_hash char(64),
  add column issue_claim_until timestamptz,
  add check((issue_claim_hash is null)=(issue_claim_until is null));

create table invoice.issueartifact(
  id text primary key,
  request_id text not null references invoice.request(id),
  claim_hash char(64) not null,
  provider text not null,
  external_id text not null,
  object_ref text not null,
  sha256 char(64) not null,
  state text not null check(state in('pending','final','orphan')),
  created_at timestamptz not null,
  finalized_at timestamptz,
  unique(request_id,claim_hash),
  unique(object_ref),
  check((state='final')=(finalized_at is not null))
);
alter table invoice.issueartifact enable row level security;
revoke all on invoice.issueartifact from public,shopapp,shopjob;

-- Invoice request facts are assembled only by the SECURITY DEFINER create
-- functions below. Application roles never write request snapshots directly;
-- mutation and post-seal append guards remain defence in depth.
create or replace function invoice.assert_issue_snapshot(p_request text)
returns text
language plpgsql
stable
security definer
set search_path=invoice,public,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  profile invoice.requestprofile%rowtype;
  original invoice.request%rowtype;
  request_line_count bigint;
  invoice_line_count bigint;
  request_amount numeric;
  invoice_amount numeric;
  calculated_source_hash text;
  request_lines jsonb;
  invoice_lines jsonb;
  snapshot jsonb;
begin
  select * into target from invoice.request where id=p_request;
  if not found then raise exception 'INVOICE_REQUEST_NOT_FOUND'; end if;

  select * into profile from invoice.requestprofile where request_id=p_request;
  if not found then raise exception 'INVOICE_PROFILE_SNAPSHOT_MISSING'; end if;

  select count(*),coalesce(sum(amount_minor),0),
    encode(public.digest(coalesce(string_agg(settlement_line_id||':'||amount_minor||':'||tax_minor,','
      order by settlement_line_id),''),'sha256'),'hex'),
    coalesce(jsonb_agg(jsonb_build_object(
      'settlementLine',settlement_line_id,
      'kind',kind,
      'amountMinor',amount_minor::text,
      'taxMinor',tax_minor::text,
      'sourceHash',source_hash
    ) order by settlement_line_id),'[]'::jsonb)
  into request_line_count,request_amount,calculated_source_hash,request_lines
  from invoice.requestline where request_id=p_request;

  select count(*),coalesce(sum(amount_minor),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'sequence',sequence,
      'description',description,
      'amountMinor',amount_minor::text,
      'taxMinor',tax_minor::text,
      'sourceLine',source_line_id
    ) order by sequence),'[]'::jsonb)
  into invoice_line_count,invoice_amount,invoice_lines
  from invoice.line where request_id=p_request;

  if target.source_hash is null or target.source_hash<>calculated_source_hash then
    raise exception 'INVOICE_SOURCE_HASH_MISMATCH';
  end if;
  if request_line_count=0 or request_line_count<>invoice_line_count then
    raise exception 'INVOICE_LINE_SET_MISMATCH';
  end if;
  if request_amount<>target.amount_minor or invoice_amount<>target.amount_minor then
    raise exception 'INVOICE_AMOUNT_MISMATCH';
  end if;
  if target.amount_minor>9007199254740991
    or exists(select 1 from invoice.requestline where request_id=p_request
      and (amount_minor>9007199254740991 or tax_minor>9007199254740991 or tax_minor>amount_minor))
    or exists(select 1 from invoice.line where request_id=p_request
      and (amount_minor>9007199254740991 or tax_minor>9007199254740991 or tax_minor>amount_minor))
  then raise exception 'INVOICE_AMOUNT_UNSAFE'; end if;
  if exists(select 1 from invoice.requestline line where line.request_id=p_request
      and (line.kind<>target.kind or line.source_hash<>encode(public.digest(
        line.settlement_line_id||':'||line.amount_minor||':'||line.tax_minor,'sha256'),'hex'))) then
    raise exception 'INVOICE_REQUEST_LINE_HASH_MISMATCH';
  end if;
  if exists(
    select 1 from invoice.requestline requested
    full join invoice.line rendered
      on rendered.request_id=requested.request_id and rendered.source_line_id=requested.settlement_line_id
    where coalesce(requested.request_id,rendered.request_id)=p_request
      and (requested.request_id is null or rendered.request_id is null
        or requested.amount_minor<>rendered.amount_minor or requested.tax_minor<>rendered.tax_minor)
  ) then raise exception 'INVOICE_LINE_SNAPSHOT_MISMATCH'; end if;

  if target.kind='red' then
    select * into original from invoice.request where id=target.red_of_request_id;
    if not found or original.kind<>'original' or original.state not in('issued','red')
      or original.amount_minor<>target.amount_minor or original.currency<>target.currency
      or original.source_hash<>target.source_hash then
      raise exception 'INVOICE_RED_SOURCE_MISMATCH';
    end if;
    if exists(select 1 from invoice.requestline red where red.request_id=target.id
        and (red.kind<>'red' or not exists(select 1 from invoice.requestline source
          where source.request_id=target.red_of_request_id and source.settlement_line_id=red.settlement_line_id
            and source.kind='original' and source.amount_minor=red.amount_minor and source.tax_minor=red.tax_minor
            and source.source_hash=red.source_hash)))
      or exists(select 1 from invoice.requestline source where source.request_id=target.red_of_request_id
        and source.kind='original' and not exists(select 1 from invoice.requestline red
          where red.request_id=target.id and red.settlement_line_id=source.settlement_line_id
            and red.kind='red' and red.amount_minor=source.amount_minor and red.tax_minor=source.tax_minor
            and red.source_hash=source.source_hash))
    then raise exception 'INVOICE_RED_LINE_MISMATCH'; end if;
  end if;

  snapshot=jsonb_build_object(
    'request',jsonb_build_object(
      'id',target.id,
      'profile',target.profile_id,
      'settlement',target.settlement_id,
      'amountMinor',target.amount_minor::text,
      'currency',target.currency,
      'requestedBy',target.requested_by,
      'sourceHash',target.source_hash,
      'kind',target.kind,
      'redOf',target.red_of_request_id
    ),
    'profile',jsonb_build_object(
      'owner',profile.owner_id,
      'version',profile.profile_version::text,
      'title',profile.title_ciphertext,
      'taxid',profile.taxid_ciphertext,
      'address',profile.address_ciphertext
    ),
    'requestLines',request_lines,
    'invoiceLines',invoice_lines
  );
  return encode(public.digest(snapshot::text,'sha256'),'hex');
end $function$;

create or replace function invoice.guard_request_fact()
returns trigger
language plpgsql
set search_path=invoice,pg_temp
as $function$
begin
  if current_user='shopjob' then
    if old.state<>'issuing' or new.state<>'failed' or new.version<>old.version+1
      or not (new.evidence @> old.evidence) then
      raise exception 'INVOICE_JOB_TRANSITION_INVALID';
    end if;
    new.issue_claim_hash=null;
    new.issue_claim_until=null;
  elsif current_user='shopapp' then
    if new.version<>old.version+1 or not (new.evidence @> old.evidence)
      or not ((old.state='submitted' and new.state in('approved','rejected','cancelled'))
        or (old.state='failed' and new.state='approved'))
      or (new.state='approved' and (new.approved_by is null or new.approved_by=new.requested_by))
      or (new.state<>'approved' and new.approved_by is not null) then
      raise exception 'INVOICE_APP_TRANSITION_INVALID';
    end if;
  end if;
  if (new.profile_id,new.settlement_id,new.amount_minor,new.currency,new.created_at,new.requested_by,
      new.source_hash,new.kind,new.red_of_request_id)
    is distinct from
    (old.profile_id,old.settlement_id,old.amount_minor,old.currency,old.created_at,old.requested_by,
      old.source_hash,old.kind,old.red_of_request_id)
  then raise exception 'INVOICE_REQUEST_FACT_IMMUTABLE'; end if;
  return new;
end $function$;

create or replace function invoice.guard_request_create()
returns trigger
language plpgsql
set search_path=invoice,pg_temp
as $function$
begin
  if new.state<>'submitted' or new.version<>0 or new.requested_by is null
    or (current_user='shopapp' and new.requested_by<>nullif(current_setting('app.actor_id',true),''))
    or new.approved_by is not null
    or new.source_hash is null or new.issue_claim_hash is not null or new.issue_claim_until is not null then
    raise exception 'INVOICE_REQUEST_CREATE_INVALID';
  end if;
  return new;
end $function$;

drop trigger if exists invoice_request_create_guard on invoice.request;
create trigger invoice_request_create_guard before insert on invoice.request
for each row execute function invoice.guard_request_create();

drop trigger if exists invoice_request_fact_immutable on invoice.request;
create trigger invoice_request_fact_immutable before update on invoice.request
for each row execute function invoice.guard_request_fact();

create or replace function invoice.guard_profile_owner()
returns trigger
language plpgsql
set search_path=invoice,pg_temp
as $function$
begin
  if new.owner_id is distinct from old.owner_id then raise exception 'INVOICE_PROFILE_OWNER_IMMUTABLE'; end if;
  return new;
end $function$;

drop trigger if exists invoice_profile_owner_immutable on invoice.profile;
create trigger invoice_profile_owner_immutable before update on invoice.profile
for each row execute function invoice.guard_profile_owner();

-- Scope proofs for request resources bind to the immutable request snapshot,
-- not to mutable profile presentation data.
create or replace function finance.resource_scope(p_resource text)
returns text language plpgsql stable security definer
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
  if resolved is null then select scope_id into resolved from finance.policy where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.statement where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.account where id=p_resource; end if;
  if resolved is null then select owner_id into resolved from invoice.profile where id=p_resource; end if;
  if resolved is null then select owner_id into resolved from invoice.requestprofile where request_id=p_resource; end if;
  return resolved;
end $function$;

create or replace function invoice.record_failed_issue()
returns trigger
language plpgsql
security definer
set search_path=invoice,pg_temp
as $function$
begin
  if old.state in('approved','issuing') and new.state='failed' then
    update invoice.issueartifact set state='orphan',finalized_at=null
    where request_id=new.id and state='pending';
    insert into invoice.statusevent(request_id,sequence,state,occurred_at)
    select new.id,coalesce(max(sequence),0)+1,'failed',clock_timestamp()
    from invoice.statusevent where request_id=new.id;
  end if;
  return new;
end $function$;

drop trigger if exists invoice_request_failed_audit on invoice.request;
create trigger invoice_request_failed_audit after update on invoice.request
for each row execute function invoice.record_failed_issue();

create or replace function invoice.guard_snapshot_fact()
returns trigger
language plpgsql
security definer
set search_path=invoice,pg_temp
as $function$
declare
  target_request text;
  target_state text;
begin
  if tg_op<>'INSERT' then raise exception 'INVOICE_SNAPSHOT_IMMUTABLE'; end if;
  target_request=new.request_id;
  select state into target_state from invoice.request where id=target_request;
  if target_state<>'submitted' then raise exception 'INVOICE_SNAPSHOT_SEALED'; end if;
  if exists(select 1 from invoice.statusevent where request_id=target_request) then
    raise exception 'INVOICE_SNAPSHOT_SEALED';
  end if;
  return new;
end $function$;

create or replace function invoice.validate_request_line()
returns trigger
language plpgsql
security definer
set search_path=invoice,public,pg_temp
as $function$
begin
  if new.source_hash<>encode(public.digest(
      new.settlement_line_id||':'||new.amount_minor||':'||new.tax_minor,'sha256'),'hex') then
    raise exception 'INVOICE_REQUEST_LINE_HASH_MISMATCH';
  end if;
  return new;
end $function$;

create or replace function invoice.validate_rendered_line()
returns trigger
language plpgsql
security definer
set search_path=invoice,pg_temp
as $function$
begin
  if not exists(select 1 from invoice.requestline line where line.request_id=new.request_id
      and line.settlement_line_id=new.source_line_id and line.amount_minor=new.amount_minor and line.tax_minor=new.tax_minor) then
    raise exception 'INVOICE_LINE_SNAPSHOT_MISMATCH';
  end if;
  return new;
end $function$;

drop trigger if exists invoice_line_snapshot_guard on invoice.line;
create trigger invoice_line_snapshot_guard before insert or update or delete on invoice.line
for each row execute function invoice.guard_snapshot_fact();
drop trigger if exists invoice_requestline_snapshot_guard on invoice.requestline;
create trigger invoice_requestline_snapshot_guard before insert or update or delete on invoice.requestline
for each row execute function invoice.guard_snapshot_fact();
drop trigger if exists invoice_requestline_z_integrity on invoice.requestline;
create trigger invoice_requestline_z_integrity before insert on invoice.requestline
for each row execute function invoice.validate_request_line();
drop trigger if exists invoice_requestprofile_snapshot_guard on invoice.requestprofile;
create trigger invoice_requestprofile_snapshot_guard before insert or update or delete on invoice.requestprofile
for each row execute function invoice.guard_snapshot_fact();
drop trigger if exists invoice_line_z_integrity on invoice.line;
create trigger invoice_line_z_integrity before insert on invoice.line
for each row execute function invoice.validate_rendered_line();

create or replace function invoice.guard_document_fact()
returns trigger
language plpgsql
set search_path=invoice,pg_temp
as $function$
begin
  if tg_op<>'INSERT' then raise exception 'INVOICE_DOCUMENT_IMMUTABLE'; end if;
  return new;
end $function$;

drop trigger if exists invoice_document_immutable on invoice.document;
create trigger invoice_document_immutable before update or delete on invoice.document
for each row execute function invoice.guard_document_fact();

create or replace function invoice.guard_status_fact()
returns trigger
language plpgsql
security definer
set search_path=invoice,pg_temp
as $function$
declare
  target_state text;
  expected_sequence integer;
begin
  if tg_op<>'INSERT' then raise exception 'INVOICE_STATUS_EVENT_IMMUTABLE'; end if;
  select state into target_state from invoice.request where id=new.request_id;
  select coalesce(max(sequence),0)+1 into expected_sequence from invoice.statusevent where request_id=new.request_id;
  if target_state is null or new.state<>target_state or new.sequence<>expected_sequence
    or new.state not in('submitted','approved','rejected','cancelled','issuing','issued','red','failed') then
    raise exception 'INVOICE_STATUS_EVENT_INVALID';
  end if;
  if new.state='submitted' then
    if new.sequence<>1 then raise exception 'INVOICE_STATUS_EVENT_INVALID'; end if;
    perform invoice.assert_issue_snapshot(new.request_id);
  end if;
  return new;
end $function$;

drop trigger if exists invoice_statusevent_immutable on invoice.statusevent;
create trigger invoice_statusevent_immutable before insert or update or delete on invoice.statusevent
for each row execute function invoice.guard_status_fact();

create or replace function invoice.assert_consumed_financial_proof(
  p_operation text,p_resource text,p_expected_version bigint
)
returns void
language plpgsql
volatile
security definer
set search_path=invoice,access,pg_temp
as $function$
declare
  actor text:=nullif(current_setting('app.actor_id',true),'');
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if actor is null or scope is null or not exists(
    select 1 from access.actionproof proof
    where proof.actor_id=actor and proof.scope_id=scope and proof.operation=p_operation
      and proof.resource_id=p_resource and proof.expected_version is not distinct from p_expected_version
      and proof.consumed_at>=transaction_timestamp() and proof.expires_at>clock_timestamp()
  ) then raise exception 'INVOICE_ACTION_PROOF_NOT_CONSUMED'; end if;
end $function$;

create or replace function invoice.create_request(
  p_request text,
  p_profile text,
  p_settlement text,
  p_amount_minor bigint,
  p_lines text[],
  p_reason text,
  p_evidence jsonb,
  p_expected_version bigint
)
returns setof invoice.request
language plpgsql
volatile
security definer
set search_path=invoice,finance,public,pg_temp
as $function$
declare
  actor text:=nullif(current_setting('app.actor_id',true),'');
  scope text:=nullif(current_setting('app.scope_id',true),'');
  selected_profile invoice.profile%rowtype;
  selected_settlement finance.settlement%rowtype;
  target invoice.request%rowtype;
  selected_count bigint;
  selected_amount numeric;
  selected_source_hash text;
begin
  if current_setting('app.workload',true)<>'api' or actor is null or scope is null
    or p_request is null or p_request='' or p_profile is null or p_profile=''
    or p_settlement is null or p_settlement='' or p_amount_minor<=0
    or p_amount_minor>9007199254740991 or p_expected_version is null
    or p_lines is null or cardinality(p_lines)=0 or cardinality(p_lines)>1000
    or cardinality(p_lines)<>(select count(distinct line_id) from unnest(p_lines) line_id)
    or jsonb_typeof(p_evidence)<>'object' then
    raise exception 'INVOICE_REQUEST_CREATE_INVALID';
  end if;

  select * into selected_profile from invoice.profile profile
  where profile.id=p_profile and profile.owner_id=scope and profile.status='active'
  for share;
  if not found then raise exception 'INVOICE_PROFILE_INVALID'; end if;

  select * into selected_settlement from finance.settlement settlement
  where settlement.id=p_settlement and settlement.scope_id=scope
    and settlement.state in('payable','paid') and settlement.version=p_expected_version
  for update;
  if not found then raise exception 'INVOICE_SETTLEMENT_INVALID'; end if;

  perform line.id from finance.settlementline line
  where line.settlement_id=p_settlement and line.scope_id=scope and line.id=any(p_lines)
  order by line.id for update;

  select count(*),coalesce(sum(line.invoice_minor),0),
    encode(public.digest(coalesce(string_agg(line.id||':'||line.invoice_minor||':'||
      floor(line.tax_minor::numeric*line.invoice_minor/line.amount_minor)::bigint,',' order by line.id),''),'sha256'),'hex')
  into selected_count,selected_amount,selected_source_hash
  from finance.settlementline line
  where line.settlement_id=p_settlement and line.scope_id=scope and line.id=any(p_lines)
    and line.state='frozen' and line.invoice_minor>0 and line.direction='increase'
    and line.source_type not in('refund','fee')
    and line.tax_minor<=line.amount_minor
    and not exists(
      select 1 from invoice.requestline used
      join invoice.request request on request.id=used.request_id
      where used.settlement_line_id=line.id and used.kind='original'
        and request.state not in('rejected','cancelled')
    );
  if selected_count<>cardinality(p_lines) or selected_amount<>p_amount_minor then
    raise exception 'INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH';
  end if;

  insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
    requested_by,approved_by,reason,evidence,source_hash,kind,red_of_request_id)
  values(p_request,p_profile,p_settlement,p_amount_minor,selected_settlement.currency,'submitted',clock_timestamp(),0,
    actor,null,p_reason,p_evidence,selected_source_hash,'original',null)
  returning * into target;

  insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
    taxid_key_version,address_ciphertext,address_key_version,profile_version)
  values(p_request,selected_profile.owner_id,selected_profile.title_ciphertext,selected_profile.title_key_version,
    selected_profile.taxid_ciphertext,selected_profile.taxid_token,selected_profile.taxid_key_version,
    selected_profile.address_ciphertext,selected_profile.address_key_version,selected_profile.version);

  insert into invoice.requestline(id,request_id,settlement_line_id,kind,amount_minor,tax_minor,source_hash)
  select 'invoiceline:'||p_request||':'||line.id,p_request,line.id,'original',line.invoice_minor,
    floor(line.tax_minor::numeric*line.invoice_minor/line.amount_minor)::bigint,
    encode(public.digest(line.id||':'||line.invoice_minor||':'||
      floor(line.tax_minor::numeric*line.invoice_minor/line.amount_minor)::bigint,'sha256'),'hex')
  from finance.settlementline line where line.id=any(p_lines)
  order by line.id;

  insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
  select p_request,row_number() over(order by line.id),line.source_type||':'||line.source_id,line.invoice_minor,
    floor(line.tax_minor::numeric*line.invoice_minor/line.amount_minor)::bigint,line.id
  from finance.settlementline line where line.id=any(p_lines)
  order by line.id;

  perform invoice.assert_issue_snapshot(p_request);
  insert into invoice.statusevent(request_id,sequence,state,occurred_at)
  values(p_request,1,'submitted',clock_timestamp());
  return next target;
end $function$;

create or replace function invoice.create_red_request(
  p_request text,
  p_original text,
  p_reason text,
  p_evidence jsonb,
  p_expected_version bigint
)
returns setof invoice.request
language plpgsql
volatile
security definer
set search_path=invoice,pg_temp
as $function$
declare
  actor text:=nullif(current_setting('app.actor_id',true),'');
  scope text:=nullif(current_setting('app.scope_id',true),'');
  original invoice.request%rowtype;
  owner text;
  target invoice.request%rowtype;
begin
  if current_setting('app.workload',true)<>'api' or actor is null or scope is null
    or p_request is null or p_request='' or p_original is null or p_original=''
    or p_expected_version is null or jsonb_typeof(p_evidence)<>'object' then
    raise exception 'INVOICE_RED_CREATE_INVALID';
  end if;
  select * into original from invoice.request where id=p_original for update;
  if not found then raise exception 'INVOICE_RED_NOT_ELIGIBLE'; end if;
  select owner_id into owner from invoice.requestprofile where request_id=p_original;
  if owner<>scope or original.kind<>'original' or original.state<>'issued'
    or original.version<>p_expected_version
    or not exists(select 1 from invoice.document where request_id=p_original and kind='original')
    or exists(select 1 from invoice.request red where red.red_of_request_id=p_original
      and red.state not in('rejected','cancelled')) then
    raise exception 'INVOICE_RED_NOT_ELIGIBLE';
  end if;
  perform invoice.assert_consumed_financial_proof('invoice.requests.red',p_original,p_expected_version);

  insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
    requested_by,approved_by,reason,evidence,source_hash,kind,red_of_request_id)
  values(p_request,original.profile_id,original.settlement_id,original.amount_minor,original.currency,'submitted',
    clock_timestamp(),0,actor,null,p_reason,p_evidence,original.source_hash,'red',p_original)
  returning * into target;
  insert into invoice.requestprofile
  select p_request,profile.owner_id,profile.title_ciphertext,profile.title_key_version,profile.taxid_ciphertext,
    profile.taxid_token,profile.taxid_key_version,profile.address_ciphertext,profile.address_key_version,profile.profile_version
  from invoice.requestprofile profile where profile.request_id=p_original;
  insert into invoice.requestline(id,request_id,settlement_line_id,kind,amount_minor,tax_minor,source_hash)
  select 'invoiceline:'||p_request||':'||line.settlement_line_id,p_request,line.settlement_line_id,'red',
    line.amount_minor,line.tax_minor,line.source_hash from invoice.requestline line
  where line.request_id=p_original and line.kind='original' order by line.settlement_line_id;
  insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
  select p_request,line.sequence,'红冲：'||line.description,line.amount_minor,line.tax_minor,line.source_line_id
  from invoice.line line where line.request_id=p_original order by line.sequence;
  perform invoice.assert_issue_snapshot(p_request);
  insert into invoice.statusevent(request_id,sequence,state,occurred_at)
  values(p_request,1,'submitted',clock_timestamp());
  return next target;
end $function$;

create or replace function invoice.seal_request(p_request text,p_expected_version bigint)
returns boolean
language plpgsql
volatile
security definer
set search_path=invoice,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  owner text;
  actor text:=nullif(current_setting('app.actor_id',true),'');
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'api' or actor is null or scope is null then
    raise exception 'INVOICE_API_CONTEXT_REQUIRED';
  end if;
  select * into target from invoice.request where id=p_request for update;
  select owner_id into owner from invoice.requestprofile where request_id=p_request;
  if not found or owner<>scope or target.state<>'submitted' or target.requested_by<>actor
    or exists(select 1 from invoice.statusevent where request_id=p_request) then
    raise exception 'INVOICE_REQUEST_SEAL_INVALID';
  end if;
  if target.kind='red' then
    perform invoice.assert_consumed_financial_proof('invoice.requests.red',target.red_of_request_id,p_expected_version);
  end if;
  perform invoice.assert_issue_snapshot(p_request);
  insert into invoice.statusevent(request_id,sequence,state,occurred_at)
  values(p_request,1,'submitted',clock_timestamp());
  return true;
end $function$;

create or replace function invoice.cancel_request(p_request text,p_expected_version bigint)
returns setof invoice.request
language plpgsql
volatile
security definer
set search_path=invoice,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'api' or scope is null then
    raise exception 'INVOICE_API_CONTEXT_REQUIRED';
  end if;
  update invoice.request request set state='cancelled',version=version+1
  from invoice.requestprofile profile where request.id=p_request and profile.request_id=request.id
    and profile.owner_id=scope and request.state='submitted' and request.version=p_expected_version
  returning request.* into target;
  if not found then return; end if;
  insert into invoice.statusevent(request_id,sequence,state,occurred_at)
  select target.id,coalesce(max(sequence),0)+1,'cancelled',clock_timestamp()
  from invoice.statusevent where request_id=target.id;
  return next target;
end $function$;

create or replace function invoice.decide_request(
  p_request text,p_decision text,p_reason text,p_evidence jsonb,p_expected_version bigint
)
returns setof invoice.request
language plpgsql
volatile
security definer
set search_path=invoice,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  actor text:=nullif(current_setting('app.actor_id',true),'');
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'api' or actor is null or scope is null
    or p_decision not in('approved','rejected') or jsonb_typeof(p_evidence)<>'object' then
    raise exception 'INVOICE_DECISION_INVALID';
  end if;
  perform invoice.assert_consumed_financial_proof('invoice.requests.decide',p_request,p_expected_version);
  update invoice.request request set state=p_decision,
    approved_by=case when p_decision='approved' then actor else null end,
    reason=p_reason,evidence=evidence||p_evidence,version=version+1
  from invoice.requestprofile profile where request.id=p_request and profile.request_id=request.id
    and profile.owner_id=scope and (request.state='submitted' or (request.state='failed' and p_decision='approved'))
    and request.requested_by<>actor
    and request.version=p_expected_version
  returning request.* into target;
  if not found then return; end if;
  insert into invoice.statusevent(request_id,sequence,state,occurred_at)
  select target.id,coalesce(max(sequence),0)+1,p_decision,clock_timestamp()
  from invoice.statusevent where request_id=target.id;
  return next target;
end $function$;

create or replace function invoice.fail_issue(p_request text,p_job text,p_error text)
returns boolean
language plpgsql
volatile
security definer
set search_path=invoice,pg_temp
as $function$
declare
  failed text;
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'jobs' or scope is null or p_job is null or p_job='' then
    raise exception 'INVOICE_JOB_CONTEXT_REQUIRED';
  end if;
  update invoice.request request set state='failed',
    evidence=evidence||jsonb_build_object('deadletter',p_job,'error',left(p_error,1000)),
    issue_claim_hash=null,issue_claim_until=null,version=version+1
  from invoice.requestprofile profile where request.id=p_request and profile.request_id=request.id
    and profile.owner_id=scope and request.state in('approved','issuing')
  returning request.id into failed;
  return failed is not null;
end $function$;

-- Claiming validates and seals the exact provider input before any external
-- call. Only an expired claim can be reclaimed; the raw token is returned once
-- while only its digest is persisted.
create or replace function invoice.claim_issue(p_request text)
returns table(
  id text,
  owner_id text,
  amount_minor text,
  currency text,
  kind text,
  red_of_request_id text,
  original_external_id text,
  title_ciphertext text,
  taxid_ciphertext text,
  address_ciphertext text,
  lines jsonb,
  snapshot_hash text,
  claim_token text,
  claim_id text
)
language plpgsql
volatile
security definer
set search_path=invoice,public,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  verified_hash text;
  raw_claim text;
  stored_claim text;
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'jobs' or scope is null then
    raise exception 'INVOICE_JOB_CONTEXT_REQUIRED';
  end if;
  select * into target from invoice.request where invoice.request.id=p_request for update;
  if not found then raise exception 'INVOICE_NOT_RUNNABLE'; end if;
  if not exists(select 1 from invoice.requestprofile profile
    where profile.request_id=p_request and profile.owner_id=scope) then
    raise exception 'INVOICE_JOB_SCOPE_INVALID';
  end if;
  if target.state in('issued','red') then return; end if;
  if target.state not in('approved','issuing') then raise exception 'INVOICE_NOT_RUNNABLE'; end if;
  if target.state='issuing' and target.issue_claim_hash is not null and target.issue_claim_until>clock_timestamp() then
    raise exception 'INVOICE_ALREADY_CLAIMED';
  end if;
  if exists(select 1 from invoice.document where request_id=p_request) then
    raise exception 'INVOICE_DOCUMENT_STATE_CONFLICT';
  end if;

  verified_hash=invoice.assert_issue_snapshot(p_request);
  raw_claim=encode(public.gen_random_bytes(32),'hex');
  stored_claim=encode(public.digest(raw_claim,'sha256'),'hex');
  update invoice.request set state='issuing',issue_claim_hash=stored_claim,
    issue_claim_until=clock_timestamp()+interval '90 seconds',version=version+1
  where invoice.request.id=p_request;
  if target.state='approved' then
    insert into invoice.statusevent(request_id,sequence,state,occurred_at)
    select target.id,coalesce(max(sequence),0)+1,'issuing',clock_timestamp()
    from invoice.statusevent where request_id=target.id;
  end if;

  return query
  select request.id,profile.owner_id,request.amount_minor::text,request.currency::text,request.kind,
    request.red_of_request_id,original_document.external_id,profile.title_ciphertext,profile.taxid_ciphertext,
    profile.address_ciphertext,
    coalesce(jsonb_agg(jsonb_build_object(
      'description',line.description,
      'amountMinor',line.amount_minor::text,
      'taxMinor',line.tax_minor::text
    ) order by line.sequence),'[]'::jsonb),verified_hash,raw_claim,stored_claim
  from invoice.request request
  join invoice.requestprofile profile on profile.request_id=request.id
  join invoice.line line on line.request_id=request.id
  left join invoice.document original_document on original_document.request_id=request.red_of_request_id
    and original_document.kind='original'
  where request.id=p_request
  group by request.id,profile.request_id,profile.owner_id,profile.title_ciphertext,profile.taxid_ciphertext,
    profile.address_ciphertext,original_document.external_id;
end $function$;

-- The completed upload is registered in a durable attempt ledger before the
-- final transaction. A stale claimant is recorded as an orphan and can never
-- replace the authoritative document reference.
create or replace function invoice.register_issue_artifact(
  p_request text,
  p_claim_token text,
  p_provider text,
  p_external_id text,
  p_object_ref text,
  p_sha256 text
)
returns boolean
language plpgsql
volatile
security definer
set search_path=invoice,public,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  stored_claim text;
  accepted boolean;
  artifact invoice.issueartifact%rowtype;
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'jobs' or scope is null then
    raise exception 'INVOICE_JOB_CONTEXT_REQUIRED';
  end if;
  if p_claim_token!~'^[0-9a-f]{64}$' or p_sha256!~'^[0-9a-f]{64}$'
    or p_provider is null or p_provider='' or p_external_id is null or p_external_id=''
    or p_object_ref is null or p_object_ref='' then
    raise exception 'INVOICE_PROVIDER_RECEIPT_INVALID';
  end if;
  stored_claim=encode(public.digest(p_claim_token,'sha256'),'hex');
  select * into target from invoice.request where id=p_request for update;
  if not found then raise exception 'INVOICE_STATE_CONFLICT'; end if;
  if not exists(select 1 from invoice.requestprofile profile
    where profile.request_id=p_request and profile.owner_id=scope) then
    raise exception 'INVOICE_JOB_SCOPE_INVALID';
  end if;
  accepted=target.state='issuing' and target.issue_claim_hash=stored_claim
    and target.issue_claim_until>clock_timestamp()
    and not exists(select 1 from invoice.document where request_id=p_request);

  insert into invoice.issueartifact(id,request_id,claim_hash,provider,external_id,object_ref,sha256,state,created_at)
  values('invoiceartifact:'||stored_claim,p_request,stored_claim,p_provider,p_external_id,p_object_ref,p_sha256,
    case when accepted then 'pending' else 'orphan' end,clock_timestamp())
  on conflict(request_id,claim_hash) do nothing;
  select * into artifact from invoice.issueartifact where request_id=p_request and claim_hash=stored_claim;
  if not found or artifact.provider<>p_provider or artifact.external_id<>p_external_id
    or artifact.object_ref<>p_object_ref or artifact.sha256<>p_sha256 then
    raise exception 'INVOICE_ARTIFACT_REPLAY_CONFLICT';
  end if;
  if not accepted and artifact.state='pending' then
    update invoice.issueartifact set state='orphan' where id=artifact.id;
  end if;
  return accepted and artifact.state='pending';
end $function$;

create or replace function invoice.release_issue_claim(p_request text,p_claim_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path=invoice,public,pg_temp
as $function$
declare
  stored_claim text;
  released text;
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'jobs' or scope is null then
    raise exception 'INVOICE_JOB_CONTEXT_REQUIRED';
  end if;
  if p_claim_token!~'^[0-9a-f]{64}$' then return false; end if;
  stored_claim=encode(public.digest(p_claim_token,'sha256'),'hex');
  update invoice.request request set issue_claim_hash=null,issue_claim_until=null,version=version+1
  from invoice.requestprofile profile where request.id=p_request and profile.request_id=request.id
    and profile.owner_id=scope and request.state='issuing' and request.issue_claim_hash=stored_claim
  returning request.id into released;
  if released is not null then
    update invoice.issueartifact set state='orphan',finalized_at=null
    where request_id=p_request and claim_hash=stored_claim and state='pending';
  end if;
  return released is not null;
end $function$;

-- The registered provider receipt, immutable document, status transitions,
-- artifact finalization and outbox event commit in one database statement.
create or replace function invoice.finalize_issue(
  p_request text,
  p_claim_token text,
  p_snapshot_hash text,
  p_provider text,
  p_external_id text,
  p_object_ref text,
  p_sha256 text
)
returns boolean
language plpgsql
volatile
security definer
set search_path=invoice,runtime,public,pg_temp
as $function$
declare
  target invoice.request%rowtype;
  original_document invoice.document%rowtype;
  target_event_type text;
  event_id text;
  stored_claim text;
  scope text:=nullif(current_setting('app.scope_id',true),'');
begin
  if current_setting('app.workload',true)<>'jobs' or scope is null then
    raise exception 'INVOICE_JOB_CONTEXT_REQUIRED';
  end if;
  if p_claim_token!~'^[0-9a-f]{64}$' or p_snapshot_hash!~'^[0-9a-f]{64}$' or p_sha256!~'^[0-9a-f]{64}$'
    or p_provider is null or p_provider='' or p_external_id is null or p_external_id=''
    or p_object_ref is null or p_object_ref='' then
    raise exception 'INVOICE_PROVIDER_RECEIPT_INVALID';
  end if;
  stored_claim=encode(public.digest(p_claim_token,'sha256'),'hex');

  select * into target from invoice.request where id=p_request for update;
  if not found then raise exception 'INVOICE_STATE_CONFLICT'; end if;
  if not exists(select 1 from invoice.requestprofile profile
    where profile.request_id=p_request and profile.owner_id=scope) then
    raise exception 'INVOICE_JOB_SCOPE_INVALID';
  end if;
  if target.state<>'issuing' or target.issue_claim_hash<>stored_claim
    or target.issue_claim_until<=clock_timestamp() then return false; end if;
  if not exists(select 1 from invoice.issueartifact where request_id=p_request and claim_hash=stored_claim
      and provider=p_provider and external_id=p_external_id and object_ref=p_object_ref and sha256=p_sha256 and state='pending') then
    raise exception 'INVOICE_ARTIFACT_NOT_REGISTERED';
  end if;
  if invoice.assert_issue_snapshot(p_request)<>p_snapshot_hash then
    raise exception 'INVOICE_SNAPSHOT_CHANGED';
  end if;

  if target.kind='red' then
    select document.* into original_document from invoice.document document
    join invoice.request request on request.id=document.request_id
    where request.id=target.red_of_request_id and request.state='issued' and document.kind='original'
    for update of request,document;
    if not found then raise exception 'INVOICE_ORIGINAL_DOCUMENT_MISSING'; end if;
  end if;

  insert into invoice.document(id,request_id,provider,external_id,object_ref,sha256,issued_at,kind,red_of_id)
  values('document:'||target.id,target.id,p_provider,p_external_id,p_object_ref,p_sha256,clock_timestamp(),
    target.kind,case when target.kind='red' then original_document.id else null end);
  update invoice.request set state='issued',issue_claim_hash=null,issue_claim_until=null,version=version+1
  where id=target.id and state='issuing' and issue_claim_hash=stored_claim;
  if not found then raise exception 'INVOICE_STATE_CONFLICT'; end if;
  insert into invoice.statusevent(request_id,sequence,state,occurred_at)
  select target.id,coalesce(max(sequence),0)+1,'issued',clock_timestamp()
  from invoice.statusevent where request_id=target.id;

  if target.kind='red' then
    update invoice.request set state='red',version=version+1 where id=target.red_of_request_id and state='issued';
    if not found then raise exception 'INVOICE_RED_STATE_CONFLICT'; end if;
    insert into invoice.statusevent(request_id,sequence,state,occurred_at)
    select target.red_of_request_id,coalesce(max(sequence),0)+1,'red',clock_timestamp()
    from invoice.statusevent where request_id=target.red_of_request_id;
  end if;

  target_event_type=case when target.kind='red' then 'invoice.red.issued' else 'invoice.issued' end;
  event_id='event:finance:invoice:'||target.id;
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values(event_id,target_event_type,1,'invoice',target.id,
    (select owner_id from invoice.requestprofile where request_id=target.id),
    jsonb_build_object('request',target.id,'kind',target.kind,'amountMinor',target.amount_minor,
      'currency',target.currency,'documentHash',p_sha256),
    event_id,clock_timestamp(),clock_timestamp())
  on conflict(id) do nothing;
  if not exists(select 1 from runtime.outbox where id=event_id and runtime.outbox.event_type=target_event_type
      and aggregate_type='invoice' and aggregate_id=target.id and payload->>'documentHash'=p_sha256) then
    raise exception 'INVOICE_OUTBOX_CONFLICT';
  end if;
  update invoice.issueartifact set state='final',finalized_at=clock_timestamp()
  where request_id=target.id and claim_hash=stored_claim and state='pending';
  if not found then raise exception 'INVOICE_ARTIFACT_STATE_CONFLICT'; end if;
  return true;
end $function$;

-- Prevent concurrent red requests from issuing more than one effective credit
-- document for the same original invoice.
do $assert_red$
begin
  if exists(
    select line.settlement_line_id from invoice.requestline line
    join invoice.request request on request.id=line.request_id
    where line.kind='original' and request.state not in('rejected','cancelled')
    group by line.settlement_line_id having count(*)>1
  ) then raise exception 'INVOICE_MULTIPLE_ACTIVE_ORIGINAL_REQUESTS'; end if;
  if exists(select 1 from invoice.request where red_of_request_id is not null
    and state not in('rejected','cancelled') group by red_of_request_id having count(*)>1) then
    raise exception 'INVOICE_MULTIPLE_ACTIVE_RED_REQUESTS';
  end if;
end $assert_red$;
create unique index if not exists invoice_request_single_active_red
  on invoice.request(red_of_request_id)
  where red_of_request_id is not null and state not in('rejected','cancelled');

revoke all on function invoice.assert_issue_snapshot(text),invoice.guard_request_fact(),invoice.guard_request_create(),invoice.guard_profile_owner(),
  invoice.record_failed_issue(),
  invoice.guard_snapshot_fact(),invoice.validate_request_line(),invoice.validate_rendered_line(),invoice.guard_document_fact(),
  invoice.guard_status_fact(),invoice.assert_consumed_financial_proof(text,text,bigint),
  invoice.create_request(text,text,text,bigint,text[],text,jsonb,bigint),invoice.create_red_request(text,text,text,jsonb,bigint),
  invoice.seal_request(text,bigint),
  invoice.cancel_request(text,bigint),invoice.decide_request(text,text,text,jsonb,bigint),invoice.fail_issue(text,text,text),
  invoice.claim_issue(text),invoice.register_issue_artifact(text,text,text,text,text,text),
  invoice.release_issue_claim(text,text),invoice.finalize_issue(text,text,text,text,text,text,text) from public,shopapp,shopjob;
grant execute on function invoice.create_request(text,text,text,bigint,text[],text,jsonb,bigint),
  invoice.create_red_request(text,text,text,jsonb,bigint),invoice.cancel_request(text,bigint),
  invoice.decide_request(text,text,text,jsonb,bigint) to shopapp;
grant execute on function invoice.claim_issue(text),invoice.register_issue_artifact(text,text,text,text,text,text),
  invoice.release_issue_claim(text,text),invoice.finalize_issue(text,text,text,text,text,text,text),
  invoice.fail_issue(text,text,text) to shopjob;

-- Neither application nor worker roles have direct access to critical invoice
-- facts; every create, transition and provider receipt goes through a scoped
-- function above.
revoke insert,update,delete on invoice.request from shopjob;
revoke insert,update,delete on invoice.request from shopapp;
revoke insert,update,delete on invoice.document from shopapp,shopjob;
revoke insert,update,delete on invoice.line,invoice.requestline,invoice.requestprofile,invoice.statusevent from shopjob;
revoke insert,update,delete on invoice.line,invoice.requestline,invoice.requestprofile from shopapp;
revoke insert,update,delete on invoice.statusevent from shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260828094000','b7ec4d803560331519020c87d68ff90f2f617ce9308c60022cb7109f736af739');

do $assert$
begin
  if has_table_privilege('shopjob','invoice.request','UPDATE')
    or has_table_privilege('shopjob','invoice.document','INSERT')
    or has_table_privilege('shopjob','invoice.line','INSERT')
    or has_table_privilege('shopjob','invoice.requestline','INSERT')
    or has_table_privilege('shopjob','invoice.requestprofile','INSERT')
    or has_table_privilege('shopjob','invoice.statusevent','INSERT')
    or has_table_privilege('shopapp','invoice.document','INSERT')
    or has_table_privilege('shopapp','invoice.request','INSERT')
    or has_table_privilege('shopapp','invoice.line','INSERT')
    or has_table_privilege('shopapp','invoice.requestline','INSERT')
    or has_table_privilege('shopapp','invoice.requestprofile','INSERT')
    or has_table_privilege('shopapp','invoice.line','UPDATE')
    or has_table_privilege('shopapp','invoice.requestline','DELETE') then
    raise exception 'INVOICE_DIRECT_WRITE_BOUNDARY_OPEN';
  end if;
  if has_column_privilege('shopjob','invoice.request','state','UPDATE')
    or has_column_privilege('shopjob','invoice.request','evidence','UPDATE')
    or has_column_privilege('shopjob','invoice.request','version','UPDATE')
    or has_column_privilege('shopapp','invoice.request','state','UPDATE')
    or has_table_privilege('shopapp','invoice.statusevent','INSERT') then
    raise exception 'INVOICE_TRANSITION_WRITE_BOUNDARY_OPEN';
  end if;
  if not has_function_privilege('shopapp','invoice.create_request(text,text,text,bigint,text[],text,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('shopapp','invoice.create_red_request(text,text,text,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('shopapp','invoice.cancel_request(text,bigint)','EXECUTE')
    or not has_function_privilege('shopapp','invoice.decide_request(text,text,text,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('shopjob','invoice.fail_issue(text,text,text)','EXECUTE')
    or has_function_privilege('shopapp','invoice.seal_request(text,bigint)','EXECUTE')
    or has_function_privilege('shopjob','invoice.create_request(text,text,text,bigint,text[],text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('shopjob','invoice.create_red_request(text,text,text,jsonb,bigint)','EXECUTE') then
    raise exception 'INVOICE_TRANSITION_FUNCTION_MISSING';
  end if;
  if not has_function_privilege('shopjob','invoice.claim_issue(text)','EXECUTE')
    or not has_function_privilege('shopjob','invoice.register_issue_artifact(text,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('shopjob','invoice.release_issue_claim(text,text)','EXECUTE')
    or not has_function_privilege('shopjob','invoice.finalize_issue(text,text,text,text,text,text,text)','EXECUTE')
    or has_function_privilege('shopapp','invoice.claim_issue(text)','EXECUTE')
    or has_function_privilege('shopapp','invoice.register_issue_artifact(text,text,text,text,text,text)','EXECUTE')
    or has_function_privilege('shopapp','invoice.release_issue_claim(text,text)','EXECUTE')
    or has_function_privilege('shopapp','invoice.finalize_issue(text,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'INVOICE_CONTROLLED_WRITE_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828094000') then
    raise exception 'TARGET_SCHEMA_VERSION_MISSING';
  end if;
end $assert$;

commit;
