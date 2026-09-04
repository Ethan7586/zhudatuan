-- Durable WeChat refund closure. Provider acceptance is never treated as
-- success; only a verified SUCCESS observation can release local effects.

alter table public.finance_journals
  alter column source_effect_id drop not null,
  add column refund_id text references public.refunds(id) on delete restrict,
  drop constraint finance_journals_journal_type_check,
  add constraint finance_journals_journal_type_check
    check (journal_type in ('payment_capture','payment_refund')),
  add constraint finance_journals_source_check check (
    (source_effect_id is not null)::integer + (refund_id is not null)::integer = 1
  );
create unique index finance_journals_refund_source
on public.finance_journals(refund_id) where refund_id is not null;

alter table public.notification_dispatches
  alter column source_effect_id drop not null,
  add column refund_id text references public.refunds(id) on delete restrict,
  add constraint notification_dispatches_source_check check (
    (source_effect_id is not null)::integer + (refund_id is not null)::integer = 1
  );
create unique index notification_dispatches_refund_recipient
on public.notification_dispatches(refund_id,recipient_kind,channel,template_key)
where refund_id is not null;

create function public.enforce_notification_identity()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if row(new.tenant_id,new.mall_id,new.order_id,new.payment_id,new.payment_intent_id,
      new.source_effect_id,new.refund_id,new.recipient_kind,new.recipient_id,
      new.channel,new.template_key,new.payload_json,new.created_at)
     is distinct from row(old.tenant_id,old.mall_id,old.order_id,old.payment_id,
      old.payment_intent_id,old.source_effect_id,old.refund_id,old.recipient_kind,
      old.recipient_id,old.channel,old.template_key,old.payload_json,old.created_at)
  then raise exception 'NOTIFICATION_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;
create trigger notification_identity before update on public.notification_dispatches
for each row execute function public.enforce_notification_identity();

