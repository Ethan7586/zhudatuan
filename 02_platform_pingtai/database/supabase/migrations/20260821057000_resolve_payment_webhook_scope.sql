begin;

create or replace function payment.webhook_scope(p_kind text,p_reference text)
returns text language plpgsql stable security definer set search_path=payment,ordering,pg_temp as $function$
declare resolved text;
begin
  if p_kind='payment' then
    select orders.scope_id into resolved from payment.intent intent
      join ordering.orderrecord orders on orders.id=intent.order_id where intent.provider_reference=p_reference;
  elsif p_kind='refund' then
    select orders.scope_id into resolved from payment.refund refund
      join payment.payment captured on captured.id=refund.payment_id
      join payment.intent intent on intent.id=captured.intent_id
      join ordering.orderrecord orders on orders.id=intent.order_id where refund.provider_reference=p_reference;
  else
    raise exception 'PAYMENT_WEBHOOK_KIND_INVALID';
  end if;
  return resolved;
end
$function$;

revoke all on function payment.webhook_scope(text,text) from public,anon,authenticated,service_role;
grant execute on function payment.webhook_scope(text,text) to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260821057000','f64aa0c88fbab0a9153c247c3e88cf6b6f0232bf9c8b95ded6003ba4bd31862d');

do $assert$ begin
  if to_regprocedure('payment.webhook_scope(text,text)') is null then raise exception 'PAYMENT_WEBHOOK_SCOPE_RESOLVER_MISSING'; end if;
  if has_function_privilege('anon','payment.webhook_scope(text,text)','EXECUTE') then raise exception 'PAYMENT_WEBHOOK_SCOPE_PUBLIC_EXECUTE'; end if;
  if not has_function_privilege('shopapp','payment.webhook_scope(text,text)','EXECUTE') then raise exception 'PAYMENT_WEBHOOK_SCOPE_APP_EXECUTE_MISSING'; end if;
end $assert$;

commit;
