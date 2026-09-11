begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:create-sfl-multi-realm-membership:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'SFL_MULTI_REALM_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260912020000'
        and checksum='389ff2a1a97ebb792c544fe47f825586f70282542b928158ec59bd6b4114a922')
    or exists(select 1 from runtime.schemaversion where version>'20260912020000') then
    raise exception 'SFL_MULTI_REALM_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create function identity.realm_contains_account_realm(p_entry_realm_id text,p_account_realm_id text)
returns boolean
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select exists(
    select 1
    from identity.realm entry_realm
    join identity.realm account_realm on account_realm.id=p_account_realm_id and account_realm.status='active'
    where entry_realm.id=p_entry_realm_id and entry_realm.status='active'
      and (
        account_realm.id=entry_realm.id
        or exists(
          select 1 from organization.membernoderegistration registration
          where registration.realm_id=account_realm.id
            and registration.registration_host_node_id=entry_realm.node_id
        )
      )
  )
$function$;

create function identity.project_member_realm_targets()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
begin
  insert into identity.realmtarget(
    realm_id,surface,target,membership_client,membership_organization_id,application_slug,
    return_origin,created_at,node_profile
  )
  select new.realm_id,target.surface,target.target,target.membership_client,target.membership_organization_id,
    target.application_slug,target.return_origin,clock_timestamp(),'consumer'
  from identity.realm entry_realm
  join identity.realmtarget target on target.realm_id=entry_realm.id and target.surface='consumer'
  where entry_realm.node_id=new.registration_host_node_id
  on conflict(realm_id,target) do nothing;
  return new;
end
$function$;

create trigger identity_project_member_realm_targets
after insert on organization.membernoderegistration
for each row execute function identity.project_member_realm_targets();

insert into identity.realmtarget(
  realm_id,surface,target,membership_client,membership_organization_id,application_slug,
  return_origin,created_at,node_profile
)
select registration.realm_id,target.surface,target.target,target.membership_client,target.membership_organization_id,
  target.application_slug,target.return_origin,clock_timestamp(),'consumer'
from organization.membernoderegistration registration
join identity.realm entry_realm on entry_realm.node_id=registration.registration_host_node_id
join identity.realmtarget target on target.realm_id=entry_realm.id and target.surface='consumer'
on conflict(realm_id,target) do nothing;

create function identity.resolve_active_membership_context(
  p_entry_realm_id text,p_account_id text,p_membership_id text
)
returns table(
  entry_realm_id text,current_realm_id text,account_id text,active_membership_id text,
  line_id text,node_id text,parent_node_id text,signed_level text,sovereignty_tier text,
  node_profile text,mall_id text,host_sovereign_node_id text,relation_version integer,
  effective_at text,access_version bigint,status text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select p_entry_realm_id,account.realm_id,account.id,membership.id,
    node.line_id,node.id,relation.parent_node_id,relation.signed_level,node.sovereignty_tier,
    node.node_profile,node.mall_id,relation.host_sovereign_node_id,relation.relation_version::integer,
    to_char(relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    membership.access_version,node.status
  from identity.account account
  join access.membership membership on membership.account_id=account.id and membership.realm_id=account.realm_id
  join organization.node node on node.realm_id=account.realm_id
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  where account.id=p_account_id and membership.id=p_membership_id
    and account.status='active' and membership.status='active' and node.status='active'
    and identity.realm_contains_account_realm(p_entry_realm_id,account.realm_id)
$function$;

drop function identity.resolve_session(text,text);
create function identity.resolve_session(p_token_hash text,p_entry_host text)
returns table(
  actor_id text,account_id text,realm_id text,session_id text,membership_id text,
  credential_version bigint,access_version bigint,target text,assurance_level smallint,
  assurance_verified_at timestamptz,entry_realm_id text,line_id text,node_id text,
  parent_node_id text,signed_level text,node_profile text,mall_id text,
  host_sovereign_node_id text,relation_version integer
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select account.legacy_principal_id,account.id,account.realm_id,session.id,session.membership_id,
    session.credential_version,session.access_version,
    case target.membership_client when 'operator' then 'console' else target.membership_client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null
      then stepup.verified_at else null end,
    active.entry_realm_id,active.line_id,active.node_id,active.parent_node_id,active.signed_level,
    active.node_profile,active.mall_id,active.host_sovereign_node_id,active.relation_version
  from identity.session session
  join identity.account account on account.id=session.account_id and account.realm_id=session.realm_id
  join access.membership membership on membership.id=session.membership_id
    and membership.account_id=account.id and membership.realm_id=account.realm_id
  join identity.realmtarget target on target.realm_id=session.realm_id and target.target=session.auth_target
    and target.membership_client=membership.client and target.membership_organization_id=membership.organization_id
  join identity.realmentry entry on entry.host=p_entry_host and entry.status='active'
  cross join lateral identity.resolve_active_membership_context(entry.realm_id,account.id,membership.id) active
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.account_id=account.id and evidence.realm_id=account.realm_id
      and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1) phone on true
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.account_id=account.id and evidence.realm_id=account.realm_id and evidence.level>=3
      and evidence.evidence_hash=encode(public.digest(session.id::text,'sha256'),'hex')
      and evidence.verified_at>=clock_timestamp()-interval '15 minutes'
      and evidence.verified_at<=clock_timestamp()
      and evidence.expires_at is not null and evidence.expires_at>clock_timestamp()
    order by evidence.level desc,evidence.verified_at desc limit 1) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=account.credential_version and account.status='active'
    and account.legacy_principal_id=session.principal_id and membership.status='active'
    and session.access_version=membership.access_version and session.client=membership.client
$function$;

revoke all on function identity.realm_contains_account_realm(text,text) from public;
revoke all on function identity.project_member_realm_targets() from public;
revoke all on function identity.resolve_active_membership_context(text,text,text) from public;
revoke all on function identity.resolve_session(text,text) from public;
grant execute on function identity.realm_contains_account_realm(text,text),
  identity.resolve_active_membership_context(text,text,text)
  to shopapp,zhudatuanidentityapi,shopconsole,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;
grant execute on function identity.resolve_session(text,text)
  to shopapp,zhudatuanidentityapi,shopconsole,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;

insert into runtime.schemaversion(version,checksum)
values('20260912030000','697017d7e4f14820baa7be131b8f894fd62c9389795ad4d2989ae2560810f0a0');

do $assert$
begin
  if to_regprocedure('identity.realm_contains_account_realm(text,text)') is null
    or to_regprocedure('identity.resolve_active_membership_context(text,text,text)') is null
    or to_regprocedure('identity.resolve_session(text,text)') is null
    or to_regprocedure('identity.project_member_realm_targets()') is null
    or has_function_privilege('public','identity.realm_contains_account_realm(text,text)','execute')
    or has_function_privilege('public','identity.resolve_active_membership_context(text,text,text)','execute')
    or exists(
      select 1 from organization.membernoderegistration registration
      where not exists(select 1 from identity.realmtarget target
        where target.realm_id=registration.realm_id and target.surface='consumer')
    )
    or not exists(select 1 from runtime.schemaversion where version='20260912030000'
      and checksum='697017d7e4f14820baa7be131b8f894fd62c9389795ad4d2989ae2560810f0a0') then
    raise exception 'SFL_MULTI_REALM_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