create function public.ensure_refund_finance_journal(p_refund_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare refund public.refunds%rowtype; payment public.payments%rowtype;
  orders public.orders%rowtype;
  created_journal_id uuid; credit_account text;
begin
  select * into strict refund from public.refunds
  where id=p_refund_id and status='succeeded';
  select * into strict payment from public.payments where id=refund.payment_id;
  select * into strict orders from public.orders where id=refund.order_id;
  if refund.tenant_id<>orders.tenant_id or refund.mall_id<>orders.mall_id
     or payment.order_id<>orders.id or payment.tenant_id<>orders.tenant_id
     or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id
     or refund.amount_cents>payment.amount_cents
  then raise exception 'REFUND_FINANCE_EVIDENCE_MISMATCH'; end if;
  credit_account:=case payment.channel
    when 'wechat' then 'asset:wechat_receivable'
    when 'welfare' then 'liability:welfare_balance'
    when 'meal' then 'liability:meal_balance'
    else null end;
  if credit_account is null then raise exception 'REFUND_FINANCE_CHANNEL_UNSUPPORTED'; end if;
  insert into public.finance_journals(
    tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
    refund_id,journal_type,business_reference,currency,amount_cents,status,occurred_at
  ) values(
    refund.tenant_id,refund.mall_id,refund.order_id,payment.id,null,null,refund.id,
    'payment_refund','refund:'||refund.id,'CNY',refund.amount_cents,'posted',
    coalesce(refund.completed_at,now())
  ) on conflict(tenant_id,journal_type,business_reference) do nothing
  returning id into created_journal_id;
  if created_journal_id is null then
    select journal.id into strict created_journal_id
    from public.finance_journals journal
    where journal.refund_id=refund.id and journal.journal_type='payment_refund';
  end if;
  insert into public.finance_journal_entries(
    journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
    account_code,side,amount_cents,subject_type,subject_id
  ) values
    (created_journal_id,refund.tenant_id,refund.mall_id,refund.order_id,payment.id,null,
      'liability:customer_payment_clearing','debit',refund.amount_cents,'order',refund.order_id),
    (created_journal_id,refund.tenant_id,refund.mall_id,refund.order_id,payment.id,null,
      credit_account,'credit',refund.amount_cents,'order',refund.order_id)
  on conflict(journal_id,account_code,side) do nothing;
end $$;
create function public.post_refund_finance_journal()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.ensure_refund_finance_journal(new.id);
  return new;
end $$;
create trigger refund_finance_journal_insert
after insert on public.refunds
for each row when(new.status='succeeded')
execute function public.post_refund_finance_journal();
do $$ declare historical record; begin
  for historical in select id from public.refunds where status='succeeded'
  loop perform public.ensure_refund_finance_journal(historical.id); end loop;
end $$;
create trigger refund_finance_journal_update
after update of status on public.refunds
for each row when(new.status='succeeded' and old.status<>'succeeded')
execute function public.post_refund_finance_journal();

create table public.wechat_refund_commands(
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  after_sale_id text not null unique references public.after_sales(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  payment_id text not null references public.payments(id) on delete restrict,
  refund_id text not null unique references public.refunds(id) on delete restrict,
  payment_attempt_id uuid not null references public.wechat_payment_attempts(id) on delete restrict,
  out_refund_no text not null unique check(out_refund_no~'^[A-Za-z0-9_\-|*@]{6,64}$'),
  out_trade_no text not null check(out_trade_no~'^[A-Za-z0-9_|*-]{6,32}$'),
  transaction_id text not null check(char_length(transaction_id) between 6 and 64),
  amount_cents bigint not null check(amount_cents>0),
  payment_total_cents bigint not null check(payment_total_cents>0 and amount_cents<=payment_total_cents),
  currency text not null default 'CNY' check(currency='CNY'),
  reason text not null check(char_length(reason) between 2 and 500),
  next_operation text not null default 'apply' check(next_operation in ('apply','query')),
  status text not null default 'requested'
    check(status in ('requested','processing','provider_succeeded','provider_closed','succeeded','closed','dead_letter')),
  provider_status text check(provider_status in ('PROCESSING','ABNORMAL','SUCCESS','CLOSED')),
  provider_refund_id text,
  provider_request_id text,
  attempts integer not null default 0 check(attempts>=0),
  available_at timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  completed_at timestamptz,
  dead_lettered_at timestamptz,
  idempotency_key text not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mall_id,idempotency_key),
  constraint wechat_refund_command_lease_check check(
    (status='processing' and locked_by is not null and locked_at is not null
      and lease_token is not null and lease_expires_at is not null)
    or (status<>'processing' and locked_by is null and locked_at is null
      and lease_token is null and lease_expires_at is null)
  )
);
create unique index wechat_refund_provider_id
on public.wechat_refund_commands(provider_refund_id) where provider_refund_id is not null;
create index wechat_refund_command_ready
on public.wechat_refund_commands(status,available_at,created_at);

create table public.wechat_refund_provider_attempts(
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.wechat_refund_commands(id) on delete restrict,
  attempt_no integer not null check(attempt_no>0),
  operation text not null check(operation in ('apply','query')),
  worker_id text not null check(char_length(worker_id) between 1 and 120),
  outcome text not null default 'started'
    check(outcome in ('started','accepted','processing','abnormal','succeeded','closed','retry','dead_letter','superseded')),
  provider_status text check(provider_status in ('PROCESSING','ABNORMAL','SUCCESS','CLOSED')),
  provider_refund_id text,
  provider_request_id text,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(command_id,attempt_no)
);

create table public.wechat_refund_notification_inbox(
  id uuid primary key default gen_random_uuid(),
  notification_id text not null unique check(char_length(notification_id) between 1 and 128),
  command_id uuid not null references public.wechat_refund_commands(id) on delete restrict,
  event_type text not null check(event_type in ('REFUND.SUCCESS','REFUND.ABNORMAL','REFUND.CLOSED')),
  evidence_digest text not null check(evidence_digest~'^[0-9a-f]{64}$'),
  received_at timestamptz not null default now()
);

create table public.wechat_refund_event_outbox(
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  command_id uuid not null references public.wechat_refund_commands(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  aggregate_type text not null default 'refund' check(aggregate_type='refund'),
  aggregate_id text not null,
  aggregate_version bigint not null default 1 check(aggregate_version>0),
  event_type text not null check(event_type in ('RefundSucceeded','RefundClosed')),
  event_version integer not null default 1 check(event_version=1),
  payload_json jsonb not null check(jsonb_typeof(payload_json)='object' and octet_length(payload_json::text)<=8192),
  status text not null default 'pending' check(status in ('pending','processing','delivered','dead_letter')),
  attempts integer not null default 0 check(attempts>=0),
  available_at timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  unique(command_id,event_type),
  constraint wechat_refund_event_lease_check check(
    (status='processing' and locked_by is not null and locked_at is not null
      and lease_token is not null and lease_expires_at is not null)
    or (status<>'processing' and locked_by is null and locked_at is null
      and lease_token is null and lease_expires_at is null)
  )
);
create index wechat_refund_event_ready
on public.wechat_refund_event_outbox(status,available_at,created_at);

create table public.wechat_refund_event_inbox(
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null unique references public.wechat_refund_event_outbox(id) on delete restrict,
  event_key text not null unique,
  payload_digest text not null check(payload_digest~'^[0-9a-f]{64}$'),
  consumer text not null check(char_length(consumer) between 1 and 120),
  consumed_at timestamptz not null default now()
);

create function public.enforce_wechat_refund_attempt_identity()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if row(new.command_id,new.attempt_no,new.operation,new.worker_id,new.started_at)
     is distinct from row(old.command_id,old.attempt_no,old.operation,old.worker_id,old.started_at)
  then raise exception 'WECHAT_REFUND_ATTEMPT_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;
create trigger wechat_refund_provider_attempt_identity
before update on public.wechat_refund_provider_attempts
for each row execute function public.enforce_wechat_refund_attempt_identity();
create trigger wechat_refund_provider_attempt_delete
before delete on public.wechat_refund_provider_attempts
for each row execute function public.reject_immutable_change();
create trigger wechat_refund_notification_inbox_immutable
before update or delete on public.wechat_refund_notification_inbox
for each row execute function public.reject_immutable_change();
create trigger wechat_refund_event_inbox_immutable
before update or delete on public.wechat_refund_event_inbox
for each row execute function public.reject_immutable_change();

create function public.queue_wechat_refund_event(p_command_id uuid,p_event_type text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare command public.wechat_refund_commands%rowtype;
begin
  select * into strict command from public.wechat_refund_commands where id=p_command_id;
  if (p_event_type='RefundSucceeded' and command.status<>'provider_succeeded')
     or (p_event_type='RefundClosed' and command.status<>'provider_closed')
     or p_event_type not in ('RefundSucceeded','RefundClosed')
  then raise exception 'WECHAT_REFUND_EVENT_STATE_INVALID'; end if;
  insert into public.wechat_refund_event_outbox(
    event_key,command_id,tenant_id,aggregate_id,event_type,payload_json
  ) values(
    'wechat-refund:'||command.id||':'||p_event_type,command.id,command.tenant_id,
    command.refund_id,p_event_type,jsonb_build_object(
      'commandId',command.id,'refundId',command.refund_id,'afterSaleId',command.after_sale_id,
      'orderId',command.order_id,'paymentId',command.payment_id,'outRefundNo',command.out_refund_no,
      'providerRefundId',command.provider_refund_id,'amountCents',command.amount_cents,
      'currency',command.currency,'providerStatus',command.provider_status
    )
  ) on conflict(command_id,event_type) do nothing;
end $$;

-- The only internal-account money-movement primitive.  It deliberately has no
-- caller-supplied scope: the public request function has already derived and
-- locked the after-sale/order graph, while this owner-only function rechecks
-- every accounting invariant before moving a cent.
create function public.execute_internal_refund_primitive(
  p_after_sale_id text,p_refund_cents bigint,p_idempotency_key text,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare after_sale public.after_sales%rowtype; order_row public.orders%rowtype;
  payment record; account public.welfare_accounts%rowtype;
  internal_intent_id uuid; intent_count integer; capture_count integer;
  refundable_count integer; refundable_total bigint; remaining bigint:=p_refund_cents;
  refund_amount bigint; total_refunded bigint; refund_no text;
  refund_nos jsonb:='[]'::jsonb; occurred_at timestamptz:=clock_timestamp();
begin
  if p_refund_cents is null or p_refund_cents<=0
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 120
  then raise exception 'REFUND_AMOUNT_INVALID'; end if;
  select * into strict after_sale from public.after_sales where id=p_after_sale_id;
  select * into strict order_row from public.orders where id=after_sale.order_id;
  if after_sale.status<>'approved' then raise exception 'AFTER_SALE_NOT_APPROVED'; end if;
  if after_sale.migration_status<>'ready' then raise exception 'AFTER_SALE_HISTORY_REQUIRES_REVIEW'; end if;
  if after_sale.type<>'refund_only' then raise exception 'AFTER_SALE_NOT_REFUNDABLE'; end if;
  if order_row.status<>'refund_pending' then raise exception 'AFTER_SALE_ORDER_STATE_CONFLICT'; end if;
  if after_sale.user_id<>order_row.user_id or after_sale.tenant_id<>order_row.tenant_id
     or after_sale.mall_id<>order_row.mall_id
  then raise exception 'REFUND_INTERNAL_EVIDENCE_MISMATCH'; end if;
  if p_refund_cents>after_sale.requested_amount_cents
  then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;

  select (array_agg(distinct source.payment_intent_id)
      filter(where source.payment_intent_id is not null))[1],
    count(distinct source.payment_intent_id)
  into internal_intent_id,intent_count
  from public.payments source
  where source.order_id=order_row.id and source.channel in('welfare','meal')
    and source.status in('succeeded','refunded');
  if internal_intent_id is null or intent_count<>1
     or exists(select 1 from public.payments source
       where source.order_id=order_row.id and source.channel in('welfare','meal')
         and source.status in('succeeded','refunded') and source.payment_intent_id is null)
  then raise exception 'PAYMENT_ACCOUNTING_PENDING'; end if;
  select count(*) into capture_count from public.finance_journals journal
  where journal.payment_intent_id=internal_intent_id and journal.payment_id is null
    and journal.journal_type='payment_capture' and journal.status='posted'
    and journal.order_id=order_row.id and journal.amount_cents=order_row.paid_cents;
  if capture_count<>1 then raise exception 'PAYMENT_ACCOUNTING_PENDING'; end if;

  select count(*),coalesce(sum(source.remaining_cents),0)
  into refundable_count,refundable_total
  from(
    select source.id,source.amount_cents-
      coalesce(sum(refund.amount_cents) filter(where refund.status='succeeded'),0)
      as remaining_cents
    from public.payments source left join public.refunds refund on refund.payment_id=source.id
    where source.order_id=order_row.id and source.channel in('welfare','meal')
      and source.status in('succeeded','refunded')
    group by source.id,source.amount_cents
  ) source where source.remaining_cents>0;
  if p_refund_cents>refundable_total then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  -- No signed business/finance rule currently chooses which internal tender is
  -- consumed by a partial multi-tender refund.  Full remainder is unambiguous;
  -- a single remaining tender may still be partially refunded.
  if refundable_count>1 and p_refund_cents<>refundable_total
  then raise exception 'REFUND_ALLOCATION_RULE_REQUIRED'; end if;

  perform 1 from public.welfare_accounts welfare_account
  join public.payment_allocations allocation on allocation.account_id=welfare_account.id
  join public.payments source on source.id=allocation.payment_id
  where source.order_id=order_row.id and source.channel in('welfare','meal')
    and source.status in('succeeded','refunded')
  order by case source.channel when 'welfare' then 1 else 2 end,welfare_account.id
  for update of welfare_account;
  for payment in
    select source.id,source.payment_no,source.channel,source.amount_cents,source.user_id,
      source.amount_cents-
        coalesce(sum(refund.amount_cents) filter(where refund.status='succeeded'),0)
        as remaining_cents
    from public.payments source left join public.refunds refund on refund.payment_id=source.id
    where source.order_id=order_row.id and source.channel in('welfare','meal')
      and source.status in('succeeded','refunded')
    group by source.id,source.payment_no,source.channel,source.amount_cents,source.user_id
    having source.amount_cents-
      coalesce(sum(refund.amount_cents) filter(where refund.status='succeeded'),0)>0
    order by case source.channel when 'welfare' then 1 else 2 end,source.id
  loop
    exit when remaining=0;
    refund_amount:=least(remaining,payment.remaining_cents);
    select welfare_account.* into strict account
    from public.welfare_accounts welfare_account
    join public.payment_allocations allocation on allocation.account_id=welfare_account.id
    where allocation.payment_id=payment.id and allocation.order_id=order_row.id
      and allocation.channel=payment.channel and allocation.amount_cents=payment.amount_cents;
    if account.tenant_id<>order_row.tenant_id or account.enterprise_id<>order_row.enterprise_id
       or account.mall_id<>order_row.mall_id or account.user_id<>order_row.user_id
       or account.account_type<>payment.channel
    then raise exception 'REFUND_INTERNAL_EVIDENCE_MISMATCH'; end if;
    update public.welfare_accounts welfare_account set
      balance_cents=welfare_account.balance_cents+refund_amount,
      version=welfare_account.version+1,updated_at=occurred_at
    where welfare_account.id=account.id;
    insert into public.account_ledgers(
      id,tenant_id,mall_id,account_id,user_id,direction,amount_cents,
      balance_after_cents,business_type,business_id,idempotency_key,created_at
    ) select gen_random_uuid()::text,order_row.tenant_id,order_row.mall_id,account.id,
      order_row.user_id,'credit',refund_amount,welfare_account.balance_cents,
      'order_refund',order_row.id,p_idempotency_key||':'||payment.id,occurred_at
    from public.welfare_accounts welfare_account where welfare_account.id=account.id;
    refund_no:='REF'||to_char(occurred_at,'YYYYMMDDHH24MISSMS')||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.refunds(
      id,refund_no,tenant_id,mall_id,order_id,payment_id,amount_cents,status,
      reason,idempotency_key,created_at,completed_at
    ) values(
      gen_random_uuid()::text,refund_no,order_row.tenant_id,order_row.mall_id,
      order_row.id,payment.id,refund_amount,'succeeded',after_sale.reason,
      p_idempotency_key||':'||payment.id,occurred_at,occurred_at
    );
    update public.payments source set status=case
      when (select coalesce(sum(refund.amount_cents),0)
        from public.refunds refund where refund.payment_id=source.id
          and refund.status='succeeded')=source.amount_cents
      then 'refunded' else 'succeeded' end
    where source.id=payment.id;
    refund_nos:=refund_nos||jsonb_build_array(refund_no);
    remaining:=remaining-refund_amount;
  end loop;
  if remaining<>0 then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  select coalesce(sum(refund.amount_cents),0) into total_refunded
  from public.refunds refund where refund.order_id=order_row.id and refund.status='succeeded';
  update public.after_sales set status='completed',updated_at=occurred_at
  where id=after_sale.id;
  update public.orders set
    status=case when total_refunded=paid_cents then 'refunded' else 'paid' end,
    updated_at=occurred_at where id=order_row.id;
  return jsonb_build_object('refund',jsonb_build_object(
    'afterSaleId',after_sale.id,'orderId',order_row.id,'amountCents',p_refund_cents,
    'refundNos',refund_nos,'status','succeeded','completedAt',occurred_at
  ),'requestId',p_request_id);
end $$;
revoke all on function public.execute_internal_refund_primitive(text,bigint,text,text)
from public,anon,authenticated,service_role;

create function public.api_request_refund_authorized(
  p_operator_user_id text,p_after_sale_id text,p_refund_cents bigint,
  p_idempotency_key text,p_request_hash text,p_request_id text,p_user_agent text,
  p_membership_id text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare after_sale public.after_sales%rowtype; order_row public.orders%rowtype;
  payment_row public.payments%rowtype; attempt public.wechat_payment_attempts%rowtype;
  existing public.idempotency_keys%rowtype; result jsonb; refund_id text:=gen_random_uuid()::text;
  out_refund_no text:='WR'||replace(gen_random_uuid()::text,'-','');
  internal_count integer; wechat_count integer; other_count integer; committed_refunds bigint;
  target_tenant_id text; target_enterprise_id text; target_mall_id text;
  target_order_id text;
begin
  if p_refund_cents is null or p_refund_cents<=0
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 120
     or char_length(trim(coalesce(p_request_hash,'')))=0
  then raise exception 'REFUND_AMOUNT_INVALID'; end if;
  if not public.api_membership_actor_matches(p_membership_id,p_operator_user_id,'admin')
     or not public.api_membership_has_permission(p_membership_id,'order.refund')
     or not public.api_authorization_evidence_matches(p_granted_via,p_membership_id,'order.refund',true)
  then raise exception 'REFUND_OPERATOR_NOT_AUTHORIZED'; end if;
  select after_sales.tenant_id,orders.enterprise_id,after_sales.mall_id,orders.id
  into target_tenant_id,target_enterprise_id,target_mall_id,target_order_id
  from public.after_sales after_sales join public.orders orders
    on orders.id=after_sales.order_id where after_sales.id=p_after_sale_id;
  if not found then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  if not public.api_lock_membership_actor(
       p_membership_id,p_operator_user_id,'admin',target_tenant_id,
       target_enterprise_id,target_mall_id
     )
  then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  if not public.api_membership_has_permission(p_membership_id,'order.refund')
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_membership_id,'order.refund',true
     )
  then raise exception 'REFUND_OPERATOR_NOT_AUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||target_order_id,0));
  select * into order_row from public.orders where id=target_order_id for update;
  if not found then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  perform 1 from public.payments payment where payment.order_id=target_order_id
    order by payment.id for update;
  perform 1 from public.wechat_payment_attempts payment_attempt
    where payment_attempt.order_id=target_order_id
    order by payment_attempt.id for update;
  select * into after_sale from public.after_sales
  where id=p_after_sale_id and order_id=target_order_id for update;
  if not found then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  if after_sale.tenant_id is distinct from target_tenant_id
     or order_row.enterprise_id is distinct from target_enterprise_id
     or after_sale.mall_id is distinct from target_mall_id
     or after_sale.user_id<>order_row.user_id
     or after_sale.tenant_id<>order_row.tenant_id or after_sale.mall_id<>order_row.mall_id
     or not public.api_membership_scope_allows(p_membership_id,after_sale.tenant_id,order_row.enterprise_id,after_sale.mall_id)
  then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(after_sale.mall_id||':refund:request:'||p_idempotency_key,0));
  select * into existing from public.idempotency_keys
  where mall_id=after_sale.mall_id and scope='refund:request'
    and idempotency_key=p_idempotency_key and expires_at>now();
  if found then
    if existing.request_hash is distinct from p_request_hash
       or existing.resource_id is distinct from p_after_sale_id
       or existing.tenant_id is distinct from after_sale.tenant_id
       or (existing.response_json#>>'{refund,amountCents}')::bigint
         is distinct from p_refund_cents
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return existing.response_json;
  end if;
  if after_sale.status<>'approved' then raise exception 'AFTER_SALE_NOT_APPROVED'; end if;
  if after_sale.migration_status<>'ready' then raise exception 'AFTER_SALE_HISTORY_REQUIRES_REVIEW'; end if;
  if after_sale.type<>'refund_only' then raise exception 'AFTER_SALE_NOT_REFUNDABLE'; end if;
  if order_row.status<>'refund_pending' then raise exception 'AFTER_SALE_ORDER_STATE_CONFLICT'; end if;
  if p_refund_cents>after_sale.requested_amount_cents then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;

  select count(*) filter(where channel in ('welfare','meal')),
    count(*) filter(where channel='wechat'),
    count(*) filter(where channel not in ('welfare','meal','wechat'))
  into internal_count,wechat_count,other_count
  from public.payments where order_id=order_row.id and status in ('succeeded','refunded');
  if other_count>0 then raise exception 'REFUND_CHANNEL_UNSUPPORTED'; end if;
  if internal_count>0 and wechat_count>0 then raise exception 'REFUND_ALLOCATION_RULE_REQUIRED'; end if;
  if internal_count>0 and wechat_count=0 then
    result:=public.execute_internal_refund_primitive(
      p_after_sale_id,p_refund_cents,p_idempotency_key,p_request_id
    );
    insert into public.idempotency_keys(
      tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,
      response_json,created_at,expires_at
    ) values(
      after_sale.tenant_id,after_sale.mall_id,'refund:request',p_idempotency_key,
      p_request_hash,after_sale.id,result,now(),now()+interval '24 hours'
    );
    insert into public.audit_logs(
      id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
      resource_type,resource_id,request_id,user_agent,after_json,membership_id,
      granted_via,created_at
    ) values(
      gen_random_uuid()::text,after_sale.tenant_id,order_row.enterprise_id,
      after_sale.mall_id,p_operator_user_id,'admin','refund.internal.succeeded',
      'after_sale',after_sale.id,p_request_id,left(coalesce(p_user_agent,''),300),
      jsonb_build_object('orderId',order_row.id,'amountCents',p_refund_cents,
        'idempotencyKey',p_idempotency_key),p_membership_id,p_granted_via,now()
    );
    return result;
  end if;
  if wechat_count<>1 or internal_count<>0 then raise exception 'REFUND_CHANNEL_UNSUPPORTED'; end if;

  if exists(select 1 from public.wechat_refund_commands where after_sale_id=p_after_sale_id)
  then raise exception 'REFUND_ALREADY_REQUESTED'; end if;
  select * into strict payment_row from public.payments
  where order_id=order_row.id and channel='wechat' and status in ('succeeded','refunded') for update;
  if not exists(select 1 from public.finance_journals journal
    where journal.payment_id=payment_row.id and journal.payment_intent_id is null
      and journal.journal_type='payment_capture' and journal.status='posted'
      and journal.order_id=order_row.id and journal.amount_cents=payment_row.amount_cents)
  then raise exception 'PAYMENT_ACCOUNTING_PENDING'; end if;
  select coalesce(sum(amount_cents),0) into committed_refunds from public.refunds
  where payment_id=payment_row.id and status in ('processing','succeeded');
  if p_refund_cents>payment_row.amount_cents-committed_refunds
     or p_refund_cents>order_row.paid_cents-committed_refunds
  then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  select * into attempt from public.wechat_payment_attempts
  where payment_id=payment_row.id and status='succeeded'
  order by completed_at desc nulls last,id desc limit 1 for share;
  if not found or payment_row.provider_trade_no is null
     or attempt.transaction_id is distinct from payment_row.provider_trade_no
  then raise exception 'WECHAT_REFUND_PAYMENT_EVIDENCE_MISSING'; end if;

  insert into public.refunds(id,refund_no,tenant_id,mall_id,order_id,payment_id,
    amount_cents,status,reason,idempotency_key)
  values(refund_id,out_refund_no,after_sale.tenant_id,after_sale.mall_id,order_row.id,
    payment_row.id,p_refund_cents,'processing',after_sale.reason,p_idempotency_key);
  insert into public.wechat_refund_commands(
    tenant_id,mall_id,after_sale_id,order_id,payment_id,refund_id,payment_attempt_id,
    out_refund_no,out_trade_no,transaction_id,amount_cents,payment_total_cents,reason,
    idempotency_key,request_hash
  ) values(
    after_sale.tenant_id,after_sale.mall_id,after_sale.id,order_row.id,payment_row.id,
    refund_id,attempt.id,out_refund_no,attempt.out_trade_no,payment_row.provider_trade_no,
    p_refund_cents,payment_row.amount_cents,after_sale.reason,p_idempotency_key,p_request_hash
  );
  result:=jsonb_build_object('refund',jsonb_build_object(
    'afterSaleId',after_sale.id,'orderId',order_row.id,'refundNo',out_refund_no,
    'amountCents',p_refund_cents,'status','processing'
  ),'requestId',p_request_id);
  insert into public.idempotency_keys values(
    after_sale.tenant_id,after_sale.mall_id,'refund:request',p_idempotency_key,
    p_request_hash,after_sale.id,result,now(),now()+interval '24 hours'
  );
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,
    actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,
    membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,after_sale.tenant_id,order_row.enterprise_id,
    after_sale.mall_id,p_operator_user_id,'admin','refund.wechat.requested','after_sale',
    after_sale.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object(
      'orderId',order_row.id,'refundId',refund_id,'amountCents',p_refund_cents,
      'idempotencyKey',p_idempotency_key),p_membership_id,p_granted_via,now());
  return result;
end $$;

create function public.enforce_wechat_refund_event_identity()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if row(new.event_key,new.command_id,new.tenant_id,new.aggregate_type,new.aggregate_id,
      new.aggregate_version,new.event_type,new.event_version,new.payload_json,new.created_at)
     is distinct from row(old.event_key,old.command_id,old.tenant_id,old.aggregate_type,
      old.aggregate_id,old.aggregate_version,old.event_type,old.event_version,
      old.payload_json,old.created_at)
  then raise exception 'WECHAT_REFUND_EVENT_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;
create trigger wechat_refund_event_identity
before update on public.wechat_refund_event_outbox
for each row execute function public.enforce_wechat_refund_event_identity();

create function public.api_claim_wechat_refund_commands(
  p_worker_id text,p_limit integer default 20,p_lease_seconds integer default 120
) returns table(
  id uuid,provider_attempt_id uuid,operation text,out_refund_no text,
  out_trade_no text,transaction_id text,amount_cents bigint,payment_total_cents bigint,
  currency text,reason text,attempts integer,lease_token uuid,lease_expires_at timestamptz
) language plpgsql security definer set search_path=public,pg_temp as $$
declare seconds integer:=least(greatest(coalesce(p_lease_seconds,120),15),900);
begin
  if char_length(trim(coalesce(p_worker_id,''))) not between 1 and 120
  then raise exception 'WECHAT_REFUND_WORKER_INVALID'; end if;
  update public.wechat_refund_commands command set status='dead_letter',dead_lettered_at=now(),
    last_error_code=coalesce(last_error_code,'RETRY_EXHAUSTED'),locked_by=null,locked_at=null,
    lease_token=null,lease_expires_at=null,updated_at=now()
  where command.attempts>=12 and (command.status='requested'
    or (command.status='processing' and command.lease_expires_at<=now()));
  insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,
    payment_intent_id,source_effect_id,refund_id,recipient_kind,recipient_id,
    channel,template_key,payload_json)
  select command.tenant_id,command.mall_id,command.order_id,command.payment_id,
    null,null,command.refund_id,'operations',command.mall_id,'inapp',
    'refund.manual_review',jsonb_build_object('orderId',command.order_id,
      'refundId',command.refund_id,'errorCode',command.last_error_code)
  from public.wechat_refund_commands command where command.status='dead_letter'
  on conflict(refund_id,recipient_kind,channel,template_key)
    where refund_id is not null do nothing;
  return query with candidate as(
    select command.id from public.wechat_refund_commands command
    where command.attempts<12 and command.available_at<=now()
      and (command.status='requested'
        or (command.status='processing' and command.lease_expires_at<=now()))
    order by command.available_at,command.created_at,command.id
    for update skip locked limit least(greatest(coalesce(p_limit,20),1),100)
  ),claimed as(
    update public.wechat_refund_commands command set status='processing',
      attempts=command.attempts+1,locked_by=trim(p_worker_id),locked_at=now(),
      lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>seconds),
      updated_at=now() from candidate where command.id=candidate.id
    returning command.*
  ),attempts as(
    insert into public.wechat_refund_provider_attempts(command_id,attempt_no,operation,worker_id)
    select claimed.id,claimed.attempts,claimed.next_operation,trim(p_worker_id)
    from claimed returning *
  ) select claimed.id,attempts.id,attempts.operation,claimed.out_refund_no,
    claimed.out_trade_no,claimed.transaction_id,claimed.amount_cents,
    claimed.payment_total_cents,claimed.currency,claimed.reason,claimed.attempts,
    claimed.lease_token,claimed.lease_expires_at
  from claimed join attempts on attempts.command_id=claimed.id and attempts.attempt_no=claimed.attempts;
end $$;

create function public.api_record_wechat_refund_result(
  p_command_id uuid,p_provider_attempt_id uuid,p_worker_id text,p_lease_token uuid,
  p_provider_status text,p_provider_refund_id text,p_provider_request_id text,
  p_out_refund_no text,p_out_trade_no text,p_transaction_id text,
  p_refund_cents bigint,p_total_cents bigint,p_currency text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare command public.wechat_refund_commands%rowtype; attempt public.wechat_refund_provider_attempts%rowtype;
  next_status text; delay_seconds double precision;
begin
  if p_provider_status not in ('PROCESSING','ABNORMAL','SUCCESS','CLOSED')
     or char_length(trim(coalesce(p_provider_refund_id,''))) not between 1 and 128
     or char_length(coalesce(p_provider_request_id,''))>128
     or p_refund_cents is null or p_total_cents is null or p_currency<>'CNY'
  then raise exception 'WECHAT_REFUND_RESULT_INVALID'; end if;
  select * into command from public.wechat_refund_commands
  where id=p_command_id and status='processing' and locked_by=trim(p_worker_id)
    and lease_token=p_lease_token and lease_expires_at>now() for update;
  if not found then return jsonb_build_object('accepted',false,'status','lease_lost'); end if;
  select * into strict attempt from public.wechat_refund_provider_attempts
  where id=p_provider_attempt_id and command_id=command.id and attempt_no=command.attempts
    and worker_id=trim(p_worker_id) and outcome='started';
  if p_out_refund_no is distinct from command.out_refund_no
     or nullif(p_out_trade_no,'') is distinct from command.out_trade_no
     or nullif(p_transaction_id,'') is distinct from command.transaction_id
     or p_refund_cents<>command.amount_cents or p_total_cents<>command.payment_total_cents
     or p_currency<>command.currency
  then raise exception 'WECHAT_REFUND_RESULT_EVIDENCE_MISMATCH'; end if;
  if exists(select 1 from public.wechat_refund_commands other
    where other.provider_refund_id=p_provider_refund_id and other.id<>command.id)
  then raise exception 'WECHAT_REFUND_PROVIDER_ID_CONFLICT'; end if;
  if command.provider_refund_id is not null and command.provider_refund_id<>p_provider_refund_id
  then raise exception 'WECHAT_REFUND_PROVIDER_ID_CONFLICT'; end if;
  next_status:=case
    when attempt.operation='apply' then 'requested'
    when p_provider_status='SUCCESS' then 'provider_succeeded'
    when p_provider_status='CLOSED' then 'provider_closed'
    else 'requested' end;
  delay_seconds:=case when attempt.operation='apply' then 60.0 else
    least(3600.0,30.0*power(2.0,least(command.attempts-1,7)))*(0.8+random()*0.4) end;
  update public.wechat_refund_commands set status=next_status,
    next_operation='query',
    provider_status=p_provider_status,provider_refund_id=p_provider_refund_id,
    provider_request_id=nullif(p_provider_request_id,''),last_error_code=null,
    available_at=case when next_status='requested' then now()+make_interval(secs=>delay_seconds) else available_at end,
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null,updated_at=now()
  where id=command.id;
  update public.wechat_refund_provider_attempts set
    outcome=case when attempt.operation='apply' then 'accepted'
      when p_provider_status='PROCESSING' then 'processing'
      when p_provider_status='ABNORMAL' then 'abnormal'
      when p_provider_status='SUCCESS' then 'succeeded' else 'closed' end,
    provider_status=p_provider_status,provider_refund_id=p_provider_refund_id,
    provider_request_id=nullif(p_provider_request_id,''),completed_at=now()
  where id=attempt.id;
  if attempt.operation='query' and p_provider_status='SUCCESS'
  then perform public.queue_wechat_refund_event(command.id,'RefundSucceeded'); end if;
  if attempt.operation='query' and p_provider_status='CLOSED'
  then perform public.queue_wechat_refund_event(command.id,'RefundClosed'); end if;
  return jsonb_build_object('accepted',true,'status',next_status,'providerStatus',p_provider_status);
end $$;

create function public.api_fail_wechat_refund_attempt(
  p_command_id uuid,p_provider_attempt_id uuid,p_worker_id text,p_lease_token uuid,
  p_error_code text,p_retryable boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare command public.wechat_refund_commands%rowtype; attempt public.wechat_refund_provider_attempts%rowtype;
  safe_error_code text; next_status text; resolved_operation text; delay_seconds double precision;
begin
  safe_error_code:=left(coalesce(nullif(regexp_replace(upper(coalesce(p_error_code,'')),'[^A-Z0-9_.:-]','','g'),''),'WECHAT_REFUND_FAILED'),120);
  select * into command from public.wechat_refund_commands
  where id=p_command_id and status='processing' and locked_by=trim(p_worker_id)
    and lease_token=p_lease_token and lease_expires_at>now() for update;
  if not found then return jsonb_build_object('accepted',false,'status','lease_lost'); end if;
  select * into strict attempt from public.wechat_refund_provider_attempts
  where id=p_provider_attempt_id and command_id=command.id and attempt_no=command.attempts
    and worker_id=trim(p_worker_id) and outcome='started';
  if attempt.operation='query'
     and safe_error_code='WECHAT_PAY_PROVIDER_RESOURCE_NOT_EXISTS'
     and command.attempts<12
  then
    next_status:='requested'; resolved_operation:='apply'; delay_seconds:=60.0;
  elsif p_retryable and command.attempts<12 then
    next_status:='requested'; resolved_operation:='query';
    delay_seconds:=least(3600.0,5.0*power(2.0,least(command.attempts-1,9)))*(0.8+random()*0.4);
  else
    next_status:='dead_letter'; resolved_operation:=command.next_operation; delay_seconds:=0;
  end if;
  update public.wechat_refund_commands set status=next_status,last_error_code=safe_error_code,
    next_operation=resolved_operation,
    available_at=case when next_status='requested' then now()+make_interval(secs=>delay_seconds) else available_at end,
    dead_lettered_at=case when next_status='dead_letter' then now() else null end,
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null,updated_at=now()
  where id=command.id;
  update public.wechat_refund_provider_attempts provider_attempt set
    outcome=case when next_status='dead_letter' then 'dead_letter' else 'retry' end,
    error_code=safe_error_code,completed_at=now()
  where provider_attempt.id=attempt.id;
  if next_status='dead_letter' then
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,
      payment_intent_id,source_effect_id,refund_id,recipient_kind,recipient_id,
      channel,template_key,payload_json)
    values(command.tenant_id,command.mall_id,command.order_id,command.payment_id,
      null,null,command.refund_id,'operations',command.mall_id,'inapp',
      'refund.manual_review',jsonb_build_object('orderId',command.order_id,
        'refundId',command.refund_id,'errorCode',safe_error_code))
    on conflict(refund_id,recipient_kind,channel,template_key)
      where refund_id is not null do nothing;
  end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,action,
    resource_type,resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,command.tenant_id,orders.enterprise_id,command.mall_id,
    'system','refund.wechat.'||next_status,'refund',command.refund_id,
    'wechat-refund:'||command.id||':'||command.attempts,
    jsonb_build_object('errorCode',safe_error_code,'attempts',command.attempts),now()
  from public.orders orders where orders.id=command.order_id;
  return jsonb_build_object('accepted',true,'status',next_status,'errorCode',safe_error_code);
end $$;

create function public.api_apply_wechat_refund_notification(
  p_notification_id text,p_event_type text,p_resource_type text,p_mch_id text,
  p_out_trade_no text,p_transaction_id text,p_out_refund_no text,p_refund_id text,
  p_refund_status text,p_success_time timestamptz,p_amount_refund bigint,
  p_amount_total bigint,p_payer_refund bigint,p_payer_total bigint,
  p_evidence_json jsonb,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare command public.wechat_refund_commands%rowtype; payment_attempt public.wechat_payment_attempts%rowtype;
  existing public.wechat_refund_notification_inbox%rowtype; digest_value text;
  next_status text; expected_event text;
begin
  expected_event:=case p_refund_status when 'SUCCESS' then 'REFUND.SUCCESS'
    when 'ABNORMAL' then 'REFUND.ABNORMAL' when 'CLOSED' then 'REFUND.CLOSED' end;
  if expected_event is null or p_event_type is distinct from expected_event
     or p_resource_type<>'encrypt-resource'
     or char_length(trim(coalesce(p_notification_id,''))) not between 1 and 128
     or char_length(trim(coalesce(p_refund_id,''))) not between 1 and 128
     or char_length(trim(coalesce(p_request_id,''))) not between 1 and 160
     or p_amount_refund is null or p_amount_total is null or p_payer_refund is null or p_payer_total is null
     or p_amount_refund<=0 or p_amount_total<=0 or p_payer_refund<0 or p_payer_total<0
     or p_payer_refund>p_amount_refund or p_payer_total>p_amount_total
     or (p_refund_status='SUCCESS')<>(p_success_time is not null)
     or jsonb_typeof(coalesce(p_evidence_json,'{}'))<>'object'
     or octet_length(coalesce(p_evidence_json,'{}')::text)>8192
  then raise exception 'WECHAT_REFUND_NOTIFICATION_INVALID'; end if;
  digest_value:=encode(digest(coalesce(p_evidence_json,'{}')::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('wechat-refund-notification:'||p_notification_id,0));
  select * into existing from public.wechat_refund_notification_inbox
  where notification_id=p_notification_id;
  if found then
    if existing.evidence_digest<>digest_value or existing.event_type<>p_event_type
    then raise exception 'WECHAT_REFUND_NOTIFICATION_REPLAY_MISMATCH'; end if;
    return jsonb_build_object('applied',false,'duplicate',true,'status',p_refund_status);
  end if;
  select * into command from public.wechat_refund_commands
  where out_refund_no=p_out_refund_no for update;
  if not found then raise exception 'WECHAT_REFUND_COMMAND_NOT_FOUND'; end if;
  select * into strict payment_attempt from public.wechat_payment_attempts
  where id=command.payment_attempt_id;
  if payment_attempt.mch_id is distinct from p_mch_id
     or command.out_trade_no is distinct from p_out_trade_no
     or command.transaction_id is distinct from p_transaction_id
     or command.amount_cents<>p_amount_refund or command.payment_total_cents<>p_amount_total
  then raise exception 'WECHAT_REFUND_NOTIFICATION_EVIDENCE_MISMATCH'; end if;
  if command.provider_refund_id is not null and command.provider_refund_id<>p_refund_id
  then raise exception 'WECHAT_REFUND_PROVIDER_ID_CONFLICT'; end if;
  if exists(select 1 from public.wechat_refund_commands other
    where other.provider_refund_id=p_refund_id and other.id<>command.id)
  then raise exception 'WECHAT_REFUND_PROVIDER_ID_CONFLICT'; end if;
  if (command.status in ('provider_succeeded','succeeded') and p_refund_status<>'SUCCESS')
     or (command.status in ('provider_closed','closed') and p_refund_status<>'CLOSED')
  then raise exception 'WECHAT_REFUND_TERMINAL_STATE_CONFLICT'; end if;
  insert into public.wechat_refund_notification_inbox(
    notification_id,command_id,event_type,evidence_digest
  ) values(p_notification_id,command.id,p_event_type,digest_value);
  next_status:=case
    when command.status='succeeded' then 'succeeded'
    when command.status='closed' then 'closed'
    when p_refund_status='SUCCESS' then 'provider_succeeded'
    when p_refund_status='CLOSED' then 'provider_closed'
    else 'requested' end;
  update public.wechat_refund_commands set status=next_status,next_operation='query',
    provider_status=p_refund_status,
    provider_refund_id=p_refund_id,last_error_code=null,
    available_at=case when next_status='requested' then now()+interval '60 seconds' else available_at end,
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null,updated_at=now()
  where id=command.id and status not in ('succeeded','closed');
  update public.wechat_refund_provider_attempts set outcome='superseded',
    provider_status=p_refund_status,provider_refund_id=p_refund_id,completed_at=now()
  where command_id=command.id and outcome='started';
  if next_status='provider_succeeded' then perform public.queue_wechat_refund_event(command.id,'RefundSucceeded'); end if;
  if next_status='provider_closed' then perform public.queue_wechat_refund_event(command.id,'RefundClosed'); end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,action,
    resource_type,resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,command.tenant_id,orders.enterprise_id,command.mall_id,
    'system','refund.wechat.notification_recorded','refund',command.refund_id,p_request_id,
    jsonb_build_object('notificationId',p_notification_id,'refundStatus',p_refund_status,
      'providerRefundId',p_refund_id),now()
  from public.orders orders where orders.id=command.order_id;
  return jsonb_build_object('applied',true,'duplicate',false,'status',p_refund_status);
end $$;

create function public.alert_wechat_refund_event_deadletter(p_event_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.wechat_refund_event_outbox%rowtype;
  command public.wechat_refund_commands%rowtype; order_row public.orders%rowtype;
  notification_id uuid;
begin
  select * into strict event from public.wechat_refund_event_outbox
  where id=p_event_id and status='dead_letter';
  select * into strict command from public.wechat_refund_commands
  where id=event.command_id;
  select * into strict order_row from public.orders where id=command.order_id;
  insert into public.notification_dispatches(
    tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
    refund_id,recipient_kind,recipient_id,channel,template_key,payload_json
  ) values(
    command.tenant_id,command.mall_id,command.order_id,command.payment_id,
    null,null,command.refund_id,'operations',command.mall_id,'inapp',
    'refund.effect.deadletter',jsonb_build_object('eventId',event.id,
      'refundId',command.refund_id,'eventType',event.event_type,
      'errorCode',event.last_error_code,'attempts',event.attempts)
  ) on conflict(refund_id,recipient_kind,channel,template_key)
    where refund_id is not null do nothing returning id into notification_id;
  if notification_id is not null then
    insert into public.audit_logs(
      id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,
      resource_id,request_id,after_json,created_at
    ) values(
      gen_random_uuid()::text,command.tenant_id,order_row.enterprise_id,
      command.mall_id,'system','refund.wechat.effect_dead_letter','refund',
      command.refund_id,'wechat-refund-deadletter:'||event.id,
      jsonb_build_object('eventId',event.id,'eventType',event.event_type,
        'errorCode',event.last_error_code,'attempts',event.attempts),now()
    );
  end if;
end $$;

create function public.api_claim_wechat_refund_events(
  p_worker_id text,p_limit integer default 20,p_lease_seconds integer default 120
) returns table(id uuid,event_type text,aggregate_id text,aggregate_version bigint,
  attempts integer,lease_token uuid,lease_expires_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare seconds integer:=least(greatest(coalesce(p_lease_seconds,120),15),900);
  dead_event record;
begin
  if char_length(trim(coalesce(p_worker_id,''))) not between 1 and 120
  then raise exception 'WECHAT_REFUND_EVENT_WORKER_INVALID'; end if;
  update public.wechat_refund_event_outbox event set status='dead_letter',
    dead_lettered_at=now(),last_error_code=coalesce(last_error_code,'RETRY_EXHAUSTED'),
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null
  where event.attempts>=12 and (event.status='pending'
    or (event.status='processing' and event.lease_expires_at<=now()));
  for dead_event in select deadletter.id from public.wechat_refund_event_outbox deadletter
    where deadletter.status='dead_letter'
  loop perform public.alert_wechat_refund_event_deadletter(dead_event.id); end loop;
  return query with candidate as(
    select event.id from public.wechat_refund_event_outbox event
    where event.attempts<12 and event.available_at<=now()
      and (event.status='pending'
        or (event.status='processing' and event.lease_expires_at<=now()))
    order by event.available_at,event.created_at,event.id
    for update skip locked limit least(greatest(coalesce(p_limit,20),1),100)
  ) update public.wechat_refund_event_outbox event set status='processing',
    attempts=event.attempts+1,locked_by=trim(p_worker_id),locked_at=now(),
    lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>seconds)
  from candidate where event.id=candidate.id
  returning event.id,event.event_type,event.aggregate_id,event.aggregate_version,
    event.attempts,event.lease_token,event.lease_expires_at;
end $$;

create function public.process_wechat_refund_event(p_event_id uuid,p_worker_id text,p_lease_token uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.wechat_refund_event_outbox%rowtype; command public.wechat_refund_commands%rowtype;
  command_snapshot public.wechat_refund_commands%rowtype;
  refund public.refunds%rowtype; after_sale public.after_sales%rowtype; order_row public.orders%rowtype;
  payment public.payments%rowtype; event_payload_digest text; total_payment_refunds bigint;
  total_order_refunds bigint;
begin
  select command_row.* into command_snapshot
  from public.wechat_refund_event_outbox event_row
  join public.wechat_refund_commands command_row on command_row.id=event_row.command_id
  where event_row.id=p_event_id and event_row.status='processing'
    and event_row.locked_by=trim(p_worker_id)
    and event_row.lease_token=p_lease_token and event_row.lease_expires_at>now();
  if not found then return 'lease_lost'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('payment-order:'||command_snapshot.order_id,0)
  );
  select * into strict order_row from public.orders
  where id=command_snapshot.order_id for update;
  select * into strict payment from public.payments
  where id=command_snapshot.payment_id and order_id=order_row.id for update;
  perform 1 from public.wechat_payment_attempts payment_attempt
  where payment_attempt.id=command_snapshot.payment_attempt_id
    and payment_attempt.order_id=order_row.id for update;
  select * into strict after_sale from public.after_sales
  where id=command_snapshot.after_sale_id and order_id=order_row.id for update;
  select * into strict refund from public.refunds
  where id=command_snapshot.refund_id and order_id=order_row.id for update;
  select * into strict command from public.wechat_refund_commands
  where id=command_snapshot.id for update;
  if command.order_id<>command_snapshot.order_id
     or command.payment_id<>command_snapshot.payment_id
     or command.payment_attempt_id<>command_snapshot.payment_attempt_id
     or command.after_sale_id<>command_snapshot.after_sale_id
     or command.refund_id<>command_snapshot.refund_id
  then raise exception 'WECHAT_REFUND_EVENT_EVIDENCE_MISMATCH'; end if;
  select * into event from public.wechat_refund_event_outbox
  where id=p_event_id and status='processing' and locked_by=trim(p_worker_id)
    and lease_token=p_lease_token and lease_expires_at>now() for update;
  if not found then return 'lease_lost'; end if;
  if event.tenant_id<>command.tenant_id or event.aggregate_id<>command.refund_id
     or event.payload_json->>'commandId'<>command.id::text
     or event.payload_json->>'refundId'<>command.refund_id
     or event.payload_json->>'afterSaleId'<>command.after_sale_id
     or event.payload_json->>'orderId'<>command.order_id
     or event.payload_json->>'paymentId'<>command.payment_id
     or event.payload_json->>'outRefundNo'<>command.out_refund_no
     or (event.payload_json->>'amountCents')::bigint<>command.amount_cents
     or event.payload_json->>'currency'<>'CNY'
     or refund.payment_id<>payment.id or refund.order_id<>order_row.id
     or after_sale.order_id<>order_row.id or command.tenant_id<>order_row.tenant_id
     or command.mall_id<>order_row.mall_id or payment.channel<>'wechat'
     or not exists(select 1 from public.finance_journals journal
       where journal.payment_id=payment.id and journal.payment_intent_id is null
         and journal.journal_type='payment_capture' and journal.status='posted'
         and journal.order_id=order_row.id and journal.amount_cents=payment.amount_cents)
  then raise exception 'WECHAT_REFUND_EVENT_EVIDENCE_MISMATCH'; end if;
  event_payload_digest:=encode(digest(jsonb_build_object(
    'eventId',event.id,'eventKey',event.event_key,'tenantId',event.tenant_id,
    'aggregateType',event.aggregate_type,'aggregateId',event.aggregate_id,
    'aggregateVersion',event.aggregate_version,'eventType',event.event_type,
    'eventVersion',event.event_version,'occurredAt',event.created_at,
    'payload',event.payload_json
  )::text,'sha256'),'hex');
  insert into public.wechat_refund_event_inbox(outbox_id,event_key,payload_digest,consumer)
  values(event.id,event.event_key,event_payload_digest,trim(p_worker_id)) on conflict do nothing;
  if not exists(select 1 from public.wechat_refund_event_inbox inbox
    where inbox.outbox_id=event.id and inbox.event_key=event.event_key
      and inbox.payload_digest=event_payload_digest)
  then raise exception 'WECHAT_REFUND_EVENT_INBOX_MISMATCH'; end if;

  if event.event_type='RefundSucceeded' then
    if command.status not in ('provider_succeeded','succeeded')
       or command.provider_status<>'SUCCESS' or command.provider_refund_id is null
       or refund.status not in ('processing','succeeded')
       or after_sale.status not in ('approved','completed')
    then raise exception 'WECHAT_REFUND_SUCCESS_STATE_MISMATCH'; end if;
    select coalesce(sum(other.amount_cents),0) into total_payment_refunds
    from public.refunds other where other.payment_id=payment.id and other.status='succeeded'
      and other.id<>refund.id;
    if total_payment_refunds+refund.amount_cents>payment.amount_cents
    then raise exception 'WECHAT_REFUND_PAYMENT_AMOUNT_EXCEEDED'; end if;
    select coalesce(sum(other.amount_cents),0) into total_order_refunds
    from public.refunds other where other.order_id=order_row.id and other.status='succeeded'
      and other.id<>refund.id;
    if total_order_refunds+refund.amount_cents>order_row.paid_cents
    then raise exception 'WECHAT_REFUND_ORDER_AMOUNT_EXCEEDED'; end if;
    update public.refunds set status='succeeded',completed_at=coalesce(completed_at,now())
    where id=refund.id and status='processing';
    update public.payments set status=case
      when total_payment_refunds+refund.amount_cents=amount_cents then 'refunded'
      else status end where id=payment.id;
    update public.after_sales set status='completed',resolved_at=coalesce(resolved_at,now()),
      updated_at=now() where id=after_sale.id;
    update public.orders set status=case
      when total_order_refunds+refund.amount_cents=paid_cents then 'refunded'
      else coalesce(after_sale.order_status_before_request,'paid') end,updated_at=now()
    where id=order_row.id;
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,
      payment_intent_id,refund_id,recipient_kind,recipient_id,channel,template_key,payload_json)
    values(command.tenant_id,command.mall_id,command.order_id,command.payment_id,
      null,refund.id,'user',order_row.user_id,'inapp','refund.succeeded',jsonb_build_object(
        'orderId',command.order_id,'refundId',refund.id,'amountCents',refund.amount_cents,
        'refundStatus','succeeded'))
    on conflict(refund_id,recipient_kind,channel,template_key)
      where refund_id is not null do nothing;
    update public.wechat_refund_commands set status='succeeded',completed_at=coalesce(completed_at,now()),
      updated_at=now() where id=command.id;
  else
    if command.status not in ('provider_closed','closed') or command.provider_status<>'CLOSED'
       or refund.status not in ('processing','failed')
    then raise exception 'WECHAT_REFUND_CLOSED_STATE_MISMATCH'; end if;
    update public.refunds set status='failed',completed_at=coalesce(completed_at,now())
    where id=refund.id and status='processing';
    update public.after_sales set status='closed',resolved_at=coalesce(resolved_at,now()),
      updated_at=now() where id=after_sale.id;
    update public.orders set status=coalesce(after_sale.order_status_before_request,'paid'),
      updated_at=now() where id=order_row.id and status='refund_pending';
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,
      payment_intent_id,refund_id,recipient_kind,recipient_id,channel,template_key,payload_json)
    values(command.tenant_id,command.mall_id,command.order_id,command.payment_id,
      null,refund.id,'operations',command.mall_id,'inapp','refund.closed',jsonb_build_object(
        'orderId',command.order_id,'refundId',refund.id,'amountCents',refund.amount_cents,
        'refundStatus','closed'))
    on conflict(refund_id,recipient_kind,channel,template_key)
      where refund_id is not null do nothing;
    update public.wechat_refund_commands set status='closed',completed_at=coalesce(completed_at,now()),
      updated_at=now() where id=command.id;
  end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,action,
    resource_type,resource_id,request_id,after_json,created_at)
  values(gen_random_uuid()::text,command.tenant_id,order_row.enterprise_id,command.mall_id,
    'system','refund.wechat.'||case when event.event_type='RefundSucceeded' then 'succeeded' else 'closed' end,
    'refund',refund.id,'wechat-refund-event:'||event.id,jsonb_build_object(
      'eventType',event.event_type,'providerStatus',command.provider_status,
      'amountCents',command.amount_cents),now());
  return case when event.event_type='RefundSucceeded' then 'refund_succeeded' else 'refund_closed' end;
end $$;

create function public.api_execute_wechat_refund_event(
  p_event_id uuid,p_worker_id text,p_lease_token uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result text; error_code text; event public.wechat_refund_event_outbox%rowtype;
  next_status text; delay_seconds double precision; target_order_id text;
  target_payment_id text; target_attempt_id uuid; target_after_sale_id text;
  target_refund_id text; target_command_id uuid;
begin
  select command.order_id,command.payment_id,command.payment_attempt_id,
    command.after_sale_id,command.refund_id,command.id
  into target_order_id,target_payment_id,target_attempt_id,
    target_after_sale_id,target_refund_id,target_command_id
  from public.wechat_refund_event_outbox event_row
  join public.wechat_refund_commands command on command.id=event_row.command_id
  where event_row.id=p_event_id and event_row.status='processing'
    and event_row.locked_by=trim(p_worker_id)
    and event_row.lease_token=p_lease_token and event_row.lease_expires_at>now();
  if not found then return jsonb_build_object('accepted',false,'status','lease_lost'); end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||target_order_id,0));
  perform 1 from public.orders where id=target_order_id for update;
  perform 1 from public.payments where id=target_payment_id
    and order_id=target_order_id for update;
  perform 1 from public.wechat_payment_attempts where id=target_attempt_id
    and order_id=target_order_id for update;
  perform 1 from public.after_sales where id=target_after_sale_id
    and order_id=target_order_id for update;
  perform 1 from public.refunds where id=target_refund_id
    and order_id=target_order_id for update;
  perform 1 from public.wechat_refund_commands where id=target_command_id
    and order_id=target_order_id and payment_id=target_payment_id
    and payment_attempt_id=target_attempt_id and after_sale_id=target_after_sale_id
    and refund_id=target_refund_id for update;
  select * into event from public.wechat_refund_event_outbox
  where id=p_event_id and status='processing' and locked_by=trim(p_worker_id)
    and command_id=target_command_id and lease_token=p_lease_token
    and lease_expires_at>now() for update;
  if not found then return jsonb_build_object('accepted',false,'status','lease_lost'); end if;
  begin
    result:=public.process_wechat_refund_event(p_event_id,p_worker_id,p_lease_token);
  exception when others then
    error_code:=left(coalesce(nullif(regexp_replace(upper(sqlerrm),'[^A-Z0-9_.:-]','','g'),''),'WECHAT_REFUND_EVENT_FAILED'),120);
  end;
  if result='lease_lost' then
    return jsonb_build_object('accepted',false,'status','lease_lost');
  end if;
  if error_code is null then next_status:='delivered'; else
    next_status:=case when event.attempts>=12 then 'dead_letter' else 'pending' end;
    delay_seconds:=least(3600.0,5.0*power(2.0,least(event.attempts-1,9)))*(0.8+random()*0.4);
  end if;
  update public.wechat_refund_event_outbox set status=next_status,
    delivered_at=case when next_status='delivered' then now() else null end,
    dead_lettered_at=case when next_status='dead_letter' then now() else null end,
    last_error_code=error_code,
    available_at=case when next_status='pending' then now()+make_interval(secs=>delay_seconds) else available_at end,
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null
  where id=event.id and status='processing' and locked_by=trim(p_worker_id)
    and lease_token=p_lease_token;
  if not found then return jsonb_build_object('accepted',false,'status','lease_lost'); end if;
  if next_status='dead_letter' then
    perform public.alert_wechat_refund_event_deadletter(event.id);
  end if;
  return jsonb_build_object('accepted',true,'status',next_status,
    'resultCode',result,'errorCode',error_code,'attempts',event.attempts);
end $$;

create function public.api_replay_wechat_refund_event_authorized(
  p_event_id uuid,p_actor_membership_id text,p_actor_user_id text,
  p_granted_via jsonb,p_reason text,p_idempotency_key text,
  p_request_hash text,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.wechat_refund_event_outbox%rowtype;
  command public.wechat_refund_commands%rowtype; order_row public.orders%rowtype;
  payment public.payments%rowtype; after_sale public.after_sales%rowtype;
  refund public.refunds%rowtype; target_order_id text; target_tenant_id text;
  target_enterprise_id text; target_mall_id text; target_command_id uuid;
  existing public.idempotency_keys%rowtype; result jsonb;
begin
  if char_length(trim(coalesce(p_reason,''))) not between 4 and 500
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 120
     or char_length(trim(coalesce(p_request_hash,'')))<1
     or char_length(trim(coalesce(p_request_id,''))) not between 1 and 160
  then raise exception 'WECHAT_REFUND_EVENT_REPLAY_INPUT_INVALID'; end if;
  if not public.api_membership_actor_matches(
       p_actor_membership_id,p_actor_user_id,'admin'
     )
     or not public.api_membership_has_permission(
       p_actor_membership_id,'payment.outbox.manage'
     )
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_actor_membership_id,'payment.outbox.manage',true
     )
  then raise exception 'WECHAT_REFUND_EVENT_REPLAY_NOT_AUTHORIZED'; end if;
  select command_row.order_id,command_row.tenant_id,orders.enterprise_id,
    command_row.mall_id,command_row.id
  into target_order_id,target_tenant_id,target_enterprise_id,target_mall_id,
    target_command_id
  from public.wechat_refund_event_outbox event_row
  join public.wechat_refund_commands command_row on command_row.id=event_row.command_id
  join public.orders orders on orders.id=command_row.order_id
  where event_row.id=p_event_id;
  if not found then raise exception 'WECHAT_REFUND_EVENT_NOT_FOUND'; end if;
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',target_tenant_id,
       target_enterprise_id,target_mall_id
     )
     or not public.api_membership_has_permission(
       p_actor_membership_id,'payment.outbox.manage'
     )
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_actor_membership_id,'payment.outbox.manage',true
     )
  then raise exception 'WECHAT_REFUND_EVENT_REPLAY_NOT_AUTHORIZED'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('payment-order:'||target_order_id,0)
  );
  select * into strict order_row from public.orders
  where id=target_order_id for update;
  select payment_row.* into strict payment from public.payments payment_row
  join public.wechat_refund_commands command_row
    on command_row.payment_id=payment_row.id
  where command_row.id=target_command_id and payment_row.order_id=order_row.id
  for update of payment_row;
  perform 1 from public.wechat_payment_attempts payment_attempt
  join public.wechat_refund_commands command_row
    on command_row.payment_attempt_id=payment_attempt.id
  where command_row.id=target_command_id and payment_attempt.order_id=order_row.id
  for update of payment_attempt;
  select after_sale_row.* into strict after_sale from public.after_sales after_sale_row
  join public.wechat_refund_commands command_row
    on command_row.after_sale_id=after_sale_row.id
  where command_row.id=target_command_id and after_sale_row.order_id=order_row.id
  for update of after_sale_row;
  select refund_row.* into strict refund from public.refunds refund_row
  join public.wechat_refund_commands command_row
    on command_row.refund_id=refund_row.id
  where command_row.id=target_command_id and refund_row.order_id=order_row.id
  for update of refund_row;
  select * into strict command from public.wechat_refund_commands
  where id=target_command_id for update;
  select * into strict event from public.wechat_refund_event_outbox
  where id=p_event_id and command_id=command.id for update;
  perform pg_advisory_xact_lock(hashtextextended(
    command.mall_id||':refund:event:replay:'||p_idempotency_key,0
  ));
  select * into existing from public.idempotency_keys
  where mall_id=command.mall_id and scope='refund:event:replay'
    and idempotency_key=p_idempotency_key and expires_at>now();
  if found then
    if existing.tenant_id is distinct from command.tenant_id
       or existing.resource_id is distinct from event.id::text
       or existing.request_hash is distinct from p_request_hash
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return existing.response_json;
  end if;
  if event.status<>'dead_letter'
     or (event.event_type='RefundSucceeded'
       and command.status<>'provider_succeeded')
     or (event.event_type='RefundClosed' and command.status<>'provider_closed')
     or exists(select 1 from public.wechat_refund_event_outbox successor
       where successor.aggregate_id=event.aggregate_id
         and successor.aggregate_version>event.aggregate_version)
  then raise exception 'WECHAT_REFUND_EVENT_REPLAY_STATE_INVALID'; end if;
  update public.wechat_refund_event_outbox set status='pending',attempts=0,
    available_at=now(),locked_by=null,locked_at=null,lease_token=null,
    lease_expires_at=null,last_error_code=null,dead_lettered_at=null
  where id=event.id;
  result:=jsonb_build_object('accepted',true,'status','pending',
    'eventId',event.id,'eventType',event.event_type);
  insert into public.idempotency_keys(
    tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,
    response_json,created_at,expires_at
  ) values(
    command.tenant_id,command.mall_id,'refund:event:replay',p_idempotency_key,
    p_request_hash,event.id::text,result,now(),now()+interval '24 hours'
  );
  insert into public.audit_logs(
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,after_json,membership_id,
    granted_via,created_at
  ) values(
    gen_random_uuid()::text,command.tenant_id,order_row.enterprise_id,
    command.mall_id,p_actor_user_id,'admin','refund.wechat.effect_replayed',
    'refund',command.refund_id,p_request_id,jsonb_build_object(
      'eventId',event.id,'eventType',event.event_type,'reason',trim(p_reason)
    ),p_actor_membership_id,p_granted_via,now()
  );
  return result;
