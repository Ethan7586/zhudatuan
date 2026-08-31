begin;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831014000:aftersale:'||aftersale.id),'20260831014000','ordering.aftersale',aftersale.id,
  'AFTERSALE_PROCESSING_BRANCH_AMBIGUOUS',jsonb_build_object('state',aftersale.state,'order',aftersale.order_id,
    'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',refund.id,'state',refund.state) order by refund.id)
      from payment.refund refund where refund.aftersale_id=aftersale.id),'[]'::jsonb),
    'returns',coalesce((select jsonb_agg(jsonb_build_object('id',returned.id,'state',returned.state) order by returned.id)
      from fulfillment.returnrecord returned where returned.aftersale_id=aftersale.id),'[]'::jsonb)),
  'open',clock_timestamp()
from ordering.aftersale aftersale where aftersale.state='processing'
on conflict(migration,aggregate_type,aggregate_id) do nothing;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831014000:tender:'||aftersale.id),'20260831014000','ordering.aftersale',aftersale.id,
  'AFTERSALE_TENDER_SNAPSHOT_MISSING',jsonb_build_object('order',orders.id,'evidence',orders.evidence),'open',clock_timestamp()
from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
where aftersale.state not in('rejected','cancelled') and (
  coalesce(jsonb_typeof(orders.evidence->'tenders'),'null')<>'array'
  or jsonb_array_length(case when jsonb_typeof(orders.evidence->'tenders')='array' then orders.evidence->'tenders' else '[]'::jsonb end)=0)
on conflict(migration,aggregate_type,aggregate_id) do nothing;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831014000:fulfilled:'||aftersale.id),'20260831014000','ordering.aftersale',aftersale.id,
  'AFTERSALE_FULFILLED_LINE_MISSING',jsonb_build_object('order',orders.id,'line',aftersale.line_id,'fulfillmentState',orders.fulfillment_state),
  'open',clock_timestamp()
from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
where aftersale.state not in('rejected','cancelled') and orders.fulfillment_state not in('received','returned')
  and not exists(
    select 1 from fulfillment.fulfillmentorder fulfillment join fulfillment.line line on line.fulfillment_id=fulfillment.id
    where fulfillment.order_id=orders.id and fulfillment.state='completed'
      and (aftersale.line_id is null or line.order_line_id=aftersale.line_id))
on conflict(migration,aggregate_type,aggregate_id) do nothing;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831014000:return:'||returned.id),'20260831014000','fulfillment.return',returned.id,
  'RETURN_INSPECTION_RESULT_AMBIGUOUS',jsonb_build_object('state',returned.state,'inspection',returned.inspection),
  'open',clock_timestamp()
from fulfillment.returnrecord returned where returned.state='inspected'
on conflict(migration,aggregate_type,aggregate_id) do nothing;

commit;

do $$
begin
  if exists(select 1 from runtime.migrationexception where migration='20260831014000' and state='open') then
    raise exception 'AFTERSALE_LIFECYCLE_MIGRATION_BLOCKED';
  end if;
end
$$;

begin;

insert into runtime.event(type,version,owner,schema_ref) values
  ('aftersale.applied',1,'order','contract://events/aftersale.applied/v1'),
  ('aftersale.changed',1,'order','contract://events/aftersale.changed/v1'),
  ('return.inspected',1,'fulfillment','contract://events/return.inspected/v1');

update runtime.contractcatalog set event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

alter table ordering.line
  add column fulfilled_quantity bigint not null default 0 check(fulfilled_quantity between 0 and quantity),
  add column aftersale_quantity bigint not null default 0 check(aftersale_quantity between 0 and fulfilled_quantity),
  add column fulfilled_at timestamptz;

with completed as (
  select line.order_line_id,sum(line.quantity) quantity,max(milestone.occurred_at) fulfilled_at
  from fulfillment.line line join fulfillment.fulfillmentorder fulfillment on fulfillment.id=line.fulfillment_id
  left join fulfillment.milestone milestone on milestone.fulfillment_id=fulfillment.id
    and lower(milestone.state) in('delivered','completed','pickedup')
  where fulfillment.state='completed' group by line.order_line_id
)
update ordering.line line set fulfilled_quantity=least(line.quantity,completed.quantity),
  fulfilled_at=coalesce(completed.fulfilled_at,orders.received_at,orders.updated_at)
