-- Payment outbox delivery is at-least-once. A lease token prevents a stale
-- worker from acknowledging work after another worker has reclaimed it. The
-- consumer-side inbox and effect fan-out are committed together; downstream
-- channels remain pending until their own workers deliver them.

insert into public.permissions (id, code, name, category, risk_level, is_mvp)
values
  ('permission-payment-outbox-read-v1', 'payment.outbox.read', '查看支付死信', '支付', 'high', true),
  ('permission-payment-outbox-manage-v1', 'payment.outbox.manage', '处置支付死信', '支付', 'critical', true)
on conflict (code) do update
set name = excluded.name, category = excluded.category,
    risk_level = excluded.risk_level, is_mvp = excluded.is_mvp;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where role.id = 'role-platform-owner-v2'
  and permission.code in ('payment.outbox.read', 'payment.outbox.manage')
on conflict do nothing;

alter table public.wechat_payment_outbox
  add column tenant_id text references public.tenants(id) on delete restrict,
  add column aggregate_type text not null default 'order',
  add column aggregate_id text,
  add column aggregate_version bigint,
  add column event_type text,
  add column event_version integer not null default 1,
  add column headers_json jsonb not null default '{}'::jsonb,
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column dead_lettered_at timestamptz,
  add column replay_count integer not null default 0,
  add column last_replayed_at timestamptz,
  add column ignored_at timestamptz;

with ranked as (
  select outbox.id, orders.tenant_id,
         row_number() over (partition by outbox.order_id order by outbox.created_at, outbox.id) as version
  from public.wechat_payment_outbox outbox
  join public.orders orders on orders.id = outbox.order_id
)
update public.wechat_payment_outbox outbox
set tenant_id = ranked.tenant_id,
    aggregate_id = outbox.order_id,
    aggregate_version = ranked.version,
    event_type = outbox.topic,
    headers_json = jsonb_build_object('correlationId', outbox.event_key,
      'occurredAt', outbox.created_at, 'schemaVersion', 1)
from ranked where ranked.id = outbox.id;

update public.wechat_payment_outbox
set status = 'pending', locked_at = null, locked_by = null
where status = 'processing';

update public.wechat_payment_outbox
set dead_lettered_at = coalesce(dead_lettered_at, updated_at, created_at)
where status = 'dead_letter' and dead_lettered_at is null;

alter table public.wechat_payment_outbox
  drop constraint wechat_payment_outbox_status_check,
  add constraint wechat_payment_outbox_status_check
    check (status in ('pending','processing','delivered','dead_letter','ignored')),
  alter column tenant_id set not null,
  alter column aggregate_id set not null,
  alter column aggregate_version set not null,
  alter column event_type set not null,
  add constraint wechat_payment_outbox_headers_object
    check (jsonb_typeof(headers_json) = 'object' and octet_length(headers_json::text) <= 4096),
  add constraint wechat_payment_outbox_payload_bounded
    check (jsonb_typeof(payload_json) = 'object' and octet_length(payload_json::text) <= 65536),
  add constraint wechat_payment_outbox_lease_consistent check (
    (status = 'processing' and locked_at is not null and locked_by is not null
      and lease_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and locked_at is null and locked_by is null
      and lease_token is null and lease_expires_at is null)
  );

create unique index wechat_payment_outbox_aggregate_version
on public.wechat_payment_outbox (aggregate_id, aggregate_version);

create or replace function public.prepare_wechat_payment_outbox_envelope()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare resolved_tenant_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.order_id, 0));
  select orders.tenant_id into strict resolved_tenant_id
  from public.orders orders where orders.id = new.order_id;
  new.tenant_id := resolved_tenant_id;
  new.aggregate_type := 'order';
  new.aggregate_id := new.order_id;
  select coalesce(max(outbox.aggregate_version), 0) + 1 into new.aggregate_version
  from public.wechat_payment_outbox outbox where outbox.aggregate_id = new.order_id;
  new.event_type := new.topic;
  new.event_version := 1;
  new.headers_json := coalesce(new.headers_json, '{}'::jsonb)
    || jsonb_build_object('correlationId', new.event_key,
      'occurredAt', new.created_at, 'schemaVersion', 1);
  return new;
end;
$$;

create trigger wechat_payment_outbox_prepare_envelope
before insert on public.wechat_payment_outbox
for each row execute function public.prepare_wechat_payment_outbox_envelope();

create or replace function public.enforce_wechat_payment_outbox_envelope_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if row(new.event_key,new.topic,new.tenant_id,new.aggregate_type,new.aggregate_id,
      new.aggregate_version,new.event_type,new.event_version,new.headers_json,
      new.order_id,new.payment_id,new.attempt_id,new.payload_json,new.created_at)
     is distinct from
     row(old.event_key,old.topic,old.tenant_id,old.aggregate_type,old.aggregate_id,
      old.aggregate_version,old.event_type,old.event_version,old.headers_json,
      old.order_id,old.payment_id,old.attempt_id,old.payload_json,old.created_at)
  then raise exception 'PAYMENT_OUTBOX_ENVELOPE_IMMUTABLE'; end if;
  return new;
