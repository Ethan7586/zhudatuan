-- Client-side crash ledger.
--
-- Reports are deduplicated by fingerprint so a render loop increments one row
-- instead of flooding the table. Notification is queued through an outbox in
-- the same transaction, mirroring the WeChat payment outbox, because the API
-- runs on Cloudflare Workers and cannot open an SMTP connection itself.

create table if not exists public.client_error_reports (
  id text primary key,
  fingerprint text not null unique check (fingerprint ~ '^[0-9a-f]{16}$'),
  fault_code text not null unique check (fault_code ~ '^SW-[0-9A-F]{16}$'),
  surface text not null check (surface in ('admin', 'storefront')),
  route text not null check (length(route) between 1 and 200),
  message text not null check (length(message) between 1 and 500),
  stack text check (stack is null or length(stack) <= 8000),
  component_stack text check (component_stack is null or length(component_stack) <= 8000),
  tenant_id text references public.tenants(id),
  enterprise_id text references public.enterprises(id),
  mall_id text references public.malls(id),
  last_membership_id text references public.memberships(id),
  last_request_id text,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  affected_member_count integer not null default 1 check (affected_member_count > 0),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists client_error_reports_open_lookup on public.client_error_reports (status, last_seen_at desc);

-- One row per membership that hit a fingerprint, so "how many people are
-- affected" is a fact rather than a guess derived from the raw hit count.
create table if not exists public.client_error_witnesses (
  fingerprint text not null references public.client_error_reports(fingerprint) on delete cascade,
  membership_id text not null references public.memberships(id),
  first_seen_at timestamptz not null default now(),
  primary key (fingerprint, membership_id)
);

create table if not exists public.client_error_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  fingerprint text not null references public.client_error_reports(fingerprint) on delete cascade,
  reason text not null check (reason in ('first_seen', 'escalated')),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'dead_letter')),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists client_error_outbox_ready on public.client_error_outbox (status, available_at);

alter table public.client_error_reports enable row level security;
alter table public.client_error_witnesses enable row level security;
alter table public.client_error_outbox enable row level security;

/**
 * Records one client crash. Returns the stable fault code the operator can
 * quote when reporting the problem. Notification is queued only when the
 * fingerprint is new, or when it crosses an escalation threshold, so a loop
 * cannot turn into a mailbox flood.
 */
