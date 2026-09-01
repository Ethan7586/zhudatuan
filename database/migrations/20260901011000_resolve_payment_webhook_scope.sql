begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260901010000') then
    raise exception 'ORDER_PAYMENT_WEBHOOK_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901011000') then
    raise exception 'ORDER_PAYMENT_WEBHOOK_SCOPE_ALREADY_APPLIED';
  end if;
end $precondition$;

create or replace function ordering.payment_webhook_scope(p_order text)
returns text language sql stable security definer
set search_path=ordering,pg_temp
set row_security=off
as $function$
  select orders.scope_id from ordering.orderrecord orders where orders.id=p_order
$function$;

revoke all on function ordering.payment_webhook_scope(text) from public,anon,authenticated,service_role;
grant execute on function ordering.payment_webhook_scope(text) to shopapp;

select runtime.record_migration_evidence('20260901011000',1,1,0,0,
  'select to_regprocedure(''ordering.payment_webhook_scope(text)'');',
  'select has_function_privilege(''shopapp'',''ordering.payment_webhook_scope(text)'',''EXECUTE'');');

insert into runtime.schemaversion(version,checksum)
values('20260901011000',encode(public.digest('20260901011000_resolve_payment_webhook_scope','sha256'),'hex'));

do $assert$ begin
  if to_regprocedure('ordering.payment_webhook_scope(text)') is null then raise exception 'ORDER_PAYMENT_WEBHOOK_SCOPE_RESOLVER_MISSING'; end if;
  if has_function_privilege('anon','ordering.payment_webhook_scope(text)','EXECUTE') then raise exception 'ORDER_PAYMENT_WEBHOOK_SCOPE_PUBLIC_EXECUTE'; end if;
  if not has_function_privilege('shopapp','ordering.payment_webhook_scope(text)','EXECUTE') then raise exception 'ORDER_PAYMENT_WEBHOOK_SCOPE_APP_EXECUTE_MISSING'; end if;
end $assert$;

commit;
