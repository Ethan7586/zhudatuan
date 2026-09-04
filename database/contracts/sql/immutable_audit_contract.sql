begin;

do $contract$
declare violation text;
begin
  select required.name into violation
  from (values
    ('audit.record','immutable'),
    ('audit.accessrecord','immutable'),
    ('finance.entry','finance_entry_immutable'),
    ('inventory.movement','inventorymovementimmutable'),
    ('payment.observation','payment_observation_immutable'),
    ('payment.capture','payment_capture_immutable'),
    ('payment.refundreceipt','payment_refundreceipt_immutable'),
    ('voucher.refund','voucher_refund_immutable')
  ) required(relation_name,name)
  where not exists(
    select 1 from pg_trigger trigger
    where trigger.tgrelid=required.relation_name::regclass and trigger.tgname=required.name and not trigger.tgisinternal
  ) order by required.name limit 1;
  if violation is not null then raise exception 'IDEAL_IMMUTABLE_TRIGGER_MISSING:%',violation; end if;

  if exists(
    select 1 from audit.record
    group by scope_id
    having count(*)<>count(distinct id) or min(record_hash) is null
  ) then raise exception 'IDEAL_AUDIT_CHAIN_INVALID'; end if;

  if exists(select 1 from audit.sensitiveaccess where length(purpose)<2 or length(trace_id)<1)
    then raise exception 'IDEAL_SENSITIVE_ACCESS_EVIDENCE_INVALID'; end if;
end
$contract$;

rollback;
