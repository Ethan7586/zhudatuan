begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:public-mall-external-payment:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902010000'
      and checksum='59b76d9a5e3b0e9ff8f6837bdfab4e93936a80645cab2e88cf9342f530bafbd3')
    or exists(select 1 from runtime.schemaversion where version>'20260902010000') then
    raise exception 'PUBLIC_MALL_EXTERNAL_PAYMENT_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

-- Return only the fields needed to initiate one WeChat payment. Identity and
-- membership authority rows remain inaccessible to the Purchase runtime.
create or replace function access.purchase_payment_intent_context(
  p_membership text,p_session text,p_order text,p_application_hash text,p_mall text
) returns table(
  intent text,attempt text,order_id text,order_number text,scope_id text,mall_id text,member_id text,
  total_minor double precision,amount_minor double precision,payer_identity text,payer_ciphertext text,
  state text,parameters jsonb,scene text,application_hash text,expires_at text
)
language plpgsql volatile security definer
set search_path=access,identity,member,ordering,payment,pg_temp
set row_security=off as $function$
begin
  if session_user<>'zhudatuanpurchaseapi' then
    raise exception 'PURCHASE_PAYMENT_CONTEXT_INVALID';
  end if;
  return query
  select selected.id,attempted.id,selected.order_id,orders.order_number,selected.mall_id,selected.mall_id,selected.member_id,
    selected.amount_minor::float8,coalesce(wechat.amount_minor,0)::float8,
    payer.id,payer.subject_ciphertext,attempted.state,prepared.parameters,attempted.scene,
    attempted.application_hash::text,selected.expires_at::text
  from access.purchase_session_context(p_membership,p_session,true) context
  join ordering.orderrecord orders
    on orders.id=p_order and orders.mall_id=context.mall_id and orders.member_id=context.member_id
      and orders.payment_state in('unpaid','authorizing')
  join payment.intent selected
    on selected.order_id=orders.id and selected.mall_id=orders.mall_id and selected.member_id=orders.member_id
      and selected.state in('created','authorizing','authorized')
  left join payment.intenttender wechat
    on wechat.mall_id=selected.mall_id and wechat.intent_id=selected.id and wechat.kind='wechat'
  left join lateral(
    select candidate.id,candidate.state,candidate.scene,candidate.application_hash
    from payment.attempt candidate
    where candidate.mall_id=selected.mall_id and candidate.intent_id=selected.id and candidate.provider='wechat'
    order by candidate.requested_at desc,candidate.id desc limit 1
  ) attempted on true
  left join payment.prepay prepared
    on prepared.mall_id=selected.mall_id and prepared.intent_id=selected.id
  left join lateral(
    select candidate.id,candidate.subject_ciphertext
    from identity.federatedidentity candidate
    where candidate.principal_id=context.principal_id and candidate.provider='wechat' and candidate.status='active'
      and candidate.subject_ciphertext is not null and candidate.application_hash=p_application_hash
    order by candidate.updated_at desc,candidate.id desc limit 1
  ) payer on true
  where context.mall_id=p_mall
  for update of selected,orders;
end
$function$;

-- Purchase cannot update the shared job table directly. This command validates
-- the active mall session and owns the only payment-query upsert for the role.
create or replace function access.purchase_enqueue_payment_query(
  p_membership text,p_session text,p_mall text,p_intent text,p_priority integer,p_delay_seconds integer
) returns void
language plpgsql volatile security definer
set search_path=access,payment,runtime,pg_temp
set row_security=off as $function$
declare
  v_job text;
