-- Raise the shared login-failure threshold from five to ten attempts while
-- retaining the existing 15-minute window and 15-minute lock duration.
-- This applies at the server boundary, not only in the browser UI.

create or replace function public.api_record_login_failure(p_ip_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_blocked_until timestamptz;
begin
  insert into public.login_attempts (
    ip_hash, failed_attempts, window_started_at, blocked_until, updated_at
  ) values (
    p_ip_hash, 1, v_now, null, v_now
  )
  on conflict (ip_hash) do update
  set
    failed_attempts = case
      when public.login_attempts.window_started_at < v_now - interval '15 minutes'
        then 1
      else public.login_attempts.failed_attempts + 1
    end,
    window_started_at = case
      when public.login_attempts.window_started_at < v_now - interval '15 minutes'
        then v_now
      else public.login_attempts.window_started_at
    end,
    blocked_until = case
      when (
        case
          when public.login_attempts.window_started_at < v_now - interval '15 minutes'
            then 1
          else public.login_attempts.failed_attempts + 1
        end
      ) >= 10 then v_now + interval '15 minutes'
      else public.login_attempts.blocked_until
    end,
    updated_at = v_now
  returning blocked_until into v_blocked_until;
  return v_blocked_until;
end;
$$;

revoke all on function public.api_record_login_failure(text) from public, anon, authenticated;
grant execute on function public.api_record_login_failure(text) to service_role;
