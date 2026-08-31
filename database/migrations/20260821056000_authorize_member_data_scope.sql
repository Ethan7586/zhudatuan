begin;

create or replace function access.scope_allowed(p_scope text)
returns boolean language sql stable security definer set search_path=access,organization,pg_temp as $function$
  select p_scope is not null and (
    p_scope=nullif(current_setting('app.scope_id',true),'') or
    exists(select 1 from organization.unitclosure closure
      where closure.ancestor_id=nullif(current_setting('app.scope_id',true),'') and closure.descendant_id=p_scope) or
    exists(select 1 from access.membership membership
      where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active' and (
        p_scope=membership.member_id or p_scope=membership.organization_id or
        exists(select 1 from organization.unitclosure closure
          where closure.ancestor_id=membership.organization_id and closure.descendant_id=p_scope)
      ))
  )
$function$;

comment on function access.scope_allowed(text) is
  'Allows the authorized resource scope plus the active membership owner and its organization subtree; never an ancestor or sibling scope.';

insert into runtime.schemaversion(version,checksum)
values('20260821056000','258b8458ed2f4c198516f75ef00b74caf2ca67aa87c466b0548b881cc6f2a573');

do $assert$ begin
  if to_regprocedure('access.scope_allowed(text)') is null then raise exception 'MEMBER_DATA_SCOPE_RESOLVER_MISSING'; end if;
  if to_regclass('access.membership') is null then raise exception 'ACCESS_MEMBERSHIP_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821056000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
