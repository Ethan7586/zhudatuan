-- Complete production SMS delivery bookkeeping and atomic WeChat registration.
-- An OpenID proves possession of one WeChat identity, never enterprise
-- membership. The invitation remains the authority for creating an employee.

alter table public.phone_verification_challenges
  add column if not exists delivery_status text not null default 'sent',
  add column if not exists provider_message_id text,
  add column if not exists delivery_error_code text;

alter table public.phone_verification_challenges
  drop constraint if exists phone_verification_challenges_delivery_status_check;
alter table public.phone_verification_challenges
  add constraint phone_verification_challenges_delivery_status_check
  check (delivery_status in ('pending','sent','failed'));

create or replace function public.api_record_phone_challenge_delivery(
  p_challenge_id uuid,
  p_succeeded boolean,
  p_provider_message_id text,
  p_error_code text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.phone_verification_challenges set
    delivery_status = case when p_succeeded then 'sent' else 'failed' end,
    provider_message_id = case when p_succeeded then left(nullif(trim(p_provider_message_id),''),160) else null end,
    delivery_error_code = case when p_succeeded then null else left(coalesce(nullif(trim(p_error_code),''),'delivery_failed'),120) end,
    consumed_at = case when p_succeeded then consumed_at else coalesce(consumed_at,now()) end,
    code_hash = case when p_succeeded then code_hash else encode(digest(gen_random_uuid()::text,'sha256'),'base64') end
  where id = p_challenge_id and delivery_status = 'pending' and consumed_at is null;
  return found;
end;
$$;

create or replace function public.api_create_registration_challenge(
  p_challenge_id uuid,
  p_phone_subject text,
  p_phone_masked text,
  p_code_hash text,
  p_ip_hash text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.phone_verification_challenges where created_at < now()-interval '7 days';
  if p_expires_at<=now() or p_expires_at>now()+interval '10 minutes' then return false; end if;
  if (select count(*) from public.phone_verification_challenges
      where phone_subject=p_phone_subject and delivery_status<>'failed'
        and created_at>now()-interval '15 minutes')>=5 then return false; end if;
  if (select count(*) from public.phone_verification_challenges
      where ip_hash=p_ip_hash and delivery_status<>'failed'
        and created_at>now()-interval '1 hour')>=20 then return false; end if;
  insert into public.phone_verification_challenges(
    id,phone_subject,phone_masked,purpose,code_hash,ip_hash,expires_at,delivery_status
  ) values(
    p_challenge_id,p_phone_subject,p_phone_masked,'registration',p_code_hash,p_ip_hash,p_expires_at,'pending'
  );
  return true;
end;
$$;

create or replace function public.api_create_security_challenge(
  p_challenge_id uuid,p_phone_subject text,p_phone_masked text,p_purpose text,
  p_code_hash text,p_ip_hash text,p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_purpose not in ('password_reset','phone_change') then return false; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '10 minutes' then return false; end if;
  if (select count(*) from public.phone_verification_challenges
      where phone_subject=p_phone_subject and delivery_status<>'failed'
        and created_at>now()-interval '15 minutes')>=5 then return false; end if;
  if (select count(*) from public.phone_verification_challenges
      where ip_hash=p_ip_hash and delivery_status<>'failed'
        and created_at>now()-interval '1 hour')>=20 then return false; end if;
  insert into public.phone_verification_challenges(
    id,phone_subject,phone_masked,purpose,code_hash,ip_hash,expires_at,delivery_status
  ) values(
    p_challenge_id,p_phone_subject,p_phone_masked,p_purpose,p_code_hash,p_ip_hash,p_expires_at,'pending'
  );
  return true;
end;
$$;

create or replace function public.api_register_and_bind_wechat_member(
  p_challenge_id uuid,
  p_username text,
  p_password_hash text,
  p_display_name text,
  p_invite_code_hash text,
  p_ip_hash text,
  p_request_id text,
  p_user_agent text,
  p_terms_version text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  registration jsonb;
  bound boolean;
begin
  begin
    registration := public.api_register_username_member(
      p_username,p_password_hash,p_display_name,p_invite_code_hash,p_ip_hash,
      p_request_id,p_user_agent,p_terms_version
    );
    if registration->>'status' <> 'active' then return registration; end if;
    bound := public.api_bind_wechat_identity(
      p_challenge_id,registration->>'memberId',registration->>'membershipId',
      p_request_id,p_user_agent
    );
    if not bound then raise exception 'WECHAT_BIND_ROLLBACK'; end if;
    return registration || jsonb_build_object('wechatBound',true);
  exception when raise_exception then
    if sqlerrm='WECHAT_BIND_ROLLBACK' then
      return jsonb_build_object('status','binding_expired');
    end if;
    raise;
  end;
end;
$$;

revoke all on function public.api_record_phone_challenge_delivery(uuid,boolean,text,text)
from public,anon,authenticated;
revoke all on function public.api_register_and_bind_wechat_member(uuid,text,text,text,text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.api_record_phone_challenge_delivery(uuid,boolean,text,text)
to service_role;
grant execute on function public.api_register_and_bind_wechat_member(uuid,text,text,text,text,text,text,text,text)
to service_role;

notify pgrst, 'reload schema';
