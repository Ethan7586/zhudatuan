begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:business-runtime-role-matrix:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'BUSINESS_RUNTIME_ROLE_MATRIX_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260830103000'
      and checksum='9d701527bc303309ed5536594aceddfb286fc59ec9bbf1d0b249075b5d7f99ae') then
    raise exception 'BUSINESS_RUNTIME_ROLE_MATRIX_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260830103000') then
    raise exception 'BUSINESS_RUNTIME_ROLE_MATRIX_FUTURE_HEAD_INVALID';
  end if;
  if (select count(*) from pg_roles where rolname in('zhudatuanwebapi','zhudatuanpurchaseapi'))<>2 then
    raise exception 'BUSINESS_RUNTIME_ROLE_MATRIX_ROLE_MISSING';
  end if;
end
$precondition$;

-- Return only the profile projection required by member.profile.read and the
-- membership identifiers required by address/cart operations.  The caller
-- must prove the live session pair again; no identity or Access authority row
-- is exposed to the invoker.
create or replace function access.web_member_context(p_membership text,p_session text)
returns table(
  id text,
  display_name text,
  status text,
  mobile_bound boolean,
  membership_id text,
  organization_id text,
  employee_no text,
  joined_at timestamptz,
  access_version bigint
)
language plpgsql stable security definer
set search_path=identity,access,member,pg_temp
set row_security=off as $function$
begin
  if session_user<>'zhudatuanwebapi'
    or p_membership is distinct from nullif(current_setting('app.membership_id',true),'') then
    raise exception 'WEB_MEMBER_CONTEXT_INVALID';
  end if;
  return query
  select profile.id,profile.display_name,profile.status,profile.mobile_token is not null,
    membership.id,membership.organization_id,membership.employee_no,membership.joined_at,membership.access_version
  from identity.session session
  join identity.principal principal on principal.id=session.principal_id and principal.status='active'
  join access.membership membership on membership.id=session.membership_id
    and membership.client=session.client and membership.status='active'
    and membership.access_version=session.access_version
  join member.profile profile on profile.id=membership.member_id
    and profile.principal_id=principal.id and profile.status='active'
  where session.id=p_session and session.membership_id=p_membership
    and session.principal_id=nullif(current_setting('app.actor_id',true),'')
    and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version;
  if not found then raise exception 'WEB_MEMBER_CONTEXT_INVALID'; end if;
end
$function$;

-- Risk evaluation needs only the active membership's organization ancestors.
-- It receives IDs, never an authority row, and cannot be called by SET ROLE
-- from a different database login.
create or replace function access.business_membership_ancestor_scopes(p_membership text)
returns table(id text)
language plpgsql stable security definer
set search_path=access,member,organization,pg_temp
set row_security=off as $function$
begin
  if session_user not in('zhudatuanwebapi','zhudatuanpurchaseapi')
    or p_membership is distinct from nullif(current_setting('app.membership_id',true),'') then
    raise exception 'BUSINESS_MEMBERSHIP_SCOPE_INVALID';
  end if;
  return query
  select closure.ancestor_id
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
    and profile.principal_id=nullif(current_setting('app.actor_id',true),'') and profile.status='active'
  join organization.unitclosure closure on closure.descendant_id=membership.organization_id
  where membership.id=p_membership and membership.status='active'
    and (session_user='zhudatuanwebapi' or membership.client='storefront')
  order by closure.depth desc,closure.ancestor_id;
  if not found then raise exception 'BUSINESS_MEMBERSHIP_SCOPE_INVALID'; end if;
end
$function$;

revoke all on function access.web_member_context(text,text),access.business_membership_ancestor_scopes(text)
  from public,anon,authenticated,service_role,shopapp,shopjob,shopread,zhudatuanidentityapi,
    zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
grant execute on function access.web_member_context(text,text) to zhudatuanwebapi;
grant execute on function access.business_membership_ancestor_scopes(text) to zhudatuanwebapi,zhudatuanpurchaseapi;

-- The application now reaches these authority records only through the narrow
-- functions above and the existing canonical resolvers.
revoke all on identity.principal,identity.credential,identity.session,identity.assurance,
  identity.challenge,identity.challengesecret,access.membership,access.membershiprole,
  access.scopegrant,access.membershipoverride,member.profile
  from zhudatuanwebapi,zhudatuanpurchaseapi;
revoke usage on schema member from zhudatuanwebapi,zhudatuanpurchaseapi;
revoke execute on function access.web_member_allowed(text) from zhudatuanwebapi;

drop policy if exists zhudatuanwebapi on access.membership;
drop policy if exists zhudatuanpurchaseapi on access.membership;
drop policy if exists zhudatuanwebapi on member.profile;
drop policy if exists zhudatuanpurchaseapi on member.profile;

insert into runtime.schemaversion(version,checksum)
values('20260830104000','4b693e1cf34f5a1d59355942b5893f8075b302e53bfe41aba9c9564017bb2b0c');

do $assert$
declare target_role text; target_table text; target_privilege text;
begin
  if exists(select 1 from pg_roles where rolname in('zhudatuanwebapi','zhudatuanpurchaseapi')
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
    or exists(select 1 from pg_auth_members membership
      where membership.roleid in(select oid from pg_roles where rolname in('zhudatuanwebapi','zhudatuanpurchaseapi'))
        or membership.member in(select oid from pg_roles where rolname in('zhudatuanwebapi','zhudatuanpurchaseapi'))) then
    raise exception 'BUSINESS_RUNTIME_ROLE_ATTRIBUTES_INVALID';
  end if;
  foreach target_role in array array['zhudatuanwebapi','zhudatuanpurchaseapi'] loop
    foreach target_table in array array[
      'identity.principal','identity.credential','identity.session','identity.assurance',
      'identity.challenge','identity.challengesecret','access.membership','access.membershiprole',
      'access.scopegrant','access.membershipoverride','member.profile'
    ] loop
      foreach target_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(target_role,target_table,target_privilege) then
          raise exception 'BUSINESS_RUNTIME_AUTHORITY_PRIVILEGE_INVALID:%:%:%',target_role,target_table,target_privilege;
        end if;
      end loop;
    end loop;
    if has_schema_privilege(target_role,'member','USAGE') then
      raise exception 'BUSINESS_RUNTIME_MEMBER_SCHEMA_INVALID:%',target_role;
    end if;
  end loop;
  if not has_function_privilege('zhudatuanwebapi','access.web_member_context(text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.business_membership_ancestor_scopes(text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.business_membership_ancestor_scopes(text)','EXECUTE')
    or has_function_privilege('zhudatuanpurchaseapi','access.web_member_context(text,text)','EXECUTE')
    or has_function_privilege('public','access.web_member_context(text,text)','EXECUTE')
    or has_function_privilege('public','access.business_membership_ancestor_scopes(text)','EXECUTE') then
    raise exception 'BUSINESS_RUNTIME_NARROW_FUNCTION_INVALID';
  end if;
  if exists(select 1 from pg_policies where schemaname in('access','member')
    and tablename in('membership','profile') and policyname in('zhudatuanwebapi','zhudatuanpurchaseapi')) then
    raise exception 'BUSINESS_RUNTIME_AUTHORITY_POLICY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260830104000') then
    raise exception 'BUSINESS_RUNTIME_ROLE_MATRIX_MARKER_MISSING';
  end if;
end
$assert$;

commit;