end $$;

revoke all on function public.api_finance_reconciliation(text,text,text)
from public,anon,authenticated,service_role;
drop function public.api_finance_reconciliation(text,text,text);

create or replace function public.api_finance_reconciliation_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_enterprise_id text,p_mall_id text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare report jsonb;
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,
       p_enterprise_id,p_mall_id
     )
     or not public.api_membership_has_permission(
       p_actor_membership_id,'finance.reconcile'
     )
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_actor_membership_id,'finance.reconcile',false
     )
     or not public.api_membership_scope_allows(
       p_actor_membership_id,p_tenant_id,p_enterprise_id,p_mall_id
     )
  then raise exception 'FINANCE_RECONCILIATION_NOT_AUTHORIZED'; end if;
  with checks as(
    select orders.id,orders.order_no,orders.status,orders.payable_cents,
      orders.paid_cents,
      coalesce((select sum(payment.amount_cents) from public.payments payment
        where payment.order_id=orders.id
          and payment.status in ('succeeded','refunded')),0) payment_cents,
      coalesce((select sum(payment.amount_cents) from public.payments payment
        where payment.order_id=orders.id and payment.channel in ('welfare','meal')
          and payment.status in ('succeeded','refunded')),0) internal_payment_cents,
      coalesce((select sum(allocation.amount_cents)
        from public.payment_allocations allocation join public.payments payment
          on payment.id=allocation.payment_id
        where allocation.order_id=orders.id and payment.channel in ('welfare','meal')
          and payment.status in ('succeeded','refunded')),0) allocation_cents,
      coalesce((select sum(ledger.amount_cents) from public.account_ledgers ledger
        where ledger.business_type='order_payment' and ledger.business_id=orders.id
          and ledger.direction='debit'),0) debit_cents,
      coalesce((select sum(refund.amount_cents) from public.refunds refund
        where refund.order_id=orders.id and refund.status='succeeded'),0) refund_cents,
      coalesce((select sum(refund.amount_cents) from public.refunds refund
        join public.payments payment on payment.id=refund.payment_id
        where refund.order_id=orders.id and refund.status='succeeded'
          and payment.channel in ('welfare','meal')),0) internal_refund_cents,
      coalesce((select sum(ledger.amount_cents) from public.account_ledgers ledger
        where ledger.business_type='order_refund' and ledger.business_id=orders.id
          and ledger.direction='credit'),0) credit_cents,
      (select count(*) from public.payments payment
        where payment.order_id=orders.id
          and payment.status in('succeeded','refunded')
          and(payment.channel not in('welfare','meal')
            or payment.payment_intent_id is null))
        +(select count(distinct payment.payment_intent_id)
          from public.payments payment where payment.order_id=orders.id
            and payment.status in('succeeded','refunded')
            and payment.channel in('welfare','meal')
            and payment.payment_intent_id is not null) expected_capture_count,
      (select count(*) from public.finance_journals journal
        where journal.order_id=orders.id
          and journal.journal_type='payment_capture'
          and journal.status='posted') capture_journal_count,
      coalesce((select sum(journal.amount_cents)
        from public.finance_journals journal where journal.order_id=orders.id
          and journal.journal_type='payment_capture'
          and journal.status='posted'),0) capture_journal_cents,
      coalesce((select sum(entry.amount_cents)
        from public.finance_journal_entries entry
        join public.finance_journals journal on journal.id=entry.journal_id
        where journal.order_id=orders.id
          and journal.journal_type='payment_capture'
          and journal.status='posted' and entry.side='debit'),0) capture_debit_cents,
      coalesce((select sum(entry.amount_cents)
        from public.finance_journal_entries entry
        join public.finance_journals journal on journal.id=entry.journal_id
        where journal.order_id=orders.id
          and journal.journal_type='payment_capture'
          and journal.status='posted' and entry.side='credit'),0) capture_credit_cents,
      (exists(select 1 from public.payments payment
        where payment.order_id=orders.id
          and payment.status in('succeeded','refunded')
          and(payment.channel not in('welfare','meal')
            or payment.payment_intent_id is null)
          and((select count(*) from public.finance_journals journal
              where journal.payment_id=payment.id
                and journal.payment_intent_id is null
                and journal.journal_type='payment_capture'
                and journal.status='posted')<>1
            or(select coalesce(sum(journal.amount_cents),0)
              from public.finance_journals journal
              where journal.payment_id=payment.id
                and journal.payment_intent_id is null
                and journal.journal_type='payment_capture'
                and journal.status='posted')<>payment.amount_cents))
        or exists(select 1 from public.payment_intents intent
          where intent.order_id=orders.id and exists(select 1
            from public.payments payment where payment.payment_intent_id=intent.id
              and payment.status in('succeeded','refunded')
              and payment.channel in('welfare','meal'))
            and((select count(*) from public.finance_journals journal
                where journal.payment_intent_id=intent.id
                  and journal.payment_id is null
                  and journal.journal_type='payment_capture'
                  and journal.status='posted')<>1
              or(select coalesce(sum(journal.amount_cents),0)
                from public.finance_journals journal
                where journal.payment_intent_id=intent.id
                  and journal.payment_id is null
                  and journal.journal_type='payment_capture'
                  and journal.status='posted')<>intent.amount_cents)))
        capture_anchor_mismatch,
      coalesce((select sum(journal.amount_cents) from public.finance_journals journal
        where journal.order_id=orders.id and journal.journal_type='payment_refund'
          and journal.status='posted'),0) refund_journal_cents
    from public.orders orders where orders.tenant_id=p_tenant_id
      and orders.enterprise_id=p_enterprise_id and orders.mall_id=p_mall_id
  ),violations as(
    select *,array_remove(array[
      case when paid_cents<>payment_cents then 'PAID_PAYMENT_MISMATCH' end,
      case when allocation_cents<>internal_payment_cents then 'PAYMENT_ALLOCATION_MISMATCH' end,
      case when debit_cents<>internal_payment_cents then 'PAYMENT_LEDGER_MISMATCH' end,
      case when credit_cents<>internal_refund_cents then 'REFUND_LEDGER_MISMATCH' end,
      case when capture_anchor_mismatch or expected_capture_count<>capture_journal_count
          or capture_journal_cents<>payment_cents
        then 'CAPTURE_JOURNAL_MISMATCH' end,
      case when capture_debit_cents<>capture_credit_cents
          or capture_debit_cents<>capture_journal_cents
        then 'CAPTURE_JOURNAL_UNBALANCED' end,
      case when refund_journal_cents<>refund_cents then 'REFUND_JOURNAL_MISMATCH' end,
      case when refund_cents>payment_cents then 'OVER_REFUND' end,
      case when status='refunded' and refund_cents<>paid_cents
        then 'REFUNDED_STATUS_MISMATCH' end
    ],null) issues from checks
  ) select jsonb_build_object(
    'checkedAt',clock_timestamp(),'ordersChecked',(select count(*) from checks),
    'violationCount',(select count(*) from violations where cardinality(issues)>0),
    'violations',coalesce((select jsonb_agg(jsonb_build_object(
      'orderId',id,'orderNo',order_no,'issues',issues,
      'payableCents',payable_cents,'paidCents',paid_cents,
      'paymentCents',payment_cents,'captureJournalCents',capture_journal_cents,
      'refundCents',refund_cents,
      'netCents',payment_cents-refund_cents
    )) from violations where cardinality(issues)>0),'[]'::jsonb)
  ) into report;
  return report;
