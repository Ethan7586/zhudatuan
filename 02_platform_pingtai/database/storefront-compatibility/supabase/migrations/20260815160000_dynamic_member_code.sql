-- Dynamic member-code challenge. The code carries only an opaque credential;
-- the database stores only its SHA-256 hash. A credential is scoped, short
-- lived, revocable and consumed atomically by an authorized verifier.

insert into public.permissions(id,code,name,category,risk_level,is_mvp) values
  ('permission-member-code-verify-mvp','member_code.verify','核验会员码','会员码','high',true)
on conflict(code) do update set
  name=excluded.name,category=excluded.category,risk_level=excluded.risk_level,is_mvp=excluded.is_mvp;

insert into public.role_permissions(role_id,permission_id)
select role.id,permission.id
from public.roles role
join public.permissions permission on permission.code='member_code.verify'
where role.code in ('platform_owner','mall_admin','enterprise_manager','test_admin','test_operations')
on conflict do nothing;

create table if not exists public.member_code_challenges (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null unique,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  member_id text not null references public.members(id) on delete restrict,
  user_id text not null references public.users(id) on delete restrict,
  membership_id text not null references public.memberships(id) on delete restrict,
  authz_version integer not null check(authz_version>0),
  status text not null default 'active' check(status in ('active','consumed','revoked','expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_membership_id text references public.memberships(id) on delete restrict,
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists member_code_challenges_membership_active
on public.member_code_challenges(membership_id,status,expires_at desc);

create index if not exists member_code_challenges_scope_active
on public.member_code_challenges(tenant_id,enterprise_id,mall_id,status,expires_at desc);

create index if not exists member_code_challenges_retention
on public.member_code_challenges(issued_at);

alter table public.member_code_challenges enable row level security;
revoke all on table public.member_code_challenges from public,anon,authenticated;
grant select,insert,update,delete on table public.member_code_challenges to service_role;

create or replace function public.api_issue_member_code_challenge(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_user_id text,
  p_membership_id text,p_authz_version integer,p_credential_hash text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  source_membership public.memberships%rowtype;
  challenge public.member_code_challenges%rowtype;
begin
  if p_credential_hash is null or length(p_credential_hash)<32 then
    return jsonb_build_object('issued',false,'code','INVALID_CREDENTIAL');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('member-code:'||p_membership_id,0));
  select * into source_membership from public.memberships membership
  where membership.id=p_membership_id
    and membership.tenant_id=p_tenant_id
    and membership.enterprise_id=p_enterprise_id
    and membership.mall_id=p_mall_id
    and membership.context_user_id=p_user_id
    and membership.target='storefront'
    and membership.status='active'
    and membership.authz_version=p_authz_version
    and (membership.expires_at is null or membership.expires_at>now());
  if not found then return jsonb_build_object('issued',false,'code','MEMBERSHIP_INACTIVE'); end if;
  if not exists(select 1 from public.members member join public.users user_record on user_record.id=member.user_id
    where member.id=source_membership.member_id and member.status='active' and user_record.id=p_user_id and user_record.status='active') then
    return jsonb_build_object('issued',false,'code','MEMBER_INACTIVE');
  end if;
  if not public.api_member_phone_verified(p_membership_id,p_user_id) then
    return jsonb_build_object('issued',false,'code','PHONE_VERIFICATION_REQUIRED');
  end if;
  if (select count(*) from public.member_code_challenges existing
      where existing.membership_id=p_membership_id and existing.issued_at>now()-interval '1 minute')>=10 then
    return jsonb_build_object('issued',false,'code','RATE_LIMITED');
  end if;
  update public.member_code_challenges existing set
    status='revoked',revoked_at=now(),revoked_reason='refreshed'
  where existing.membership_id=p_membership_id and existing.status='active';
  insert into public.member_code_challenges(
    credential_hash,tenant_id,enterprise_id,mall_id,member_id,user_id,membership_id,authz_version,expires_at
  ) values(
    p_credential_hash,p_tenant_id,p_enterprise_id,p_mall_id,source_membership.member_id,
    p_user_id,p_membership_id,p_authz_version,now()+interval '45 seconds'
  ) returning * into challenge;
  delete from public.member_code_challenges where issued_at<now()-interval '7 days';
  return jsonb_build_object(
    'issued',true,'challengeId',challenge.id,'issuedAt',challenge.issued_at,
    'expiresAt',challenge.expires_at,'validSeconds',45
  );
end;
$$;

create or replace function public.api_revoke_member_code_challenge(
  p_membership_id text,p_user_id text,p_challenge_id uuid
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.member_code_challenges challenge set
    status='revoked',revoked_at=now(),revoked_reason='member_action'
  where challenge.id=p_challenge_id and challenge.membership_id=p_membership_id
    and challenge.user_id=p_user_id and challenge.status='active';
  return found;
end;
$$;

create or replace function public.api_verify_member_code_challenge(
  p_actor_membership_id text,p_actor_user_id text,p_credential_hash text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  challenge public.member_code_challenges%rowtype;
  source_membership public.memberships%rowtype;
  actor public.memberships%rowtype;
begin
  select * into challenge from public.member_code_challenges item
  where item.credential_hash=p_credential_hash for update;
  if not found then return jsonb_build_object('verified',false,'code','MEMBER_CODE_INVALID'); end if;
  if challenge.status<>'active' then
    return jsonb_build_object('verified',false,'code',case when challenge.status='consumed' then 'MEMBER_CODE_CONSUMED' else 'MEMBER_CODE_INACTIVE' end);
  end if;
  if challenge.expires_at<=now() then
    update public.member_code_challenges set status='expired' where id=challenge.id;
    return jsonb_build_object('verified',false,'code','MEMBER_CODE_EXPIRED');
  end if;
  select * into source_membership from public.memberships membership
  where membership.id=challenge.membership_id and membership.member_id=challenge.member_id
    and membership.context_user_id=challenge.user_id and membership.target='storefront'
    and membership.status='active' and membership.authz_version=challenge.authz_version
    and (membership.expires_at is null or membership.expires_at>now());
  if not found or not exists(select 1 from public.members member join public.users user_record on user_record.id=member.user_id
      where member.id=challenge.member_id and member.status='active' and user_record.id=challenge.user_id and user_record.status='active')
      or not public.api_member_phone_verified(challenge.membership_id,challenge.user_id) then
    update public.member_code_challenges set status='revoked',revoked_at=now(),revoked_reason='authorization_changed' where id=challenge.id;
    return jsonb_build_object('verified',false,'code','MEMBER_CODE_AUTHORIZATION_CHANGED');
  end if;
  select * into actor from public.memberships membership
  where membership.id=p_actor_membership_id and membership.context_user_id=p_actor_user_id
    and membership.target='admin' and membership.status='active'
    and membership.tenant_id=challenge.tenant_id and membership.enterprise_id=challenge.enterprise_id
    and membership.mall_id=challenge.mall_id
    and (membership.expires_at is null or membership.expires_at>now());
  if not found then return jsonb_build_object('verified',false,'code','MEMBER_CODE_SCOPE_MISMATCH'); end if;
  update public.member_code_challenges set
    status='consumed',consumed_at=now(),consumed_by_membership_id=p_actor_membership_id
  where id=challenge.id and status='active'
  returning * into challenge;
  if not found then return jsonb_build_object('verified',false,'code','MEMBER_CODE_CONSUMED'); end if;
  return jsonb_build_object(
    'verified',true,'challengeId',challenge.id,'memberId',challenge.member_id,
    'membershipId',challenge.membership_id,'consumedAt',challenge.consumed_at
  );
end;
$$;

revoke all on function public.api_issue_member_code_challenge(text,text,text,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.api_revoke_member_code_challenge(text,text,uuid) from public,anon,authenticated;
revoke all on function public.api_verify_member_code_challenge(text,text,text) from public,anon,authenticated;
grant execute on function public.api_issue_member_code_challenge(text,text,text,text,text,integer,text) to service_role;
grant execute on function public.api_revoke_member_code_challenge(text,text,uuid) to service_role;
grant execute on function public.api_verify_member_code_challenge(text,text,text) to service_role;
