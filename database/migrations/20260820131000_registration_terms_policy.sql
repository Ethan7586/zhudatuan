-- Registration terms are owned by one database policy row. Application roles
-- may read only the projected version RPC; the registration transaction locks
-- and revalidates the row so an owner update cannot race an accepted consent.

create table if not exists public.registration_terms_policy (
  singleton boolean primary key default true check (singleton),
  terms_version text not null check (
    char_length(terms_version) between 1 and 64
    and terms_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  terms_title text not null check (char_length(terms_title) between 1 and 160),
  terms_body text not null check (char_length(terms_body) between 1 and 10000),
  privacy_title text not null check (char_length(privacy_title) between 1 and 160),
  privacy_body text not null check (char_length(privacy_body) between 1 and 10000),
  updated_at timestamptz not null default now(),
  updated_by text not null default current_user
);

insert into public.registration_terms_policy (
  singleton,terms_version,terms_title,terms_body,privacy_title,privacy_body,
  updated_at,updated_by
) values (
  true,'2026-08-13',
  '智慧翼企业福利商城 - 用户服务协议',
  '本协议适用于智慧翼企业福利商城员工端与运营后台。系统使用短时效认证上下文与一次性票据保护会话；高风险管理操作要求二次验证，连续失败会被限制并记入安全审计。',
  '智慧翼企业福利商城 - 隐私保护政策',
  '我们遵循最小必要原则处理手机号码、企业工号与角色授权信息，仅用于会员身份、福利履约、安全防护与依法审计。',
  now(),current_user
) on conflict (singleton) do nothing;

alter table public.registration_terms_policy enable row level security;
revoke all on table public.registration_terms_policy
from public,anon,authenticated,service_role;

drop function if exists public.api_registration_terms_version();

create or replace function public.api_registration_terms()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'version',policy.terms_version,
    'terms',jsonb_build_object(
      'title',policy.terms_title,
      'body',policy.terms_body
    ),
    'privacy',jsonb_build_object(
      'title',policy.privacy_title,
      'body',policy.privacy_body
    )
  )
  from public.registration_terms_policy policy
  where policy.singleton;
$$;