begin
  if session_user<>'zhudatuanpurchaseapi'
    or not ((p_priority=10 and p_delay_seconds=5) or (p_priority=1 and p_delay_seconds=0)) then
    raise exception 'PURCHASE_PAYMENT_RECOVERY_INVALID';
  end if;
  if not exists(
    select 1 from access.purchase_session_context(p_membership,p_session,true) context
    join payment.intent intent on intent.id=p_intent and intent.mall_id=context.mall_id and intent.member_id=context.member_id
    where context.mall_id=p_mall and intent.state in('authorizing','authorized')
  ) then
    raise exception 'PURCHASE_PAYMENT_RECOVERY_CONTEXT_INVALID';
  end if;
  insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
  values('job:query:'||p_intent,'paymentquery','payment',p_mall,jsonb_build_object('intent',p_intent),'queued',p_priority,
    clock_timestamp()+make_interval(secs=>p_delay_seconds),clock_timestamp(),clock_timestamp())
  on conflict(id) do update set state='queued',priority=excluded.priority,available_at=excluded.available_at,
    updated_at=clock_timestamp(),attempts=0
  where job.kind='paymentquery' and job.owner='payment' and job.scope_id=p_mall and job.payload->>'intent'=p_intent
  returning id into v_job;
  if v_job is null then raise exception 'PURCHASE_PAYMENT_RECOVERY_JOB_CONFLICT'; end if;
end
$function$;

revoke all on function access.purchase_payment_intent_context(text,text,text,text,text),
  access.purchase_enqueue_payment_query(text,text,text,text,integer,integer) from public,
  anon,authenticated,service_role,shopapp,shopjob,shopread,zhudatuanidentityapi,
  zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
grant execute on function access.purchase_payment_intent_context(text,text,text,text,text),
  access.purchase_enqueue_payment_query(text,text,text,text,integer,integer) to zhudatuanpurchaseapi;

grant select,insert on payment.attempt,payment.prepay to zhudatuanpurchaseapi;
revoke update on payment.attempt,payment.prepay,runtime.job from zhudatuanpurchaseapi;
grant update(state,requested_at,completed_at,payer_hash) on payment.attempt to zhudatuanpurchaseapi;
grant update(parameters,provider_request_id) on payment.prepay to zhudatuanpurchaseapi;

drop policy if exists zhudatuanpurchaseapiselect on payment.attempt;
create policy zhudatuanpurchaseapiselect on payment.attempt for select to zhudatuanpurchaseapi
  using(provider='wechat' and access.purchase_intent_allowed(intent_id));
drop policy if exists zhudatuanpurchaseapiinsert on payment.attempt;
create policy zhudatuanpurchaseapiinsert on payment.attempt for insert to zhudatuanpurchaseapi
  with check(provider='wechat' and tender_id='tender:wechat' and state='started'
    and application_hash~'^[0-9a-f]{64}$' and access.purchase_intent_allowed(intent_id));
drop policy if exists zhudatuanpurchaseapiupdate on payment.attempt;
create policy zhudatuanpurchaseapiupdate on payment.attempt for update to zhudatuanpurchaseapi
  using(provider='wechat' and access.purchase_intent_allowed(intent_id))
  with check(provider='wechat' and state in('started','pending','failed','unknown')
    and access.purchase_intent_allowed(intent_id));

drop policy if exists zhudatuanpurchaseapiselect on payment.prepay;
create policy zhudatuanpurchaseapiselect on payment.prepay for select to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(intent_id));
drop policy if exists zhudatuanpurchaseapiinsert on payment.prepay;
create policy zhudatuanpurchaseapiinsert on payment.prepay for insert to zhudatuanpurchaseapi
  with check(jsonb_typeof(parameters)='object' and access.purchase_intent_allowed(intent_id));
drop policy if exists zhudatuanpurchaseapiupdate on payment.prepay;
create policy zhudatuanpurchaseapiupdate on payment.prepay for update to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(intent_id))
  with check(jsonb_typeof(parameters)='object' and access.purchase_intent_allowed(intent_id));

drop policy if exists zhudatuanpurchaseapiupdate on payment.intent;
create policy zhudatuanpurchaseapiupdate on payment.intent for update to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(id) and state in('created','authorizing','authorized'))
  with check(access.purchase_intent_allowed(id) and state in('authorizing','captured'));