end;
$$;

create trigger wechat_payment_outbox_envelope_immutable
before update on public.wechat_payment_outbox
for each row execute function public.enforce_wechat_payment_outbox_envelope_immutable();

create table public.payment_event_inbox (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null unique references public.wechat_payment_outbox(id) on delete restrict,
  event_key text not null unique,
  tenant_id text not null references public.tenants(id) on delete restrict,
  aggregate_id text not null,
  aggregate_version bigint not null,
  event_type text not null,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  consumer text not null check (length(consumer) between 1 and 120),
  consumed_at timestamptz not null default now()
);

create table public.payment_event_effects (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.payment_event_inbox(id) on delete restrict,
  outbox_id uuid not null references public.wechat_payment_outbox(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  payment_id text not null references public.payments(id) on delete restrict,
  effect_type text not null check (effect_type in ('accounting','fulfillment','notification')),
  status text not null default 'pending'
    check (status in ('pending','processing','delivered','dead_letter','ignored')),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  locked_by text,
  locked_at timestamptz,
  last_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outbox_id, effect_type)
);

create index payment_event_effects_ready
on public.payment_event_effects (status, available_at, created_at);
create trigger payment_event_inbox_immutable
before update or delete on public.payment_event_inbox
for each row execute function public.reject_immutable_change();
alter table public.payment_event_inbox enable row level security;
alter table public.payment_event_effects enable row level security;
revoke all on table public.payment_event_inbox, public.payment_event_effects
from public, anon, authenticated;

create table public.payment_deadletter_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wechat_payment_outbox(id) on delete restrict,
  decision text not null check (decision in ('replay', 'ignore')),
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  actor_member_id text not null references public.members(id) on delete restrict,
  actor_membership_id text not null references public.memberships(id) on delete restrict,
  actor_user_id text not null references public.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 4 and 500),
  evidence_digest text not null check (evidence_digest ~ '^[0-9a-f]{64}$'),
  request_id text not null check (char_length(request_id) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (request_id)
);

create index payment_deadletter_reviews_event
on public.payment_deadletter_reviews (event_id, decision, created_at);
create unique index payment_deadletter_ignore_one_vote_per_member
on public.payment_deadletter_reviews (event_id, actor_member_id)
where decision = 'ignore';
create trigger payment_deadletter_reviews_immutable
before update or delete on public.payment_deadletter_reviews
for each row execute function public.reject_immutable_change();
alter table public.payment_deadletter_reviews enable row level security;
revoke all on table public.payment_deadletter_reviews
from public, anon, authenticated, service_role;

drop function public.api_claim_wechat_payment_outbox(text, integer);
drop function public.api_complete_wechat_payment_outbox(uuid, text, boolean, text);

drop function if exists public.api_payment_outbox_deadletters(text, integer);
drop function if exists public.api_replay_wechat_payment_deadletter(uuid, text, text, text);
drop function if exists public.api_ignore_wechat_payment_deadletter(uuid, text, text, text);

create function public.internal_authorize_payment_deadletter_actor(
  p_actor_membership_id text, p_actor_user_id text, p_tenant_id text,
  p_enterprise_id text, p_mall_id text, p_permission_code text,
  p_granted_via jsonb, p_require_step_up boolean
) returns text language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare v_actor_member_id text;
begin
  if p_permission_code not in ('payment.outbox.read', 'payment.outbox.manage')
     or p_require_step_up is distinct from (p_permission_code = 'payment.outbox.manage')
     or length(trim(coalesce(p_actor_membership_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_actor_user_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_tenant_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_enterprise_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_mall_id, ''))) not between 1 and 300
  then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  if not public.api_lock_membership_actor(
    p_actor_membership_id, p_actor_user_id, 'admin', p_tenant_id,
    p_enterprise_id, p_mall_id
  ) then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  if not public.api_membership_has_permission(
    p_actor_membership_id, p_permission_code
  ) then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  if not public.api_authorization_evidence_matches(
    p_granted_via, p_actor_membership_id, p_permission_code, p_require_step_up
  ) then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  select membership.member_id into strict v_actor_member_id
  from public.memberships membership
  where membership.id = p_actor_membership_id
    and membership.context_user_id = p_actor_user_id;
  return v_actor_member_id;
end;
$$;

revoke all on function public.prepare_wechat_payment_outbox_envelope() from public, anon, authenticated;
revoke all on function public.enforce_wechat_payment_outbox_envelope_immutable() from public, anon, authenticated, service_role;
revoke all on function public.internal_authorize_payment_deadletter_actor(text,text,text,text,text,text,jsonb,boolean)
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