create or replace function public.api_register_username_member(
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
set search_path=public,pg_temp
as $$
declare
  registration_attempt public.username_registration_attempts%rowtype;
  invitation record;
  current_terms_version text;
  normalized_username text:=lower(trim(coalesce(p_username,'')));
  new_user_id text:='user-registration-'||gen_random_uuid()::text;
  new_member_id text:='member-registration-'||gen_random_uuid()::text;
  new_membership_id text:='membership-registration-'||gen_random_uuid()::text;
  new_employee_no text:='REG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  select policy.terms_version into current_terms_version
  from public.registration_terms_policy policy
  where policy.singleton
  for share;
  if not found then
    return jsonb_build_object('status','terms_policy_unavailable');
  end if;
  if p_terms_version is distinct from current_terms_version then
    return jsonb_build_object('status','terms_version_mismatch');
  end if;
  if normalized_username !~ '^[a-z][a-z0-9._-]{3,31}$'
     or length(coalesce(p_password_hash,'')) not between 40 and 1024
     or length(trim(coalesce(p_display_name,''))) not between 1 and 60
     or length(trim(coalesce(p_request_id,''))) not between 1 and 160
     or length(coalesce(p_ip_hash,'')) not between 10 and 256
  then return jsonb_build_object('status','invalid_input'); end if;

  delete from public.username_registration_attempts
  where updated_at<now()-interval '7 days';
  insert into public.username_registration_attempts (
    ip_hash,attempt_count,window_started_at,blocked_until,updated_at
  ) values (
    p_ip_hash,1,now(),null,now()
  ) on conflict (ip_hash) do update set
    attempt_count=case
      when username_registration_attempts.window_started_at<now()-interval '1 hour' then 1
      else username_registration_attempts.attempt_count+1 end,
    window_started_at=case
      when username_registration_attempts.window_started_at<now()-interval '1 hour' then now()
      else username_registration_attempts.window_started_at end,
    blocked_until=case
      when username_registration_attempts.blocked_until>now() then username_registration_attempts.blocked_until
      when username_registration_attempts.window_started_at>=now()-interval '1 hour'
        and username_registration_attempts.attempt_count+1>10 then now()+interval '1 hour'
      else null end,
    updated_at=now()
  returning * into registration_attempt;
  if registration_attempt.blocked_until>now() then
    return jsonb_build_object('status','rate_limited');
  end if;

  if normalized_username in (
    'admin','administrator','root','system','owner','support',
    'security','smartwing','hbbtzn'
  ) or exists (
    select 1 from public.member_login_aliases
    where provider='test' and lower(subject)=normalized_username
  ) then return jsonb_build_object('status','account_exists'); end if;

  select invite.* into invitation
  from public.membership_registration_invites invite
  join public.roles role on role.id=invite.role_id and role.tenant_id=invite.tenant_id
  join public.enterprises enterprise on enterprise.id=invite.enterprise_id
    and enterprise.tenant_id=invite.tenant_id
  join public.malls mall on mall.id=invite.mall_id
    and mall.tenant_id=invite.tenant_id and mall.enterprise_id=invite.enterprise_id
  left join public.departments department on department.id=invite.department_id
    and department.tenant_id=invite.tenant_id
    and department.enterprise_id=invite.enterprise_id
  where invite.code_hash=p_invite_code_hash
    and invite.status='active' and invite.target='storefront'
    and invite.allowed_phone_subject is null
    and role.code='employee' and not role.is_owner
    and (invite.department_id is null or department.id is not null)
    and invite.starts_at<=now() and invite.expires_at>now()
    and invite.use_count<invite.max_uses
  for update of invite;
  if not found then return jsonb_build_object('status','invalid_invite'); end if;
  if exists (
    select 1 from public.member_login_aliases
    where provider='local_username' and subject=normalized_username
  ) then return jsonb_build_object('status','account_exists'); end if;

  begin
    insert into public.users (
      id,tenant_id,enterprise_id,department_id,employee_no,display_name,
      identity_subject,status
    ) values (
      new_user_id,invitation.tenant_id,invitation.enterprise_id,
      invitation.department_id,new_employee_no,trim(p_display_name),
      'local_username:'||normalized_username,'active'
    );
    insert into public.members (id,user_id,primary_identifier,status)
    values (new_member_id,new_user_id,'local_username:'||normalized_username,'active');
    insert into public.member_login_aliases (provider,subject,member_id)
    values ('local_username',normalized_username,new_member_id);
    insert into public.member_credentials (member_id,password_hash,phone_cipher)
    values (new_member_id,p_password_hash,'{"version":1,"kind":"unbound"}'::jsonb);
    insert into public.memberships (
      id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,target,status
    ) values (
      new_membership_id,new_member_id,new_user_id,invitation.tenant_id,
      invitation.enterprise_id,invitation.mall_id,'storefront','active'
    );
    insert into public.membership_roles (membership_id,role_id)
    values (new_membership_id,invitation.role_id);
    insert into public.membership_scopes (membership_id,scope_kind,resource_id)
    values (new_membership_id,'self',new_user_id);
    insert into public.welfare_accounts (
      id,tenant_id,enterprise_id,mall_id,user_id,account_type,balance_cents
    ) values (
      'account-registration-'||gen_random_uuid()::text,invitation.tenant_id,
      invitation.enterprise_id,invitation.mall_id,new_user_id,'welfare',0
    );
  exception when unique_violation then
    return jsonb_build_object('status','account_exists');
  end;

  update public.membership_registration_invites
  set use_count=use_count+1 where id=invitation.id;
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,ip_hash,user_agent,after_json,
    membership_id,created_at
  ) values (
    gen_random_uuid()::text,invitation.tenant_id,invitation.enterprise_id,
    invitation.mall_id,new_user_id,'user','member.self_registered',
    'membership',new_membership_id,p_request_id,p_ip_hash,
    left(coalesce(p_user_agent,''),300),
    jsonb_build_object(
      'method','username_password','termsVersion',current_terms_version,
      'roleCode','employee','phoneBound',false,'wechatBound',false
    ),new_membership_id,now()
  );
  return jsonb_build_object(
    'status','active','memberId',new_member_id,
    'membershipId',new_membership_id,'employeeNo',new_employee_no,
    'username',normalized_username
  );
