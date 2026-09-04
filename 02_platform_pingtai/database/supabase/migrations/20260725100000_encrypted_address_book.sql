-- Persistent address book. Recipient PII is encrypted by the Worker before it
-- reaches this table; database rows only keep opaque ciphertext JSON.
create table if not exists public.delivery_addresses (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  recipient_cipher jsonb not null,
  tag text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists delivery_addresses_one_default
  on public.delivery_addresses (mall_id, user_id) where is_default;
create index if not exists delivery_addresses_owner on public.delivery_addresses (tenant_id, enterprise_id, mall_id, user_id, updated_at desc);
alter table public.delivery_addresses enable row level security;

create or replace function public.api_delivery_addresses(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns table(id text, recipient_cipher jsonb, tag text, is_default boolean, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select id, recipient_cipher, tag, is_default, updated_at from public.delivery_addresses
  where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = p_user_id
  order by is_default desc, updated_at desc;
$$;

create or replace function public.api_upsert_delivery_address(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text, p_address_id text,
  p_recipient_cipher jsonb, p_tag text, p_is_default boolean, p_request_id text
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id text := coalesce(nullif(p_address_id, ''), gen_random_uuid()::text); v_now timestamptz := clock_timestamp();
begin
  if jsonb_typeof(p_recipient_cipher) <> 'object' then raise exception 'INVALID_ADDRESS_INPUT'; end if;
  if p_is_default then update public.delivery_addresses set is_default = false, updated_at = v_now
    where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = p_user_id; end if;
  insert into public.delivery_addresses (id, tenant_id, enterprise_id, mall_id, user_id, recipient_cipher, tag, is_default, created_at, updated_at)
    values (v_id, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_recipient_cipher, nullif(p_tag, ''), p_is_default, v_now, v_now)
    on conflict (id) do update set recipient_cipher = excluded.recipient_cipher, tag = excluded.tag, is_default = excluded.is_default, updated_at = excluded.updated_at
      where delivery_addresses.tenant_id = p_tenant_id and delivery_addresses.enterprise_id = p_enterprise_id and delivery_addresses.mall_id = p_mall_id and delivery_addresses.user_id = p_user_id;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user', 'address.upserted', 'delivery_address', v_id, p_request_id, v_now);
  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.api_delivery_addresses(text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_upsert_delivery_address(text,text,text,text,text,jsonb,text,boolean,text) from public, anon, authenticated;
grant execute on function public.api_delivery_addresses(text,text,text,text) to service_role;
grant execute on function public.api_upsert_delivery_address(text,text,text,text,text,jsonb,text,boolean,text) to service_role;
