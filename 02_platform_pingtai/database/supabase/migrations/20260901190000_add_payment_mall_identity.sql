begin;

alter table payment.intent add column mall_id text;
alter table payment.attempt add column mall_id text;
alter table payment.prepay add column mall_id text;
alter table payment.observation add column mall_id text;
alter table payment.providerattempt add column mall_id text;
alter table payment.effect add column mall_id text;
alter table payment.payment add column mall_id text;
alter table payment.allocation add column mall_id text;
alter table payment.refund add column mall_id text;
alter table payment.refundcommand add column mall_id text;
alter table payment.deadletterreview add column mall_id text;
alter table payment.recoverycase add column mall_id text;
alter table payment.recoveryrequest add column mall_id text;
alter table payment.intenttender add column mall_id text;
alter table payment.refundtender add column mall_id text;

update payment.intent target set mall_id=orders.mall_id
from ordering.orderrecord orders where orders.id=target.order_id;
update payment.attempt target set mall_id=intent.mall_id
from payment.intent intent where intent.id=target.intent_id;
update payment.prepay target set mall_id=intent.mall_id
from payment.intent intent where intent.id=target.intent_id;
update payment.intenttender target set mall_id=intent.mall_id
from payment.intent intent where intent.id=target.intent_id;
update payment.observation target set mall_id=attempt.mall_id
from payment.attempt attempt where attempt.id=target.attempt_id;
update payment.payment target set mall_id=intent.mall_id
from payment.intent intent where intent.id=target.intent_id;
update payment.allocation target set mall_id=captured.mall_id
from payment.payment captured where captured.id=target.payment_id;
update payment.refund target set mall_id=captured.mall_id
from payment.payment captured where captured.id=target.payment_id;
update payment.refundtender target set mall_id=refund.mall_id
from payment.refund refund where refund.id=target.refund_id;
update payment.refundcommand target set mall_id=refund.mall_id
from payment.refund refund where refund.id=target.refund_id;
update payment.providerattempt target set mall_id=refund.mall_id
from payment.refund refund where refund.id=target.refund_id;
update payment.effect target set mall_id=captured.mall_id
from payment.payment captured where captured.id=target.payment_id;
update payment.deadletterreview target set mall_id=coalesce(
  (select captured.mall_id from payment.payment captured where captured.id=target.payment_id),
  (select refund.mall_id from payment.refund refund where refund.id=target.refund_id));
update payment.recoverycase set mall_id=scope_id;
update payment.recoveryrequest target set mall_id=coalesce(
  (select recovery.mall_id from payment.recoverycase recovery where recovery.id=target.case_id),target.scope_id);

do $backfill$
declare report jsonb;
  conflict_count bigint;
