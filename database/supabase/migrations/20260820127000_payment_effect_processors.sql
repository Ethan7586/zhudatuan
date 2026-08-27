-- Payment effects are durable local facts. External fulfillment and message
-- delivery are deliberately separate: workers only queue those requests.
alter table public.payment_event_effects rename column delivered_at to completed_at;
update public.payment_event_effects set status='succeeded' where status='delivered';
alter table public.payment_event_effects
  drop constraint payment_event_effects_status_check,
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column dead_lettered_at timestamptz,
  add column result_code text,
  add constraint payment_event_effects_status_check
    check(status in ('pending','processing','succeeded','dead_letter','ignored')),
  add constraint payment_event_effects_payload_bounded
    check(octet_length(payload_json::text)<=16384),
  add constraint payment_event_effects_lease_consistent check(
    (status='processing' and locked_by is not null and locked_at is not null
      and lease_token is not null and lease_expires_at is not null)
    or (status<>'processing' and locked_by is null and locked_at is null
      and lease_token is null and lease_expires_at is null));

create table public.finance_journals(
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  order_id text not null references public.orders(id),
  payment_id text not null references public.payments(id),
  source_effect_id uuid not null unique references public.payment_event_effects(id),
  journal_type text not null check(journal_type='payment_capture'),
  business_reference text not null,
  currency text not null check(currency='CNY'),
  amount_cents bigint not null check(amount_cents>0),
  status text not null check(status='posted'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,journal_type,business_reference)
);
create table public.finance_journal_entries(
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.finance_journals(id),
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  order_id text not null references public.orders(id),
  payment_id text not null references public.payments(id),
  account_code text not null check(char_length(account_code) between 3 and 120),
  side text not null check(side in ('debit','credit')),
  amount_cents bigint not null check(amount_cents>0),
  subject_type text not null check(subject_type='order'),
  subject_id text not null,
  created_at timestamptz not null default now(),
  unique(journal_id,account_code,side)
);
create table public.fulfillment_orders(
  id uuid primary key default gen_random_uuid(), tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id), order_id text not null references public.orders(id),
  sub_order_id text not null references public.sub_orders(id), supplier_id text not null references public.suppliers(id),
  payment_id text not null references public.payments(id), source_effect_id uuid not null references public.payment_event_effects(id),
  status text not null default 'queued' check(status in ('queued','submitting','submitted','accepted','shipping','delivered','failed','manual_review')),
  amount_cents bigint not null check(amount_cents>=0), idempotency_key text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id,sub_order_id), unique(source_effect_id,sub_order_id), unique(tenant_id,idempotency_key)
);
create table public.fulfillment_order_items(
  id uuid primary key default gen_random_uuid(), fulfillment_order_id uuid not null references public.fulfillment_orders(id),
  order_item_id text not null references public.order_items(id), sku_id text not null references public.skus(id),
  quantity integer not null check(quantity>0), created_at timestamptz not null default now(),
  unique(fulfillment_order_id,order_item_id), unique(order_item_id)
);
create table public.notification_dispatches(
  id uuid primary key default gen_random_uuid(), tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id), order_id text not null references public.orders(id),
  payment_id text not null references public.payments(id), source_effect_id uuid not null references public.payment_event_effects(id),
  recipient_kind text not null check(recipient_kind in ('user','operations')), recipient_id text not null,
  channel text not null check(channel in ('inapp','wechat')), template_key text not null,
  payload_json jsonb not null check(jsonb_typeof(payload_json)='object' and octet_length(payload_json::text)<=4096),
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','dead_letter')),
  attempts integer not null default 0 check(attempts>=0), available_at timestamptz not null default now(),
  provider_reference text, sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(source_effect_id,recipient_kind,channel)
);

create trigger finance_journals_immutable before update or delete
on public.finance_journals for each row execute function public.reject_immutable_change();
create trigger finance_entries_immutable before update or delete
on public.finance_journal_entries for each row execute function public.reject_immutable_change();
create trigger fulfillment_items_immutable before update or delete
on public.fulfillment_order_items for each row execute function public.reject_immutable_change();
create function public.assert_payment_journal_balanced()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare target_journal_id uuid; debit bigint; credit bigint; entry_count integer;
begin
  if tg_table_name='finance_journals' then target_journal_id:=new.id;
  else target_journal_id:=new.journal_id; end if;
  select count(*),coalesce(sum(amount_cents) filter(where side='debit'),0),
    coalesce(sum(amount_cents) filter(where side='credit'),0)
  into entry_count,debit,credit from public.finance_journal_entries
  where finance_journal_entries.journal_id=target_journal_id;
  if entry_count<2 or debit<>credit
  then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  return null;
end $$;
create constraint trigger finance_journal_balance after insert
on public.finance_journals deferrable initially deferred
for each row execute function public.assert_payment_journal_balanced();
create constraint trigger finance_entry_balance after insert
on public.finance_journal_entries deferrable initially deferred
for each row execute function public.assert_payment_journal_balanced();

alter table public.finance_journals enable row level security;
alter table public.finance_journal_entries enable row level security;
alter table public.fulfillment_orders enable row level security;
alter table public.fulfillment_order_items enable row level security;
alter table public.notification_dispatches enable row level security;
revoke all on table public.finance_journals,public.finance_journal_entries,
  public.fulfillment_orders,public.fulfillment_order_items,
  public.notification_dispatches,public.payment_event_effects
from public,anon,authenticated,service_role;
revoke all on function public.assert_payment_journal_balanced()
from public,anon,authenticated,service_role;
