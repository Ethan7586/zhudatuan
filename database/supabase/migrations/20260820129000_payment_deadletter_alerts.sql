-- Deadletters are durable critical operations alerts, never log-only facts.
create table public.payment_operations_alerts(
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  order_id text not null references public.orders(id),
  resource_type text not null
    check(resource_type in('payment_effect','payment_query')),
  resource_id text not null,
  severity text not null check(severity='critical'),
  status text not null check(status in('open','resolved')),
  error_code text not null,
  details_json jsonb not null check(jsonb_typeof(details_json)='object'
    and octet_length(details_json::text)<=2048),
  occurrence_count integer not null default 1 check(occurrence_count>0),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_request_id text,
  updated_at timestamptz not null default now(),
  unique(resource_type,resource_id),
  check((status='open' and resolved_at is null
      and resolution_request_id is null)
    or(status='resolved' and resolved_at is not null
      and resolution_request_id is not null))
);

create table public.payment_recovery_requests(
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  resource_type text not null
    check(resource_type in('payment_effect','payment_query')),
  resource_id text not null,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  actor_member_id text not null references public.members(id),
  actor_membership_id text not null references public.memberships(id),
  actor_user_id text not null references public.users(id),
  reason text not null check(char_length(reason) between 4 and 500),
  evidence_digest text not null check(evidence_digest~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create function public.persist_payment_deadletter_alert()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare resource_kind text; resource text; order_ref text; code text; details jsonb;
  dead boolean;
begin
  if tg_table_name='payment_event_effects' then
    dead:=new.status='dead_letter' and old.status is distinct from 'dead_letter';
    resource_kind:='payment_effect';resource:=new.id::text;order_ref:=new.order_id;
    code:=coalesce(new.last_error_code,'PAYMENT_EFFECT_FAILED');
    details:=jsonb_build_object('effectType',new.effect_type,
      'attempts',new.attempts);
  else
    dead:=new.query_dead_lettered_at is not null
      and old.query_dead_lettered_at is null;
    resource_kind:='payment_query';resource:=new.id::text;order_ref:=new.order_id;
    code:=coalesce(new.query_last_error_code,'PAYMENT_QUERY_FAILED');
    details:=jsonb_build_object('operation',new.query_operation,
      'attempts',new.query_attempts);
  end if;
  if not dead then return new; end if;
  insert into public.payment_operations_alerts(
    tenant_id,enterprise_id,mall_id,order_id,resource_type,resource_id,
    severity,status,error_code,details_json)
  select orders.tenant_id,orders.enterprise_id,orders.mall_id,orders.id,
    resource_kind,resource,'critical','open',code,details
  from public.orders orders where orders.id=order_ref
  on conflict(resource_type,resource_id) do update set
    status='open',error_code=excluded.error_code,
    details_json=excluded.details_json,
    occurrence_count=payment_operations_alerts.occurrence_count+1,
    opened_at=now(),resolved_at=null,resolution_request_id=null,
    updated_at=now();
  return new;
end $$;

create trigger payment_effect_deadletter_alert after update
on public.payment_event_effects for each row
execute function public.persist_payment_deadletter_alert();
create trigger payment_query_deadletter_alert after update
on public.wechat_payment_attempts for each row
execute function public.persist_payment_deadletter_alert();

insert into public.payment_operations_alerts(
  tenant_id,enterprise_id,mall_id,order_id,resource_type,resource_id,
  severity,status,error_code,details_json,opened_at)
select effect.tenant_id,orders.enterprise_id,orders.mall_id,effect.order_id,
  'payment_effect',effect.id::text,'critical','open',
  coalesce(effect.last_error_code,'PAYMENT_EFFECT_FAILED'),
  jsonb_build_object('effectType',effect.effect_type,
    'attempts',effect.attempts),coalesce(effect.dead_lettered_at,now())
from public.payment_event_effects effect join public.orders orders
  on orders.id=effect.order_id where effect.status='dead_letter'
on conflict(resource_type,resource_id) do nothing;

insert into public.payment_operations_alerts(
  tenant_id,enterprise_id,mall_id,order_id,resource_type,resource_id,
  severity,status,error_code,details_json,opened_at)
select orders.tenant_id,orders.enterprise_id,orders.mall_id,attempt.order_id,
  'payment_query',attempt.id::text,'critical','open',
  coalesce(attempt.query_last_error_code,'PAYMENT_QUERY_FAILED'),
  jsonb_build_object('operation',attempt.query_operation,
    'attempts',attempt.query_attempts),attempt.query_dead_lettered_at
from public.wechat_payment_attempts attempt join public.orders orders
  on orders.id=attempt.order_id
where attempt.query_dead_lettered_at is not null
on conflict(resource_type,resource_id) do nothing;

alter table public.payment_operations_alerts enable row level security;
alter table public.payment_recovery_requests enable row level security;
create trigger payment_recovery_requests_immutable before update or delete
on public.payment_recovery_requests for each row
execute function public.reject_immutable_change();
revoke all on table public.payment_operations_alerts,
  public.payment_recovery_requests from public,anon,authenticated,service_role;
revoke all on function public.persist_payment_deadletter_alert()
from public,anon,authenticated,service_role;