begin
  select count(*) into conflict_count from(
    select 1 from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id where intent.mall_id<>orders.mall_id
    union all select 1 from payment.attempt child join payment.intent parent on parent.id=child.intent_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.prepay child join payment.intent parent on parent.id=child.intent_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.intenttender child join payment.intent parent on parent.id=child.intent_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.observation child join payment.attempt parent on parent.id=child.attempt_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.payment child join payment.intent parent on parent.id=child.intent_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.allocation child join payment.payment parent on parent.id=child.payment_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.refund child join payment.payment parent on parent.id=child.payment_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.refundtender child join payment.refund parent on parent.id=child.refund_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.refundcommand child join payment.refund parent on parent.id=child.refund_id
      join payment.payment captured on captured.id=parent.payment_id join payment.intent intent on intent.id=captured.intent_id
      where child.mall_id<>parent.mall_id or child.order_id<>intent.order_id
    union all select 1 from payment.providerattempt child join payment.refund parent on parent.id=child.refund_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.effect child join payment.payment parent on parent.id=child.payment_id
      join payment.intent intent on intent.id=parent.intent_id where child.mall_id<>parent.mall_id or child.order_id<>intent.order_id
    union all select 1 from payment.deadletterreview child join payment.payment parent on parent.id=child.payment_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.deadletterreview child join payment.refund parent on parent.id=child.refund_id where child.mall_id<>parent.mall_id
    union all select 1 from payment.recoverycase where mall_id<>scope_id
    union all select 1 from payment.recoveryrequest child left join payment.recoverycase parent on parent.id=child.case_id
      where child.mall_id<>child.scope_id or (parent.id is not null and child.mall_id<>parent.mall_id)
  ) conflicts;

  report:=jsonb_build_object(
    'intent',jsonb_build_object('total',(select count(*) from payment.intent),'null',(select count(*) from payment.intent where mall_id is null)),
    'attempt',jsonb_build_object('total',(select count(*) from payment.attempt),'null',(select count(*) from payment.attempt where mall_id is null)),
    'prepay',jsonb_build_object('total',(select count(*) from payment.prepay),'null',(select count(*) from payment.prepay where mall_id is null)),
    'intenttender',jsonb_build_object('total',(select count(*) from payment.intenttender),'null',(select count(*) from payment.intenttender where mall_id is null)),
    'observation',jsonb_build_object('total',(select count(*) from payment.observation),'null',(select count(*) from payment.observation where mall_id is null)),
    'payment',jsonb_build_object('total',(select count(*) from payment.payment),'null',(select count(*) from payment.payment where mall_id is null)),
    'allocation',jsonb_build_object('total',(select count(*) from payment.allocation),'null',(select count(*) from payment.allocation where mall_id is null)),
    'refund',jsonb_build_object('total',(select count(*) from payment.refund),'null',(select count(*) from payment.refund where mall_id is null)),
    'refundtender',jsonb_build_object('total',(select count(*) from payment.refundtender),'null',(select count(*) from payment.refundtender where mall_id is null)),
    'refundcommand',jsonb_build_object('total',(select count(*) from payment.refundcommand),'null',(select count(*) from payment.refundcommand where mall_id is null)),
    'providerattempt',jsonb_build_object('total',(select count(*) from payment.providerattempt),'null',(select count(*) from payment.providerattempt where mall_id is null)),
    'effect',jsonb_build_object('total',(select count(*) from payment.effect),'null',(select count(*) from payment.effect where mall_id is null)),
    'deadletterreview',jsonb_build_object('total',(select count(*) from payment.deadletterreview),'null',(select count(*) from payment.deadletterreview where mall_id is null)),
    'recoverycase',jsonb_build_object('total',(select count(*) from payment.recoverycase),'null',(select count(*) from payment.recoverycase where mall_id is null)),
    'recoveryrequest',jsonb_build_object('total',(select count(*) from payment.recoveryrequest),'null',(select count(*) from payment.recoveryrequest where mall_id is null)),
    'cross_mall_conflicts',conflict_count);
  raise notice 'PAYMENT_MALL_BACKFILL_REPORT %',report;

  if exists(
    select 1 from payment.intent where mall_id is null
    union all select 1 from payment.attempt where mall_id is null
    union all select 1 from payment.prepay where mall_id is null
    union all select 1 from payment.intenttender where mall_id is null
    union all select 1 from payment.observation where mall_id is null
    union all select 1 from payment.payment where mall_id is null
    union all select 1 from payment.allocation where mall_id is null
    union all select 1 from payment.refund where mall_id is null
    union all select 1 from payment.refundtender where mall_id is null
    union all select 1 from payment.refundcommand where mall_id is null
    union all select 1 from payment.providerattempt where mall_id is null
    union all select 1 from payment.effect where mall_id is null
    union all select 1 from payment.deadletterreview where mall_id is null
    union all select 1 from payment.recoverycase where mall_id is null
    union all select 1 from payment.recoveryrequest where mall_id is null
  ) then raise exception 'PAYMENT_MALL_BACKFILL_ORPHAN'; end if;

  if conflict_count<>0 then raise exception 'PAYMENT_MALL_BACKFILL_CONFLICT:%',conflict_count; end if;
end $backfill$;

alter table payment.intent alter column mall_id set not null;
alter table payment.attempt alter column mall_id set not null;
alter table payment.prepay alter column mall_id set not null;
alter table payment.observation alter column mall_id set not null;
alter table payment.providerattempt alter column mall_id set not null;
alter table payment.effect alter column mall_id set not null;
alter table payment.payment alter column mall_id set not null;
alter table payment.allocation alter column mall_id set not null;
alter table payment.refund alter column mall_id set not null;
alter table payment.refundcommand alter column mall_id set not null;
alter table payment.deadletterreview alter column mall_id set not null;
alter table payment.recoverycase alter column mall_id set not null;
alter table payment.recoveryrequest alter column mall_id set not null;
alter table payment.intenttender alter column mall_id set not null;
alter table payment.refundtender alter column mall_id set not null;

alter table payment.intent add constraint payment_intent_mall_id_key unique(mall_id,id);
alter table payment.attempt add constraint payment_attempt_mall_id_key unique(mall_id,id);
alter table payment.prepay add constraint payment_prepay_mall_id_key unique(mall_id,intent_id);
alter table payment.observation add constraint payment_observation_mall_id_key unique(mall_id,id);
alter table payment.providerattempt add constraint payment_providerattempt_mall_id_key unique(mall_id,id);
alter table payment.effect add constraint payment_effect_mall_id_key unique(mall_id,id);
alter table payment.payment add constraint payment_payment_mall_id_key unique(mall_id,id);
alter table payment.allocation add constraint payment_allocation_mall_key unique(mall_id,payment_id,target_type,target_id);
alter table payment.refund add constraint payment_refund_mall_id_key unique(mall_id,id);
alter table payment.refundcommand add constraint payment_refundcommand_mall_id_key unique(mall_id,id);
alter table payment.deadletterreview add constraint payment_deadletterreview_mall_id_key unique(mall_id,id);
alter table payment.capture add constraint payment_capture_mall_id_key unique(mall_id,id);
alter table payment.recoverycase add constraint payment_recoverycase_mall_id_key unique(mall_id,id);
alter table payment.recoveryrequest add constraint payment_recoveryrequest_mall_id_key unique(mall_id,id);
alter table payment.intenttender add constraint payment_intenttender_mall_key unique(mall_id,intent_id,sequence);
alter table payment.refundtender add constraint payment_refundtender_mall_key unique(mall_id,refund_id,sequence);