end;
$$;

-- Phone OTP registration must use the same locked consent policy as username
-- and WeChat registration. Remove the old signature so no service-role caller
-- can create a membership without an accepted terms version.
revoke all on function public.api_register_storefront_member(
  uuid,text,text,text,jsonb,text,text,text
) from public,anon,authenticated,service_role;
drop function public.api_register_storefront_member(
  uuid,text,text,text,jsonb,text,text,text
);

create function public.api_register_storefront_member(
  p_challenge_id uuid,
  p_phone_subject text,
  p_code_hash text,
  p_phone_masked text,
  p_phone_cipher jsonb,
  p_password_hash text,
  p_display_name text,
  p_invite_code_hash text,
  p_request_id text,
  p_user_agent text,
  p_terms_version text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  challenge public.phone_verification_challenges%rowtype;
  invitation record;
  current_terms_version text;
  new_user_id text:='user-registration-'||gen_random_uuid()::text;
  new_member_id text:='member-registration-'||gen_random_uuid()::text;
  new_membership_id text:='membership-registration-'||gen_random_uuid()::text;
  new_employee_no text:='REG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  select policy.terms_version into current_terms_version
  from public.registration_terms_policy policy
  where policy.singleton
  for share;
  if not found then
    return jsonb_build_object('status','terms_policy_unavailable');
  end if;
  if p_terms_version is distinct from current_terms_version then
    return jsonb_build_object('status','terms_version_mismatch');
  end if;
  if length(trim(coalesce(p_request_id,''))) not between 1 and 160
     or length(trim(coalesce(p_display_name,''))) not between 1 and 60
  then return jsonb_build_object('status','invalid_input'); end if;

  select * into challenge
  from public.phone_verification_challenges verification
  where verification.id=p_challenge_id
    and verification.phone_subject=p_phone_subject
    and verification.purpose='registration'
    and verification.consumed_at is null
    and verification.expires_at>now()
    and verification.attempts<5
  for update;
  if not found then return jsonb_build_object('status','invalid_code'); end if;

  if challenge.code_hash<>p_code_hash then
    update public.phone_verification_challenges verification
    set attempts=least(verification.attempts+1,5)
    where verification.id=p_challenge_id;
    return jsonb_build_object('status','invalid_code');
  end if;

  if exists (
    select 1 from public.member_login_aliases alias
    where alias.provider='local_phone' and alias.subject=p_phone_subject
  ) then
    update public.phone_verification_challenges verification
    set consumed_at=now() where verification.id=p_challenge_id;
    return jsonb_build_object('status','account_exists');
  end if;

  select invite.* into invitation
  from public.membership_registration_invites invite
  join public.roles role
    on role.id=invite.role_id and role.tenant_id=invite.tenant_id
  join public.enterprises enterprise
    on enterprise.id=invite.enterprise_id
    and enterprise.tenant_id=invite.tenant_id
  join public.malls mall
    on mall.id=invite.mall_id and mall.tenant_id=invite.tenant_id
    and mall.enterprise_id=invite.enterprise_id
  left join public.departments department
    on department.id=invite.department_id
    and department.tenant_id=invite.tenant_id
    and department.enterprise_id=invite.enterprise_id
  where invite.code_hash=p_invite_code_hash
    and invite.status='active' and invite.target='storefront'
    and role.code='employee' and not role.is_owner
    and (invite.department_id is null or department.id is not null)
    and invite.starts_at<=now() and invite.expires_at>now()
    and invite.use_count<invite.max_uses
    and (
      invite.allowed_phone_subject is null
      or invite.allowed_phone_subject=p_phone_subject
    )
  for update of invite;
  if not found then
    update public.phone_verification_challenges verification
    set attempts=least(verification.attempts+1,5)
    where verification.id=p_challenge_id;
    return jsonb_build_object('status','invalid_invite');
  end if;

  begin
    insert into public.users (
      id,tenant_id,enterprise_id,department_id,employee_no,display_name,
      mobile_masked,identity_subject,status
    ) values (
      new_user_id,invitation.tenant_id,invitation.enterprise_id,
      invitation.department_id,new_employee_no,trim(p_display_name),
      p_phone_masked,'local_phone:'||p_phone_subject,'active'
    );
    insert into public.members (id,user_id,primary_identifier,status)
    values (
      new_member_id,new_user_id,'local_phone:'||p_phone_subject,'active'
    );
    insert into public.member_login_aliases (provider,subject,member_id)
    values ('local_phone',p_phone_subject,new_member_id);
    insert into public.member_credentials (
      member_id,password_hash,phone_cipher
    ) values (new_member_id,p_password_hash,p_phone_cipher);
    insert into public.memberships (
      id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,
      target,status
    ) values (
      new_membership_id,new_member_id,new_user_id,invitation.tenant_id,
      invitation.enterprise_id,invitation.mall_id,'storefront','active'
    );
    insert into public.membership_roles (membership_id,role_id)
    values (new_membership_id,invitation.role_id);
    insert into public.membership_scopes (
      membership_id,scope_kind,resource_id
    ) values (new_membership_id,'self',new_user_id);
    insert into public.welfare_accounts (
      id,tenant_id,enterprise_id,mall_id,user_id,account_type,balance_cents
    ) values (
      'account-registration-'||gen_random_uuid()::text,
      invitation.tenant_id,invitation.enterprise_id,invitation.mall_id,
      new_user_id,'welfare',0
    );
  exception when unique_violation then
    return jsonb_build_object('status','account_exists');
  end;

  update public.phone_verification_challenges verification
  set consumed_at=now() where verification.id=p_challenge_id;
  update public.membership_registration_invites invite
  set use_count=invite.use_count+1 where invite.id=invitation.id;
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,ip_hash,user_agent,after_json,
    membership_id,created_at
  ) values (
    gen_random_uuid()::text,invitation.tenant_id,invitation.enterprise_id,
    invitation.mall_id,new_user_id,'user','member.self_registered',
    'membership',new_membership_id,p_request_id,challenge.ip_hash,
    left(coalesce(p_user_agent,''),300),
    jsonb_build_object(
      'method','phone_otp','termsVersion',current_terms_version,
      'roleCode','employee','phoneBound',true,'wechatBound',false
    ),new_membership_id,now()
  );
  return jsonb_build_object(
    'status','active','memberId',new_member_id,
    'membershipId',new_membership_id,'employeeNo',new_employee_no
  );
end;
$$;

revoke all on function public.api_registration_terms()
from public,anon,authenticated,service_role;
grant execute on function public.api_registration_terms()
to service_role;
revoke all on function public.api_register_username_member(
  text,text,text,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.api_register_username_member(
  text,text,text,text,text,text,text,text
) to service_role;
revoke all on function public.api_register_storefront_member(
  uuid,text,text,text,jsonb,text,text,text,text,text,text
) from public,anon,authenticated,service_role;
grant execute on function public.api_register_storefront_member(
  uuid,text,text,text,jsonb,text,text,text,text,text,text
) to service_role;
revoke all on function public.api_register_and_bind_wechat_member(
  uuid,text,text,text,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.api_register_and_bind_wechat_member(
  uuid,text,text,text,text,text,text,text,text
) to service_role;

notify pgrst,'reload schema';
