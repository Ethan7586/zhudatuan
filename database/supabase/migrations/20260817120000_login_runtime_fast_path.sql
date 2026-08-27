-- Bundle the trusted membership projection with each credential entrance.
-- The application verifies the password locally before using this data and
-- validates the returned membership again before it can create a session.
-- This removes one cross-region RPC from successful browser and mini-program
-- logins without weakening the login limit, password hash, or session checks.

create or replace function public.api_local_login_candidate(
  p_provider text, p_subject text, p_target text default null
) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'memberId', member.id,
    'membershipId', selected.id,
    'target', selected.target,
    'passwordHash', credential.password_hash,
    'mustResetPassword', credential.must_reset_password,
    'entrances', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'target', entrance.target,
          'membershipId', entrance.id,
          'runtime', public.api_resolve_membership_context(member.id, entrance.id, entrance.target)
        )
        order by case when entrance.target = 'storefront' then 0 else 1 end, entrance.created_at, entrance.id
      )
      from public.memberships entrance
      where entrance.member_id = member.id
        and entrance.status = 'active'
        and (entrance.expires_at is null or entrance.expires_at > now())
    ), '[]'::jsonb)
  )
  from public.member_login_aliases alias
  join public.members member on member.id = alias.member_id and member.status = 'active'
  join public.member_credentials credential on credential.member_id = member.id
  cross join lateral (
    select membership.id, membership.target
    from public.memberships membership
    where membership.member_id = member.id
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
      and (p_target is null or membership.target = p_target)
    order by case when membership.target = 'storefront' then 0 else 1 end, membership.created_at, membership.id
    limit 1
  ) selected
  where alias.provider = p_provider and alias.subject = p_subject;
$$;

revoke all on function public.api_local_login_candidate(text, text, text) from public, anon, authenticated;
grant execute on function public.api_local_login_candidate(text, text, text) to service_role;
