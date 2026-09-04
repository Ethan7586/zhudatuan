-- Avoid a PL/pgSQL record name colliding with memberships.target during the
-- mandatory first-password change. Existing installations receive the same
-- corrected function body through this forward-only migration.
create or replace function public.api_initial_change_local_password(
  p_member_id text,p_password_hash text,p_request_id text,p_user_agent text
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_member public.members%rowtype; storefront_membership public.memberships%rowtype; changed integer;
begin
  if length(p_password_hash) not between 40 and 1024 then return false; end if;
  select * into target_member from public.members where id=p_member_id and status='active';
  if not found then return false; end if;
  update public.member_credentials set password_hash=p_password_hash,password_changed_at=now(),
    must_reset_password=false,credential_version=credential_version+1,updated_at=now()
  where member_id=p_member_id and must_reset_password=true;
  get diagnostics changed=row_count;
  if changed<>1 then return false; end if;
  update public.auth_sessions set revoked_at=coalesce(revoked_at,now()),revoked_reason=coalesce(revoked_reason,'initial_password_changed')
  where member_id=p_member_id and revoked_at is null;
  select ms.* into storefront_membership from public.memberships ms
  where ms.member_id=p_member_id and ms.target='storefront' order by ms.created_at limit 1;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id)
  values(gen_random_uuid()::text,storefront_membership.tenant_id,storefront_membership.enterprise_id,storefront_membership.mall_id,target_member.user_id,'user','member.initial_password.changed','member',p_member_id,
    p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('otherSessionsRevoked',true),storefront_membership.id);
  return true;
end;
$$;

revoke all on function public.api_initial_change_local_password(text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_initial_change_local_password(text,text,text,text) to service_role;
