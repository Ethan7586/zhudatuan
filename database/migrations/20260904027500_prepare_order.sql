begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904027000') then raise exception 'ORDER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904027500') then raise exception 'ORDER_ALREADY_APPLIED'; end if;
end $precondition$;

alter table ordering.orderrecord
  add column external_reference text,
  add column source_channel text,
  add column source_state text,
  add column verification_state text not null default 'verified',
  add column ordered_at timestamptz,
  add column import_id text,
  add column amount_snapshot jsonb;
update ordering.orderrecord orders set ordered_at=orders.created_at,
  amount_snapshot=jsonb_build_object(
    'subtotalMinor',coalesce((select sum(line.total_minor) from ordering.line line where line.order_id=orders.id),orders.total_minor),
    'discountMinor',coalesce((select sum(line.discount_minor) from ordering.line line where line.order_id=orders.id),0),
    'shippingMinor',0,'taxMinor',0,'payableMinor',orders.total_minor,'currency',orders.currency
  );
alter table ordering.orderrecord alter column ordered_at set not null;
alter table ordering.orderrecord alter column amount_snapshot set not null;
alter table ordering.orderrecord alter column verification_state drop default;
alter table ordering.orderrecord add constraint order_source_pair check(
  (external_reference is null and source_channel is null and source_state is null and import_id is null)
  or (external_reference is not null and source_channel~'^[a-z][a-z0-9]{1,63}$' and source_state is not null and import_id is not null)
) not valid;
alter table ordering.orderrecord add constraint order_verification_state check(verification_state in('verified','pending','rejected')) not valid;
alter table ordering.orderrecord add constraint order_ordered_time check(ordered_at<=created_at+interval '5 minutes') not valid;
alter table ordering.orderrecord add constraint order_amount_snapshot check(
  jsonb_typeof(amount_snapshot)='object' and amount_snapshot->>'currency'=currency
  and (amount_snapshot->>'subtotalMinor')::bigint>=0 and (amount_snapshot->>'discountMinor')::bigint>=0
  and (amount_snapshot->>'shippingMinor')::bigint>=0 and (amount_snapshot->>'taxMinor')::bigint>=0
  and (amount_snapshot->>'discountMinor')::bigint<=(amount_snapshot->>'subtotalMinor')::bigint
  and (amount_snapshot->>'subtotalMinor')::bigint-(amount_snapshot->>'discountMinor')::bigint
    +(amount_snapshot->>'shippingMinor')::bigint+(amount_snapshot->>'taxMinor')::bigint=(amount_snapshot->>'payableMinor')::bigint
  and (amount_snapshot->>'payableMinor')::bigint=total_minor
) not valid;
alter table ordering.orderrecord validate constraint order_source_pair;
alter table ordering.orderrecord validate constraint order_verification_state;
alter table ordering.orderrecord validate constraint order_ordered_time;
alter table ordering.orderrecord validate constraint order_amount_snapshot;
create unique index order_external_identity on ordering.orderrecord(source_channel,external_reference) where external_reference is not null;
create index order_scope_ordered on ordering.orderrecord(scope_id,ordered_at desc,id desc);
create index order_verification_queue on ordering.orderrecord(scope_id,verification_state,ordered_at,id) where verification_state<>'verified';

update ordering.line set evidence=jsonb_build_object(
  'product',coalesce(nullif(evidence->>'product',''),listing_id),
  'productType',coalesce(nullif(evidence->>'productType',''),'unknown'),
  'category',coalesce(nullif(evidence->>'category',''),'unknown'),
  'versions',coalesce(evidence->'versions',jsonb_build_object('listing',0,'product',0,'sku',0,'price','historical','stock',0))
) where not (evidence ?& array['product','productType','category','versions']);
alter table ordering.line add constraint order_line_snapshot check(
  jsonb_typeof(evidence)='object' and evidence ?& array['product','productType','category','versions']
  and jsonb_typeof(evidence->'versions')='object'
) not valid;
alter table ordering.line validate constraint order_line_snapshot;

alter table ordering.stateevent add column evidence jsonb not null default '{}'::jsonb;
alter table ordering.stateevent add column version bigint not null default 0;
alter table ordering.stateevent add constraint order_stateevent_evidence check(jsonb_typeof(evidence)='object') not valid;
alter table ordering.stateevent add constraint order_stateevent_version check(version>=0) not valid;
alter table ordering.stateevent validate constraint order_stateevent_evidence;
alter table ordering.stateevent validate constraint order_stateevent_version;

