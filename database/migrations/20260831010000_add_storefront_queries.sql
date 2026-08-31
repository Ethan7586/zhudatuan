begin;

-- The webhook now resolves its Payment-owned reference and obtains the Order
-- scope through OrderPaymentPort; the former cross-schema resolver is retired.
drop function payment.webhook_scope(text,text);

do $$
begin
  if to_regprocedure('payment.webhook_scope(text,text)') is not null then
    raise exception 'PAYMENT_WEBHOOK_SCOPE_HARDCUT_FAILED';
  end if;
end
$$;

commit;