alter table payment.attempt add constraint payment_attempt_mall_intent_fkey foreign key(mall_id,intent_id) references payment.intent(mall_id,id);
alter table payment.prepay add constraint payment_prepay_mall_intent_fkey foreign key(mall_id,intent_id) references payment.intent(mall_id,id);
alter table payment.intenttender add constraint payment_intenttender_mall_intent_fkey foreign key(mall_id,intent_id) references payment.intent(mall_id,id) on delete cascade;
alter table payment.observation add constraint payment_observation_mall_attempt_fkey foreign key(mall_id,attempt_id) references payment.attempt(mall_id,id);
alter table payment.payment add constraint payment_payment_mall_intent_fkey foreign key(mall_id,intent_id) references payment.intent(mall_id,id);
alter table payment.allocation add constraint payment_allocation_mall_payment_fkey foreign key(mall_id,payment_id) references payment.payment(mall_id,id);
alter table payment.refund add constraint payment_refund_mall_payment_fkey foreign key(mall_id,payment_id) references payment.payment(mall_id,id);
alter table payment.refundtender add constraint payment_refundtender_mall_refund_fkey foreign key(mall_id,refund_id) references payment.refund(mall_id,id) on delete cascade;
alter table payment.refundcommand add constraint payment_refundcommand_mall_refund_fkey foreign key(mall_id,refund_id) references payment.refund(mall_id,id);
alter table payment.providerattempt add constraint payment_providerattempt_mall_refund_fkey foreign key(mall_id,refund_id) references payment.refund(mall_id,id);
alter table payment.effect add constraint payment_effect_mall_payment_fkey foreign key(mall_id,payment_id) references payment.payment(mall_id,id);
alter table payment.deadletterreview add constraint payment_deadletterreview_mall_payment_fkey foreign key(mall_id,payment_id) references payment.payment(mall_id,id);
alter table payment.deadletterreview add constraint payment_deadletterreview_mall_refund_fkey foreign key(mall_id,refund_id) references payment.refund(mall_id,id);
alter table payment.recoveryrequest add constraint payment_recoveryrequest_mall_case_fkey foreign key(mall_id,case_id) references payment.recoverycase(mall_id,id);

alter table payment.intent drop constraint intent_provider_reference_key;
alter table payment.intent add constraint payment_intent_mall_provider_reference_key unique(mall_id,provider_reference);
alter table payment.observation drop constraint observation_provider_event_id_key;
alter table payment.observation add constraint payment_observation_mall_provider_event_key unique(mall_id,provider_event_id);
alter table payment.recoverycase drop constraint recoverycase_resource_type_resource_id_key;
alter table payment.recoverycase add constraint payment_recoverycase_mall_resource_key unique(mall_id,resource_type,resource_id);

create index payment_intent_mall_state on payment.intent(mall_id,state,expires_at,id);
create index payment_intent_provider_reference_mall on payment.intent(provider_reference,mall_id);
create index payment_attempt_mall_intent on payment.attempt(mall_id,intent_id,requested_at desc,id desc);
create index payment_refund_mall_state on payment.refund(mall_id,state,id);
create index payment_providerattempt_mall_refund on payment.providerattempt(mall_id,refund_id,sequence);
create index payment_recoverycase_mall_state on payment.recoverycase(mall_id,state,opened_at desc,id desc);

drop function payment.webhook_scope(text,text);
create function payment.webhook_scope(p_kind text,p_reference text,p_application_hash text)
returns text language plpgsql stable security definer set search_path=payment,pg_temp as $function$
declare resolved text;
begin
  if p_kind='payment' then
    select min(intent.mall_id) into resolved from payment.intent intent
      join payment.attempt attempt on attempt.intent_id=intent.id and attempt.mall_id=intent.mall_id
      where intent.provider_reference=p_reference and attempt.application_hash=p_application_hash
      having count(distinct intent.mall_id)=1;
  elsif p_kind='refund' then
    select refund.mall_id into resolved from payment.refund refund where refund.provider_reference=p_reference;
  else
    raise exception 'PAYMENT_WEBHOOK_KIND_INVALID';
  end if;
  return resolved;
end $function$;

revoke all on function payment.webhook_scope(text,text,text) from public,anon,authenticated,service_role;
grant execute on function payment.webhook_scope(text,text,text) to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260901190000',encode(public.digest('payment-mall-identity:v1','sha256'),'hex'));

do $assert$
begin
  if to_regprocedure('payment.webhook_scope(text,text,text)') is null then raise exception 'PAYMENT_MALL_WEBHOOK_SCOPE_MISSING'; end if;
  if (select count(*) from information_schema.columns where table_schema='payment' and table_name in(
      'intent','attempt','prepay','observation','providerattempt','effect','payment','allocation','refund','refundcommand',
      'deadletterreview','recoverycase','recoveryrequest','intenttender','refundtender') and column_name='mall_id' and is_nullable='NO')<>15
  then raise exception 'PAYMENT_MALL_COLUMN_INCOMPLETE'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260901190000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