create table ordering.importreceipt(
  import_id text not null,
  row_number integer not null check(row_number>=2),
  order_id text not null unique references ordering.orderrecord(id),
  source_channel text not null,
  external_reference text not null,
  payment_reference text,
  statement_reference text,
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  primary key(import_id,row_number),
  unique(source_channel,external_reference)
);
create unique index order_import_payment_evidence on ordering.importreceipt(payment_reference) where payment_reference is not null;
create unique index order_import_statement_evidence on ordering.importreceipt(statement_reference) where statement_reference is not null;
create index order_importreceipt_created on ordering.importreceipt(created_at desc,import_id,row_number);
alter table ordering.importreceipt enable row level security;
alter table ordering.importreceipt force row level security;
create policy orderimportread on ordering.importreceipt for select to shopapp using(
  exists(select 1 from ordering.orderrecord orders where orders.id=order_id and access.scope_allowed(orders.scope_id))
);
create policy orderimportjob on ordering.importreceipt for all to shopjob using(true) with check(true);
grant select on ordering.importreceipt to shopapp;
grant select,insert on ordering.importreceipt to shopjob;

create table ordering.paymenteffect(
  event_id text primary key,
  order_id text not null references ordering.orderrecord(id),
  scope_id text not null,
  source_id text not null,
  kind text not null check(kind in('capture','refund')),
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  evidence jsonb not null check(jsonb_typeof(evidence)='object' and evidence ? 'sourceId'),
  occurred_at timestamptz not null,
  unique(scope_id,kind,source_id)
);
create index order_paymenteffect_order on ordering.paymenteffect(order_id,kind,occurred_at,event_id);
alter table ordering.paymenteffect enable row level security;
alter table ordering.paymenteffect force row level security;
create policy orderpaymenteffectread on ordering.paymenteffect for select to shopapp using(access.scope_allowed(scope_id));
create policy orderpaymenteffectjob on ordering.paymenteffect for all to shopjob using(true) with check(true);
grant select on ordering.paymenteffect to shopapp;
grant select,insert on ordering.paymenteffect to shopjob;

create function ordering.assert_amount(p_order text) returns void language plpgsql security definer
set search_path=ordering,pg_temp set row_security=off as $function$
declare expected bigint; actual bigint;
begin
  select total_minor into expected from ordering.orderrecord where id=p_order;
  if expected is null then return; end if;
  select coalesce(sum(payable_minor),0) into actual from ordering.line where order_id=p_order;
  if actual<>expected then raise exception 'ORDER_AMOUNT_INVARIANT_VIOLATION'; end if;
end;
$function$;
create function ordering.enforce_amount() returns trigger language plpgsql security definer
set search_path=ordering,pg_temp set row_security=off as $function$
begin
  perform ordering.assert_amount(coalesce(new.order_id,old.order_id));
  return null;
end;
$function$;
create constraint trigger orderamountguard after insert or update or delete on ordering.line
deferrable initially deferred for each row execute function ordering.enforce_amount();
revoke all on function ordering.assert_amount(text) from public;
revoke all on function ordering.enforce_amount() from public;

create function ordering.guard_line() returns trigger language plpgsql security definer
set search_path=ordering,pg_temp set row_security=off as $function$
begin
  if tg_op='DELETE' then raise exception 'ORDER_LINE_IMMUTABLE'; end if;
  if tg_op='UPDATE' and (new.id,new.order_id,new.sku_id,new.listing_id,new.title_snapshot,new.quantity,new.unit_minor,
      new.total_minor,new.discount_minor,new.qualification_evidence_id,new.provider,new.partner_id,new.evidence)
    is distinct from (old.id,old.order_id,old.sku_id,old.listing_id,old.title_snapshot,old.quantity,old.unit_minor,
      old.total_minor,old.discount_minor,old.qualification_evidence_id,old.provider,old.partner_id,old.evidence)
    then raise exception 'ORDER_LINE_SNAPSHOT_IMMUTABLE'; end if;
  return new;
end;
$function$;
create trigger orderlineguard before update or delete on ordering.line for each row execute function ordering.guard_line();
revoke all on function ordering.guard_line() from public;