create or replace function public.api_record_client_error(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_membership_id text,
  p_surface text, p_route text, p_message text, p_stack text, p_component_stack text,
  p_request_id text, p_escalate_at integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fingerprint text;
  v_row public.client_error_reports%rowtype;
  v_inserted boolean := false;
  v_reason text;
begin
  if p_surface not in ('admin', 'storefront') then raise exception 'INVALID_CLIENT_ERROR_INPUT'; end if;
  if coalesce(trim(p_message), '') = '' or coalesce(trim(p_route), '') = '' then raise exception 'INVALID_CLIENT_ERROR_INPUT'; end if;

  -- The fingerprint intentionally excludes the request id and timestamps so
  -- repeated hits of the same defect collapse onto one row.
  v_fingerprint := substr(encode(digest(p_surface || '|' || left(trim(p_route), 200) || '|' || left(trim(p_message), 500), 'sha256'), 'hex'), 1, 16);

  insert into public.client_error_reports (
    id, fingerprint, fault_code, surface, route, message, stack, component_stack,
    tenant_id, enterprise_id, mall_id, last_membership_id, last_request_id
  )
  values (
    gen_random_uuid()::text, v_fingerprint, 'SW-' || upper(v_fingerprint), p_surface,
    left(trim(p_route), 200), left(trim(p_message), 500), left(p_stack, 8000), left(p_component_stack, 8000),
    p_tenant_id, p_enterprise_id, p_mall_id, p_membership_id, p_request_id
  )
  on conflict (fingerprint) do nothing;
  v_inserted := found;

  if not v_inserted then
    update public.client_error_reports
       set occurrence_count = occurrence_count + 1,
           last_seen_at = now(),
           last_membership_id = p_membership_id,
           last_request_id = p_request_id,
           status = case when status = 'resolved' then 'open' else status end
     where fingerprint = v_fingerprint;
  end if;

  if p_membership_id is not null then
    insert into public.client_error_witnesses (fingerprint, membership_id)
    values (v_fingerprint, p_membership_id)
    on conflict do nothing;
    if found then
      update public.client_error_reports
         set affected_member_count = (select count(*) from public.client_error_witnesses w where w.fingerprint = v_fingerprint)
       where fingerprint = v_fingerprint;
    end if;
  end if;

  select * into v_row from public.client_error_reports where fingerprint = v_fingerprint;

  v_reason := case
    when v_inserted then 'first_seen'
    when v_row.occurrence_count = greatest(p_escalate_at, 2) then 'escalated'
    else null
  end;

  if v_reason is not null then
    insert into public.client_error_outbox (event_key, fingerprint, reason, payload_json)
    values (
      v_fingerprint || ':' || v_reason, v_fingerprint, v_reason,
      -- The notification carries no stack and no business data. Detail stays
      -- server-side behind the admin permission check.
      jsonb_build_object(
        'faultCode', v_row.fault_code, 'surface', v_row.surface, 'route', v_row.route,
        'message', v_row.message, 'occurrenceCount', v_row.occurrence_count,
        'affectedMemberCount', v_row.affected_member_count, 'firstSeenAt', v_row.first_seen_at
      )
    )
    on conflict (event_key) do nothing;
  end if;

  return jsonb_build_object('faultCode', v_row.fault_code, 'fingerprint', v_fingerprint, 'occurrenceCount', v_row.occurrence_count);
end;
$$;

/** Leases pending notifications for the Node-side sender. */
create or replace function public.api_claim_client_error_outbox(p_worker text, p_limit integer default 10, p_lease_seconds integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_items jsonb;
begin
  with claimed as (
    update public.client_error_outbox o
       set status = 'processing', locked_at = now(), locked_by = left(coalesce(p_worker, 'worker'), 120),
           delivery_attempts = o.delivery_attempts + 1,
           available_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 120), 30))
     where o.id in (
       select id from public.client_error_outbox
        where status in ('pending', 'processing') and available_at <= now()
        order by available_at
        limit least(greatest(coalesce(p_limit, 10), 1), 50)
        for update skip locked
     )
    returning o.id, o.event_key, o.reason, o.payload_json, o.delivery_attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'eventKey', event_key, 'reason', reason, 'payload', payload_json, 'attempts', delivery_attempts)), '[]'::jsonb)
    into v_items from claimed;
  return v_items;
end;
$$;

/** Marks one notification delivered, or retires it to the dead letter queue. */
create or replace function public.api_complete_client_error_outbox(p_id uuid, p_delivered boolean, p_error text default null, p_max_attempts integer default 6)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_delivered then
    update public.client_error_outbox set status = 'delivered', delivered_at = now(), last_error = null, locked_at = null, locked_by = null where id = p_id;
    return;
  end if;
  update public.client_error_outbox
     set status = case when delivery_attempts >= greatest(coalesce(p_max_attempts, 6), 1) then 'dead_letter' else 'pending' end,
         last_error = left(coalesce(p_error, 'unknown'), 500),
         available_at = now() + make_interval(secs => least(600, 30 * delivery_attempts)),
         locked_at = null, locked_by = null
   where id = p_id;
end;
$$;

revoke all on function public.api_record_client_error(text, text, text, text, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.api_claim_client_error_outbox(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_complete_client_error_outbox(uuid, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.api_record_client_error(text, text, text, text, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.api_claim_client_error_outbox(text, integer, integer) to service_role;
grant execute on function public.api_complete_client_error_outbox(uuid, boolean, text, integer) to service_role;