from completed,ordering.orderrecord orders where completed.order_line_id=line.id and orders.id=line.order_id;

update ordering.line line set fulfilled_quantity=line.quantity,
  fulfilled_at=coalesce(orders.received_at,orders.updated_at)
from ordering.orderrecord orders where orders.id=line.order_id and line.fulfilled_quantity=0
  and orders.fulfillment_state in('received','returned');

alter table ordering.aftersale drop constraint aftersale_state_check;
alter table ordering.orderrecord drop constraint orderrecord_aftersale_state_check;

alter table ordering.aftersale
  add column reason_code text,
  add column description text,
  add column currency char(3),
  add column expected_refund_minor bigint,
  add column expected_refund jsonb,
  add column requires_return boolean,
  add column unavailable_reason text;

update ordering.aftersale aftersale set
  state=case aftersale.state when 'requested' then 'reviewing' when 'completed' then 'resolved' when 'cancelled' then 'rejected' else aftersale.state end,
  reason_code=left(aftersale.reason,64),description=aftersale.reason,currency=orders.currency,
  expected_refund_minor=coalesce(aftersale.amount_minor,orders.total_minor),
  expected_refund=jsonb_build_object('totalMinor',coalesce(aftersale.amount_minor,orders.total_minor),'currency',orders.currency,
    'tenders',coalesce(orders.evidence->'tenders','[]'::jsonb)),
  requires_return=coalesce((select not bool_and(coalesce(line.evidence->>'productType','physical') in('digital','virtual','voucher','service'))
    from ordering.line line where line.order_id=aftersale.order_id and (aftersale.line_id is null or line.id=aftersale.line_id)),true)
from ordering.orderrecord orders where orders.id=aftersale.order_id;

with expanded as (
  select aftersale.id,aftersale.expected_refund_minor,aftersale.currency,tender.value,tender.ordinality,
    (tender.value->>'amountMinor')::bigint capacity,
    coalesce(sum((tender.value->>'amountMinor')::bigint) over(partition by aftersale.id order by tender.ordinality desc
      rows between unbounded preceding and 1 preceding),0) later
  from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(orders.evidence->'tenders')='array'
    then orders.evidence->'tenders' else '[]'::jsonb end) with ordinality tender(value,ordinality)
), plans as (
  select id,jsonb_agg(jsonb_build_object('kind',value->>'kind','reference',value->'reference','amountMinor',
    greatest(0,least(capacity,expected_refund_minor-later))) order by ordinality desc)
    filter(where greatest(0,least(capacity,expected_refund_minor-later))>0) tenders
  from expanded group by id
)
update ordering.aftersale aftersale set expected_refund=jsonb_build_object('totalMinor',aftersale.expected_refund_minor,
  'currency',aftersale.currency,'tenders',coalesce(plans.tenders,'[]'::jsonb)) from plans where plans.id=aftersale.id;

alter table ordering.aftersale
  alter column reason_code set not null,
  alter column description set not null,
  alter column currency set not null,
  alter column expected_refund_minor set not null,
  alter column expected_refund set not null,
  alter column requires_return set not null,
  add constraint aftersale_state_check check(state in('applied','reviewing','approved','returning','received','refunding','resolved','rejected')),
  add constraint aftersale_expected_refund_nonnegative check(expected_refund_minor>=0),
  add constraint aftersale_expected_refund_object check(jsonb_typeof(expected_refund)='object'),
  add constraint aftersale_currency_format check(currency~'^[A-Z]{3}$'),
  add constraint aftersale_version_nonnegative check(version>=0);

update ordering.aftersale set state='refunding',version=version+1,updated_at=clock_timestamp()
where state='approved' and not requires_return;

insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
select 'job:return:'||aftersale.id,'returnauthorize','fulfillment',orders.scope_id,
  jsonb_build_object('aftersale',aftersale.id),'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp()
from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
where aftersale.state='approved' and aftersale.requires_return on conflict(id) do nothing;

insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
select 'job:refund:'||aftersale.id,'paymentrefund','payment',orders.scope_id,
  jsonb_build_object('aftersale',aftersale.id),'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp()