create function ordering.guard_order() returns trigger language plpgsql security definer
set search_path=ordering,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' then
    if new.version<>0 then raise exception 'ORDER_INITIAL_VERSION_INVALID'; end if;
    if new.verification_state<>'verified' and (new.payment_state<>'unpaid' or new.fulfillment_state<>'unallocated' or new.lifecycle_state<>'awaitingpayment')
      then raise exception 'ORDER_UNVERIFIED_FUNDS_FORBIDDEN'; end if;
    return new;
  end if;
  if (new.id,new.order_number,new.scope_id,new.member_id,new.mall_id,new.checkout_id,new.currency,new.total_minor,new.evidence,
      new.address_snapshot,new.invoice_snapshot,new.delivery_snapshot,new.experience_version,new.external_reference,new.source_channel,
      new.source_state,new.ordered_at,new.import_id,new.amount_snapshot,new.created_at)
    is distinct from
     (old.id,old.order_number,old.scope_id,old.member_id,old.mall_id,old.checkout_id,old.currency,old.total_minor,old.evidence,
      old.address_snapshot,old.invoice_snapshot,old.delivery_snapshot,old.experience_version,old.external_reference,old.source_channel,
      old.source_state,old.ordered_at,old.import_id,old.amount_snapshot,old.created_at)
    then raise exception 'ORDER_TRANSACTION_SNAPSHOT_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'ORDER_VERSION_CONFLICT'; end if;
  if old.lifecycle_state<>new.lifecycle_state and not (case old.lifecycle_state
      when 'created' then new.lifecycle_state in('awaitingpayment','cancelled')
      when 'awaitingpayment' then new.lifecycle_state in('paid','cancelled')
      when 'paid' then new.lifecycle_state in('fulfilling','shipped','received','completed')
      when 'fulfilling' then new.lifecycle_state in('shipped','received','completed')
      when 'shipped' then new.lifecycle_state in('received','completed')
      when 'received' then new.lifecycle_state='completed' else false end)
    then raise exception 'ORDER_LIFECYCLE_TRANSITION_INVALID'; end if;
  if old.payment_state<>new.payment_state and not (case old.payment_state
      when 'unpaid' then new.payment_state in('authorizing','paid','failed')
      when 'authorizing' then new.payment_state in('unpaid','paid','failed')
      when 'paid' then new.payment_state in('partially_refunded','refunded')
      when 'partially_refunded' then new.payment_state='refunded'
      when 'failed' then new.payment_state in('unpaid','paid') else false end)
    then raise exception 'ORDER_PAYMENT_TRANSITION_INVALID'; end if;
  if old.fulfillment_state<>new.fulfillment_state and not (case old.fulfillment_state
      when 'unallocated' then new.fulfillment_state in('allocated','cancelled')
      when 'allocated' then new.fulfillment_state in('processing','shipped','delivered','cancelled')
      when 'processing' then new.fulfillment_state in('shipped','delivered','cancelled')
      when 'shipped' then new.fulfillment_state in('delivered','received','returned')
      when 'delivered' then new.fulfillment_state in('received','returned')
      when 'received' then new.fulfillment_state='returned' else false end)
    then raise exception 'ORDER_FULFILLMENT_TRANSITION_INVALID'; end if;
  if old.aftersale_state<>new.aftersale_state and not (case old.aftersale_state
      when 'none' then new.aftersale_state='applied'
      when 'applied' then new.aftersale_state='reviewing'
      when 'reviewing' then new.aftersale_state in('approved','rejected')
      when 'approved' then new.aftersale_state in('returning','refunding')
      when 'returning' then new.aftersale_state='received'
      when 'received' then new.aftersale_state='refunding'
      when 'refunding' then new.aftersale_state='resolved' else false end)
    then raise exception 'ORDER_AFTERSALE_TRANSITION_INVALID'; end if;
  if old.verification_state<>new.verification_state and not (old.verification_state='pending' and new.verification_state in('verified','rejected'))
    then raise exception 'ORDER_VERIFICATION_TRANSITION_INVALID'; end if;
  if new.verification_state<>'verified' and (new.payment_state<>'unpaid' or new.fulfillment_state<>'unallocated' or new.lifecycle_state not in('awaitingpayment','cancelled'))
    then raise exception 'ORDER_UNVERIFIED_FUNDS_FORBIDDEN'; end if;
  return new;
end;
$function$;
create trigger orderrecordguard before insert or update on ordering.orderrecord for each row execute function ordering.guard_order();
revoke all on function ordering.guard_order() from public;

create function ordering.capture_state() returns trigger language plpgsql security definer
set search_path=ordering,pg_temp set row_security=off as $function$
declare actor text:=coalesce(nullif(current_setting('app.actor_id',true),''),'system:migration');
begin
  if tg_op='INSERT' then
    insert into ordering.stateevent(order_id,sequence,dimension,previous_state,next_state,reason,actor_id,occurred_at,evidence,version)
    values(new.id,coalesce((select max(sequence) from ordering.stateevent where order_id=new.id),0)+1,'order',null,new.lifecycle_state,
      'order created',actor,new.created_at,jsonb_build_object('payment',new.payment_state,'fulfillment',new.fulfillment_state,
      'aftersale',new.aftersale_state,'verification',new.verification_state,'source',new.source_channel),new.version);
    return new;
  end if;
  insert into ordering.stateevent(order_id,sequence,dimension,previous_state,next_state,reason,actor_id,occurred_at,evidence,version)
  select new.id,base.sequence+row_number() over(order by changed.dimension),changed.dimension,changed.previous,changed.next,
    'state transition',actor,new.updated_at,jsonb_build_object('trace',nullif(current_setting('app.trace_id',true),''),
      'operation',nullif(current_setting('app.operation_id',true),''),'verification',new.verification_state),new.version
  from (select coalesce(max(sequence),0) sequence from ordering.stateevent where order_id=new.id) base
  cross join lateral (
    select 'aftersale',old.aftersale_state,new.aftersale_state where old.aftersale_state<>new.aftersale_state
    union all select 'fulfillment',old.fulfillment_state,new.fulfillment_state where old.fulfillment_state<>new.fulfillment_state
    union all select 'lifecycle',old.lifecycle_state,new.lifecycle_state where old.lifecycle_state<>new.lifecycle_state
    union all select 'payment',old.payment_state,new.payment_state where old.payment_state<>new.payment_state
    union all select 'verification',old.verification_state,new.verification_state where old.verification_state<>new.verification_state
  ) changed(dimension,previous,next);
  return new;
