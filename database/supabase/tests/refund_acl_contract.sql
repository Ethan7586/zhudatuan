begin;

do $$
begin
  if has_table_privilege('service_role','public.wechat_refund_commands','select')
     or has_function_privilege('service_role',
       'public.alert_wechat_refund_event_deadletter(uuid)','execute')
     or has_function_privilege('service_role',
       'public.process_wechat_refund_event(uuid,text,uuid)','execute')
     or has_function_privilege('authenticated',
       'public.api_replay_wechat_refund_event_authorized(uuid,text,text,jsonb,text,text,text,text)','execute')
     or not has_function_privilege('service_role',
       'public.api_request_refund_authorized(text,text,bigint,text,text,text,text,text,jsonb)','execute')
     or not has_function_privilege('service_role',
       'public.api_replay_wechat_refund_event_authorized(uuid,text,text,jsonb,text,text,text,text)','execute')
     or not has_function_privilege('service_role',
       'public.api_finance_reconciliation_authorized(text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('authenticated',
       'public.api_finance_reconciliation_authorized(text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('service_role',
       'public.execute_internal_refund_primitive(text,bigint,text,text)','execute')
     or to_regprocedure('public.api_finance_reconciliation(text,text,text)') is not null
     or to_regprocedure(
       'public.api_execute_internal_refund_authorized(text,text,bigint,text,text,text,text,text,jsonb)'
       ) is not null
     or to_regprocedure(
       'public.api_execute_internal_refund(text,text,text,text,text,bigint,text,text,text,text)'
       ) is not null
     or to_regprocedure(
       'public.api_execute_internal_refund_unchecked(text,text,text,text,text,bigint,text,text,text,text)'
       ) is not null
     or to_regprocedure(
       'public.api_ignore_wechat_refund_event_authorized(uuid,text,text,jsonb,text,text)'
       ) is not null
     or (select risk_level from public.permissions where code='payment.outbox.manage')<>'critical'
  then raise exception 'CONTRACT_REFUND_ACL_INVALID'; end if;
end;
$$;

rollback;
