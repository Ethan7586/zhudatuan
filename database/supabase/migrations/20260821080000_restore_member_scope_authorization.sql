begin;

-- Store management added partner scopes in 20260821069000, but its replacement
-- of access.scope_allowed accidentally removed the member-to-organization path.
-- Keep both rules: operators can traverse their authorized organization/partner
-- subtree, while member operations can reach their own member and mall scopes.
create or replace function access.scope_allowed(p_scope text)
returns boolean language sql stable security definer
set search_path=access,organization,partner,pg_temp as $function$
  select p_scope is not null and (
    p_scope=nullif(current_setting('app.scope_id',true),'') or
    exists(select 1 from organization.unitclosure closure
      where closure.ancestor_id=nullif(current_setting('app.scope_id',true),'') and closure.descendant_id=p_scope) or
    exists(select 1 from partner.partner subject
      where subject.id=nullif(current_setting('app.scope_id',true),'') and (
        subject.scope_id=p_scope or exists(select 1 from organization.unitclosure closure
          where closure.ancestor_id=subject.scope_id and closure.descendant_id=p_scope))) or
    exists(select 1 from access.membership membership
      where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active' and (
        p_scope=membership.member_id or p_scope=membership.organization_id or
        exists(select 1 from organization.unitclosure closure
          where closure.ancestor_id=membership.organization_id and closure.descendant_id=p_scope)
      ))
  )
$function$;

revoke all on function access.scope_allowed(text) from public;
grant execute on function access.scope_allowed(text) to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260821080000','28ff87e82e946dbc3cedd03d5d5f98e2e6904893c6d794323e236d05c079fd9c');

do $assert$
declare
  selected_membership text;
  selected_member text;
  selected_organization text;
begin
  select id,member_id,organization_id
  into selected_membership,selected_member,selected_organization
  from access.membership
  where status='active'
  order by id
  limit 1;

  if selected_membership is null then
    raise exception 'ACTIVE_MEMBERSHIP_SCOPE_FIXTURE_MISSING';
  end if;

  perform set_config('app.scope_id',selected_member,true);
  perform set_config('app.membership_id',selected_membership,true);
  if not access.scope_allowed(selected_member) or not access.scope_allowed(selected_organization) then
    raise exception 'MEMBER_SCOPE_AUTHORIZATION_NOT_RESTORED';
  end if;
  if access.scope_allowed('scope:unrelated') then
    raise exception 'UNRELATED_SCOPE_AUTHORIZATION_ALLOWED';
  end if;
end
$assert$;

commit;