from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
where aftersale.state='refunding' on conflict(id) do nothing;

update ordering.orderrecord orders set aftersale_state=coalesce((
  select aftersale.state from ordering.aftersale aftersale where aftersale.order_id=orders.id
  order by aftersale.updated_at desc,aftersale.id desc limit 1
),'none') where exists(select 1 from ordering.aftersale aftersale where aftersale.order_id=orders.id);

update ordering.orderrecord set aftersale_state='none'
where aftersale_state not in('none','applied','reviewing','approved','returning','received','refunding','resolved','rejected');

alter table ordering.orderrecord add constraint orderrecord_aftersale_state_check
  check(aftersale_state in('none','applied','reviewing','approved','returning','received','refunding','resolved','rejected'));

create table ordering.aftersaleline(
  aftersale_id text not null references ordering.aftersale(id) on delete cascade,
  line_id text not null references ordering.line(id),
  sku_id text not null,
  listing_id text not null,
  title_snapshot text not null,
  product_type text not null,
  provider text,
  purchased_quantity bigint not null check(purchased_quantity>0),
  fulfilled_quantity bigint not null check(fulfilled_quantity between 0 and purchased_quantity),
  claimed_quantity bigint not null check(claimed_quantity>=0),
  requested_quantity bigint not null check(requested_quantity>0 and requested_quantity<=fulfilled_quantity),
  maximum_quantity bigint not null check(maximum_quantity>=requested_quantity),
  unit_minor bigint not null check(unit_minor>=0),
  refund_minor bigint not null check(refund_minor>=0),
  policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object'),
  unavailable_reason text,
  primary key(aftersale_id,line_id)
);

insert into ordering.aftersaleline(aftersale_id,line_id,sku_id,listing_id,title_snapshot,product_type,provider,
  purchased_quantity,fulfilled_quantity,claimed_quantity,requested_quantity,maximum_quantity,unit_minor,refund_minor,policy_snapshot,unavailable_reason)
select aftersale.id,line.id,line.sku_id,line.listing_id,line.title_snapshot,coalesce(line.evidence->>'productType','physical'),line.provider,
  line.quantity,line.fulfilled_quantity,0,least(coalesce(aftersale.quantity,line.fulfilled_quantity),line.fulfilled_quantity),line.fulfilled_quantity,
  case when line.quantity=0 then 0 else floor(line.payable_minor::numeric/line.quantity)::bigint end,
  case when aftersale.line_id is not null then aftersale.expected_refund_minor
    else floor(aftersale.expected_refund_minor::numeric*line.payable_minor/nullif(sum(line.payable_minor) over(partition by aftersale.id),0))::bigint end,
  jsonb_build_object('id','migration','version',1),null
from ordering.aftersale aftersale join ordering.line line on line.order_id=aftersale.order_id
  and (aftersale.line_id is null or line.id=aftersale.line_id)
where line.fulfilled_quantity>0;

update ordering.line line set aftersale_quantity=least(line.fulfilled_quantity,coalesce(claimed.quantity,0))
from (select target.line_id,sum(target.requested_quantity) quantity from ordering.aftersaleline target
  join ordering.aftersale aftersale on aftersale.id=target.aftersale_id where aftersale.state<>'rejected' group by target.line_id) claimed
where claimed.line_id=line.id;

create function ordering.assert_aftersale_line_quantity(p_line text) returns void language plpgsql
set search_path=ordering,pg_temp as $function$
declare fulfilled bigint; claimed bigint; recorded bigint;
begin
  select line.fulfilled_quantity,line.aftersale_quantity into strict fulfilled,recorded
  from ordering.line line where line.id=p_line for update;
  select coalesce(sum(sale_line.requested_quantity),0) into strict claimed
  from ordering.aftersaleline sale_line join ordering.aftersale sale on sale.id=sale_line.aftersale_id
  where sale_line.line_id=p_line and sale.state<>'rejected';
  if claimed>fulfilled or recorded<>claimed then raise exception 'AFTERSALE_LINE_QUANTITY_INCONSISTENT'; end if;
end
$function$;

