create or replace function public.api_delete_delivery_address(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text, p_address_id text, p_request_id text
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_deleted integer;
begin
  if p_address_id is null or btrim(p_address_id) = '' then
    raise exception 'INVALID_ADDRESS_ID';
  end if;
  delete from public.delivery_addresses da
  where da.id = p_address_id and da.tenant_id = p_tenant_id and da.enterprise_id = p_enterprise_id and da.mall_id = p_mall_id and da.user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 1 then
    insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, created_at)
      values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user', 'address.deleted', 'delivery_address', p_address_id, p_request_id, clock_timestamp());
  end if;
  return v_deleted = 1;
end;
$$;

revoke all on function public.api_delete_delivery_address(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.api_delete_delivery_address(text,text,text,text,text,text) to service_role;