end;
$function$;
create trigger orderstatecapture after insert or update on ordering.orderrecord for each row execute function ordering.capture_state();
revoke all on function ordering.capture_state() from public;

create function ordering.guard_stateevent() returns trigger language plpgsql security definer
set search_path=ordering,pg_temp set row_security=off as $function$
begin
  raise exception 'ORDER_STATE_EVENT_IMMUTABLE';
end;
$function$;
create trigger orderstateeventguard before update or delete on ordering.stateevent for each row execute function ordering.guard_stateevent();
revoke all on function ordering.guard_stateevent() from public;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('order.detail.read','order','GET','/api/v1/orders/{orderid}','5.0.0'),
  ('order.imports.create','order','POST','/api/v1/orders/imports','5.0.0'),
  ('order.imports.read','order','GET','/api/v1/orders/imports/{importid}','5.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:3fb209fd01b2ace1a5b12c9a','order.import.manage','critical','active'),
  ('permission:2da8d0e7f7e39e112d7d3e98','order.import.read','high','active');
alter table runtime.errorcontract disable row level security;
insert into runtime.errorcontract(code,status,retryable,audit,client,contract_version) values
  ('ORDER_REMINDER_NOT_ALLOWED',409,false,true,'message','5.0.0')
on conflict(code) do update set status=excluded.status,retryable=excluded.retryable,audit=excluded.audit,client=excluded.client,contract_version=excluded.contract_version;
alter table runtime.errorcontract enable row level security;
insert into capability.capability(id,kind,name,version,status) values
  ('order.detail.read','operation','order.detail.read',3,'active'),
  ('order.imports.create','operation','order.imports.create',3,'active'),
  ('order.imports.read','operation','order.imports.read',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('order.detail.read','order.detail.read','order.read','public','{console,storefront,miniapp,store,supplier}'),
  ('order.imports.create','order.imports.create','order.import.manage','console','{console}'),
  ('order.imports.read','order.imports.read','order.import.read','console','{console}');
insert into capability.dependency(capability_id,depends_on_id) values
  ('order.imports.create','runtime.importing'),('order.imports.read','runtime.importing');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||id,'organization-platform-root',id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability where id in('order.detail.read','order.imports.create','order.imports.read');

update runtime.operation set contract_version='5.0.0' where owner='order';
update capability.operation set audience='public',targets='{console,storefront,miniapp,store,supplier}' where operation_id='order.reminders.create';
update capability.capability set version=version+1 where id in(select id from runtime.operation where owner='order')
  and id not in('order.detail.read','order.imports.create','order.imports.read');
update runtime.contractcatalog set checksum='0b1566a88761bdd06b69454989192a7cd41769d931d51d36a1250f3d2d9aa277',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904027500',(select count(*) from ordering.orderrecord),(select count(*) from ordering.orderrecord),0,0,
  'create index concurrently if not exists order_event_retention on ordering.stateevent(occurred_at,order_id,sequence);',
  'select verification_state,count(*) from ordering.orderrecord group by verification_state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904027500',encode(public.digest('20260904027500_prepare_order','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from ordering.orderrecord where verification_state<>'verified' and
    (payment_state<>'unpaid' or fulfillment_state<>'unallocated' or lifecycle_state not in('awaitingpayment','cancelled')))
    then raise exception 'ORDER_UNVERIFIED_STATE_INVALID'; end if;
  if exists(select 1 from ordering.orderrecord orders where orders.total_minor<>(select coalesce(sum(line.payable_minor),0) from ordering.line line where line.order_id=orders.id))
    then raise exception 'ORDER_AMOUNT_INVARIANT_INVALID'; end if;
  if exists(select 1 from ordering.orderrecord where external_reference is not null group by source_channel,external_reference having count(*)>1)
    then raise exception 'ORDER_EXTERNAL_IDENTITY_INVALID'; end if;
  if (select count(*) from runtime.operation)<>316 then raise exception 'ORDER_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event)<>143 then raise exception 'ORDER_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
