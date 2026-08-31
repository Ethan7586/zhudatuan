begin;
insert into finance.account(id,scope_id,code,currency,kind,status) values
  ('contract:debit','contract:finance','contract.debit','CNY','asset','active'),
  ('contract:credit','contract:finance','contract.credit','CNY','income','active');
insert into finance.journal(id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version)
values('contract:journal','contract:finance','contract.event','contract:event','CNY','2026-08','posted','contract',clock_timestamp(),0);
insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at) values
  ('contract:entry:debit','contract:journal','contract:debit','debit',100,clock_timestamp()),
  ('contract:entry:credit','contract:journal','contract:credit','credit',100,clock_timestamp());
insert into finance.economicleg(owner_event_id,economic_leg_id,journal_id,scope_id,currency,amount_minor,posted_at)
values('contract:event','contract.leg','contract:journal','contract:finance','CNY',100,clock_timestamp());
set constraints all immediate;
do $contract$ begin
  if (select count(*) from pg_trigger where not tgisinternal and tgname in('payment_observation_immutable','payment_capture_immutable',
    'payment_refundreceipt_immutable','voucher_redemption_immutable','voucher_reversal_immutable'))<>5 then
    raise exception 'IMMUTABLE_RECEIPT_TRIGGER_MISSING';
  end if;
  begin
    insert into finance.economicleg(owner_event_id,economic_leg_id,journal_id,scope_id,currency,amount_minor,posted_at)
    values('contract:event','contract.leg','contract:other','contract:finance','CNY',100,clock_timestamp());
    raise exception 'FINANCE_DUPLICATE_ECONOMIC_LEG_ACCEPTED';
  exception when unique_violation or foreign_key_violation then null; end;
end $contract$;
rollback;