end
$$;

alter table public.wechat_refund_commands enable row level security;
alter table public.wechat_refund_provider_attempts enable row level security;
alter table public.wechat_refund_notification_inbox enable row level security;
alter table public.wechat_refund_event_outbox enable row level security;
alter table public.wechat_refund_event_inbox enable row level security;
revoke all on table public.wechat_refund_commands,public.wechat_refund_provider_attempts,
  public.wechat_refund_notification_inbox,public.wechat_refund_event_outbox,
  public.wechat_refund_event_inbox from public,anon,authenticated,service_role;
revoke all on function public.queue_wechat_refund_event(uuid,text),
  public.ensure_refund_finance_journal(text),
  public.execute_internal_refund_primitive(text,bigint,text,text),
  public.post_refund_finance_journal(),
  public.alert_wechat_refund_event_deadletter(uuid),
  public.process_wechat_refund_event(uuid,text,uuid),
  public.enforce_notification_identity(),
  public.enforce_wechat_refund_attempt_identity(),
  public.enforce_wechat_refund_event_identity() from public,anon,authenticated,service_role;
revoke all on function public.api_request_refund_authorized(text,text,bigint,text,text,text,text,text,jsonb),
  public.api_claim_wechat_refund_commands(text,integer,integer),
  public.api_record_wechat_refund_result(uuid,uuid,text,uuid,text,text,text,text,text,text,bigint,bigint,text),
  public.api_fail_wechat_refund_attempt(uuid,uuid,text,uuid,text,boolean),
  public.api_apply_wechat_refund_notification(text,text,text,text,text,text,text,text,text,timestamptz,bigint,bigint,bigint,bigint,jsonb,text),
  public.api_claim_wechat_refund_events(text,integer,integer),
  public.api_execute_wechat_refund_event(uuid,text,uuid),
  public.api_replay_wechat_refund_event_authorized(uuid,text,text,jsonb,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.api_finance_reconciliation_authorized(text,text,text,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.api_request_refund_authorized(text,text,bigint,text,text,text,text,text,jsonb),
  public.api_apply_wechat_refund_notification(text,text,text,text,text,text,text,text,text,timestamptz,bigint,bigint,bigint,bigint,jsonb,text)
to service_role;
grant execute on function public.api_claim_wechat_refund_commands(text,integer,integer),
  public.api_record_wechat_refund_result(uuid,uuid,text,uuid,text,text,text,text,text,text,bigint,bigint,text),
  public.api_fail_wechat_refund_attempt(uuid,uuid,text,uuid,text,boolean),
  public.api_claim_wechat_refund_events(text,integer,integer),
  public.api_execute_wechat_refund_event(uuid,text,uuid),
  public.api_replay_wechat_refund_event_authorized(uuid,text,text,jsonb,text,text,text,text)
to service_role;
grant execute on function public.api_finance_reconciliation_authorized(text,text,text,text,text,jsonb)
to service_role;