drop policy if exists zhudatuanpurchaseapiupdate on ordering.orderrecord;
create policy zhudatuanpurchaseapiupdate on ordering.orderrecord for update to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id) and payment_state in('unpaid','authorizing'))
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and (
    (payment_state='authorizing' and lifecycle_state='created' and fulfillment_state='unallocated' and aftersale_state='none')
    or (payment_state='paid' and lifecycle_state='active' and fulfillment_state='allocated' and aftersale_state='none')
  ));

drop policy if exists zhudatuanpurchaseapi on runtime.job;
create policy zhudatuanpurchaseapi on runtime.job for insert to zhudatuanpurchaseapi
  with check(state='queued' and scope_id is not null and access.purchase_mall_allowed(scope_id) and (
    (kind='orderexpiry' and owner='order' and access.purchase_order_allowed(payload->>'order'))
    or (kind='fulfillment' and owner='fulfillment' and access.purchase_fulfillment_allowed(payload->>'fulfillment'))
  ));
drop policy if exists zhudatuanpurchaseapiupdate on runtime.job;

alter policy zhudatuanpurchaseapi on runtime.schemaversion
  using(version in('20260821032000','20260821054000','20260828170000','20260828173000','20260828180000',
    '20260902010000','20260902011000'));

insert into runtime.schemaversion(version,checksum)
values('20260902011000','d53ccec069c3a040fb31977482ae3ebbb256a0d6285cf2e25f6a1497b8784549');

do $assert$
begin
  if has_table_privilege('zhudatuanpurchaseapi','access.membership','SELECT')
    or not has_function_privilege('zhudatuanpurchaseapi',
      'access.purchase_payment_intent_context(text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi',
      'access.purchase_enqueue_payment_query(text,text,text,text,integer,integer)','EXECUTE')
    or has_function_privilege('public','access.purchase_payment_intent_context(text,text,text,text,text)','EXECUTE') then
    raise exception 'PUBLIC_MALL_EXTERNAL_PAYMENT_CONTEXT_BOUNDARY_INVALID';
  end if;
  if not has_table_privilege('zhudatuanpurchaseapi','payment.attempt','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.attempt','INSERT')
    or has_table_privilege('zhudatuanpurchaseapi','payment.attempt','UPDATE')
    or not has_column_privilege('zhudatuanpurchaseapi','payment.attempt','state','UPDATE')
    or not has_column_privilege('zhudatuanpurchaseapi','payment.attempt','payer_hash','UPDATE')
    or has_table_privilege('zhudatuanpurchaseapi','payment.attempt','DELETE')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.prepay','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.prepay','INSERT')
    or has_table_privilege('zhudatuanpurchaseapi','payment.prepay','UPDATE')
    or not has_column_privilege('zhudatuanpurchaseapi','payment.prepay','parameters','UPDATE')
    or has_table_privilege('zhudatuanpurchaseapi','payment.prepay','DELETE')
    or has_table_privilege('zhudatuanpurchaseapi','runtime.job','UPDATE')
    or has_column_privilege('zhudatuanpurchaseapi','runtime.job','state','UPDATE') then
    raise exception 'PUBLIC_MALL_EXTERNAL_PAYMENT_WRITE_BOUNDARY_INVALID';
  end if;
  if (select count(*) from pg_policy policy
      join pg_class relation on relation.oid=policy.polrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where policy.polname in('zhudatuanpurchaseapiselect','zhudatuanpurchaseapiinsert','zhudatuanpurchaseapiupdate')
        and (namespace.nspname,relation.relname) in(('payment','attempt'),('payment','prepay')))<>6 then
    raise exception 'PUBLIC_MALL_EXTERNAL_PAYMENT_POLICY_INCOMPLETE';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902011000'
      and checksum='d53ccec069c3a040fb31977482ae3ebbb256a0d6285cf2e25f6a1497b8784549') then
    raise exception 'PUBLIC_MALL_EXTERNAL_PAYMENT_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