create function ordering.enforce_aftersale_line_quantity() returns trigger language plpgsql
set search_path=ordering,pg_temp as $function$
declare line_id text;
begin
  if tg_table_name='aftersaleline' then
    line_id=case when tg_op='DELETE' then old.line_id else new.line_id end;
    perform ordering.assert_aftersale_line_quantity(line_id);
    if tg_op='UPDATE' and old.line_id<>new.line_id then perform ordering.assert_aftersale_line_quantity(old.line_id); end if;
  else
    for line_id in select distinct sale_line.line_id from ordering.aftersaleline sale_line
      where sale_line.aftersale_id=case when tg_op='DELETE' then old.id else new.id end
    loop perform ordering.assert_aftersale_line_quantity(line_id); end loop;
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

create constraint trigger enforce_aftersale_line_quantity after insert or update or delete on ordering.aftersaleline
deferrable initially deferred for each row execute function ordering.enforce_aftersale_line_quantity();
create constraint trigger enforce_aftersale_state_quantity after update of state on ordering.aftersale
deferrable initially deferred for each row execute function ordering.enforce_aftersale_line_quantity();

create table ordering.aftersaleattachment(
  aftersale_id text not null references ordering.aftersale(id) on delete cascade,
  sequence integer not null check(sequence>0),
  object_id text not null,
  file_name text not null,
  media_type text not null,
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  content_hash char(64) not null check(content_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  primary key(aftersale_id,sequence),
  unique(aftersale_id,object_id)
);

create table ordering.aftersaletimeline(
  id text primary key,
  aftersale_id text not null references ordering.aftersale(id) on delete cascade,
  sequence bigint not null check(sequence>0),
  kind text not null,
  previous_state text,
  next_state text not null check(next_state in('applied','reviewing','approved','returning','received','refunding','resolved','rejected')),
  actor_id text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  occurred_at timestamptz not null,
  unique(aftersale_id,sequence)
);

insert into ordering.aftersaletimeline(id,aftersale_id,sequence,kind,previous_state,next_state,actor_id,evidence,occurred_at)
select 'timeline:migration:'||aftersale.id,aftersale.id,1,'migration',null,aftersale.state,'system:migration',
  jsonb_build_object('migration','20260831014000'),aftersale.updated_at from ordering.aftersale aftersale;

update ordering.reviewaction set previous_state='reviewing' where previous_state='requested';

alter table ordering.aftersale drop column line_id,drop column quantity,drop column reason;

alter table fulfillment.returnrecord
  add column scope_id text,
  add column provider text,
  add column provider_reference text,
  add column instruction jsonb not null default '{}'::jsonb,
  add column created_at timestamptz,
  add column updated_at timestamptz;

update fulfillment.returnrecord returned set scope_id=orders.scope_id,provider=fulfillment.provider,
  created_at=coalesce(orders.updated_at,clock_timestamp()),updated_at=coalesce(orders.updated_at,clock_timestamp()),
  state=case returned.state when 'inspected' then 'received' else returned.state end
from fulfillment.fulfillmentorder fulfillment join ordering.orderrecord orders on orders.id=fulfillment.order_id
where fulfillment.id=returned.fulfillment_id;

alter table fulfillment.returnrecord drop constraint returnrecord_state_check;
alter table fulfillment.returnrecord
  alter column scope_id set not null,
  alter column created_at set not null,
  alter column updated_at set not null,
  add constraint returnrecord_state_check check(state in('authorized','intransit','received','accepted','rejected')),
  add constraint returnrecord_instruction_object check(jsonb_typeof(instruction)='object'),
  add constraint returnrecord_version_nonnegative check(version>=0),
  add constraint returnrecord_provider_reference_owner check(provider_reference is null or provider is not null);
create unique index fulfillment_return_provider_reference on fulfillment.returnrecord(scope_id,provider,provider_reference) where provider_reference is not null;
create unique index fulfillment_return_aftersale_fulfillment on fulfillment.returnrecord(aftersale_id,fulfillment_id);

create table fulfillment.returnline(
  return_id text not null references fulfillment.returnrecord(id) on delete cascade,
  order_line_id text not null,
  quantity bigint not null check(quantity>0),
  primary key(return_id,order_line_id)
);

insert into fulfillment.returnline(return_id,order_line_id,quantity)
select returned.id,line.order_line_id,line.quantity from fulfillment.returnrecord returned
join fulfillment.line line on line.fulfillment_id=returned.fulfillment_id on conflict do nothing;

create table fulfillment.inspection(
  id text primary key,
  return_id text not null references fulfillment.returnrecord(id),
  sequence bigint not null check(sequence>0),
  accepted boolean not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  actor_id text not null,
  inspected_at timestamptz not null,
  unique(return_id,sequence)
);

insert into fulfillment.inspection(id,return_id,sequence,accepted,evidence,actor_id,inspected_at)
select 'inspection:migration:'||returned.id,returned.id,1,returned.state='accepted',coalesce(returned.inspection,'{}'),
  'system:migration',returned.updated_at from fulfillment.returnrecord returned where returned.state in('accepted','rejected');

alter table fulfillment.returnrecord drop column inspection;

alter table ordering.aftersaleline enable row level security;
alter table ordering.aftersaleattachment enable row level security;
alter table ordering.aftersaletimeline enable row level security;
alter table fulfillment.returnline enable row level security;
alter table fulfillment.inspection enable row level security;

create policy appscope on ordering.aftersaleline for all to shopapp using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobscope on ordering.aftersaleline for all to shopjob using(true) with check(true);
create policy appscope on ordering.aftersaleattachment for all to shopapp using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobscope on ordering.aftersaleattachment for all to shopjob using(true) with check(true);
create policy appscope on ordering.aftersaletimeline for all to shopapp using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobscope on ordering.aftersaletimeline for all to shopjob using(true) with check(true);
create policy appscope on fulfillment.returnline for all to shopapp using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobscope on fulfillment.returnline for all to shopjob using(true) with check(true);
create policy appscope on fulfillment.inspection for all to shopapp using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobscope on fulfillment.inspection for all to shopjob using(true) with check(true);

drop policy appscope on fulfillment.returnrecord;
create policy appscope on fulfillment.returnrecord for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));

