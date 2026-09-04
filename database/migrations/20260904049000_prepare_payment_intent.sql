begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904048000') then raise exception 'IDEAL_PAYMENT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904049000') then raise exception 'IDEAL_PAYMENT_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema='payment' and table_name in(
    'intent','attempt','allocation','refund','providerattempt'))<>5 then raise exception 'IDEAL_PAYMENT_TABLES_MISSING'; end if;
end
$precondition$;

create unique index if not exists payment_provider_receipt_unique on payment.providerattempt(provider_reference)
  include(refund_id,sequence,outcome,completed_at) where provider_reference is not null;

select runtime.record_migration_evidence('20260904049000',
  (select count(*) from payment.intent),(select count(*) from payment.intent),
  (select coalesce(sum(amount_minor),0) from payment.refund),(select coalesce(sum(amount_minor),0) from payment.refund),
  'select purpose,state,count(*) from payment.intent group by purpose,state;',
  'select payment_id,sum(amount_minor) refund_minor from payment.refund where state=''succeeded'' group by payment_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904049000',encode(public.digest('20260904049000_prepare_payment_intent','sha256'),'hex'));

do $assert$
begin
  if exists(select order_id,purpose from payment.intent where state in('created','preparing','pending')
    group by order_id,purpose having count(*)>1) then raise exception 'IDEAL_PAYMENT_INTENT_DUPLICATE'; end if;
  if exists(select refund.payment_id from payment.refund refund where refund.state='succeeded' group by refund.payment_id
    having sum(refund.amount_minor)>(select captured.captured_minor from payment.payment captured where captured.id=refund.payment_id))
  then raise exception 'IDEAL_PAYMENT_REFUND_EXCEEDS_PAYMENT'; end if;
  if exists(select provider_reference from payment.providerattempt where provider_reference is not null
    group by provider_reference having count(*)>1) then raise exception 'IDEAL_PROVIDER_EVENT_DUPLICATE'; end if;
end
$assert$;

commit;
