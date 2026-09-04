drop function if exists public.api_clear_login_failures(text);

create function public.api_clear_login_failures(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.login_attempts where ip_hash = p_ip_hash;
  return true;
end;
$$;

revoke all on function public.api_clear_login_failures(text) from public, anon, authenticated;
grant execute on function public.api_clear_login_failures(text) to service_role;