grant select,insert,update,delete on ordering.aftersaleline,ordering.aftersaleattachment,ordering.aftersaletimeline,
  fulfillment.returnline,fulfillment.inspection to shopapp,shopjob;

create function channel.authorize_supplier_return(p_scope text,p_key text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=channel,pg_temp as $function$
declare configured jsonb; reference text;
begin
  if jsonb_typeof(p_request)<>'object' or nullif(p_key,'') is null then raise exception 'SUPPLIER_RETURN_REQUEST_INVALID'; end if;
  reference=nullif(p_request->>'reference','');
  if reference is null or jsonb_typeof(p_request->'lines')<>'array' or jsonb_array_length(p_request->'lines')=0
    then raise exception 'SUPPLIER_RETURN_REQUEST_INVALID'; end if;
  select connection.configuration->'returnInstruction' into configured from channel.connection connection
  where connection.provider='supplier' and connection.scope_id=p_scope and connection.status='enabled';
  if jsonb_typeof(configured)<>'object' then raise exception 'SUPPLIER_RETURN_INSTRUCTION_MISSING'; end if;
  return jsonb_build_object('externalReference','return:'||reference,'state','authorized','instruction',configured);
end
$function$;
revoke all on function channel.authorize_supplier_return(text,text,jsonb) from public;
grant execute on function channel.authorize_supplier_return(text,text,jsonb) to shopjob;

do $roles$
begin
  if exists(select 1 from pg_roles where rolname='zhudatuanwebapi') then
    execute 'grant select on ordering.aftersaleline,ordering.aftersaleattachment,ordering.aftersaletimeline,fulfillment.returnrecord,fulfillment.returnline,fulfillment.inspection to zhudatuanwebapi';
  end if;
end
$roles$;

do $$
begin
  if exists(select 1 from pg_constraint where conrelid='payment.refund'::regclass and confrelid='ordering.aftersale'::regclass) then
    raise exception 'PAYMENT_AFTERSALE_CROSS_MODULE_FK_REMAINS';
  end if;
  if exists(select 1 from ordering.line where aftersale_quantity>fulfilled_quantity or fulfilled_quantity>quantity) then
    raise exception 'AFTERSALE_QUANTITY_INTEGRITY_FAILED';
  end if;
end
$$;

commit;
