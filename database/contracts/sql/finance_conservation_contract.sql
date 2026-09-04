begin;

do $contract$
declare violation text;
begin
  select journal.id into violation
  from finance.journal journal
  left join finance.entry entry on entry.journal_id=journal.id
  where journal.state in('posted','reversed')
  group by journal.id
  having coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)<>0
  order by journal.id limit 1;
  if violation is not null then raise exception 'IDEAL_FINANCE_JOURNAL_UNBALANCED:%',violation; end if;

  select reference.journal_id into violation
  from finance.postingreference reference
  left join finance.journal journal on journal.id=reference.journal_id
  where journal.id is null or journal.state not in('posted','reversed')
    or journal.currency<>reference.currency
  order by reference.journal_id limit 1;
  if violation is not null then raise exception 'IDEAL_FINANCE_POSTING_INVALID:%',violation; end if;

  select payment.id into violation
  from payment.payment payment
  left join payment.refund refund on refund.payment_id=payment.id and refund.state='succeeded'
  group by payment.id,payment.refunded_minor,payment.captured_minor
  having coalesce(sum(refund.amount_minor),0)<>payment.refunded_minor
    or payment.refunded_minor>payment.captured_minor
  order by payment.id limit 1;
  if violation is not null then raise exception 'IDEAL_PAYMENT_REFUND_CONSERVATION_INVALID:%',violation; end if;
end
$contract$;

rollback;
