begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:honor-invitation-scope-hint:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'INVITATION_SCOPE_HINT_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260905011000'
        and checksum='dc927a85fe33c2141e6584c41a557fad546a8114785afa6e3bf80a064381f617')
    or exists(select 1 from runtime.schemaversion where version>'20260905011000') then
    raise exception 'INVITATION_SCOPE_HINT_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create or replace function access.resolve_scope(
  p_membership_id text,
  p_operation text,
  p_resource text,
  p_scope_hint text
)
returns table(scope jsonb)
language sql
stable
security definer
set search_path=access,invoice,pg_temp
as $function$
  with resolved(scope) as (
    select case
      when p_operation='access.roles.manage' then
        case when exists(select 1 from access.role role where role.id=p_resource)
          then (select access.scope_object(role.scope_id) from access.role role where role.id=p_resource)
          when p_scope_hint is not null then access.scope_object(p_scope_hint)
          else null end
      when p_operation='access.scopes.manage' then
        case when p_scope_hint is not null then access.scope_object(p_scope_hint) else null end
      when p_operation='invoice.profiles.manage' then
        case when exists(select 1 from invoice.profile profile where profile.id=p_resource)
          then (select access.scope_object(profile.owner_id) from invoice.profile profile where profile.id=p_resource)
          when p_scope_hint is not null then access.scope_object(p_scope_hint)
          else null end
      when p_operation='identity.invitations.create' and p_scope_hint is not null then
        access.scope_object(p_scope_hint)
      else (select legacy.scope from access.resolve_scope(
        p_membership_id,p_operation,coalesce(p_resource,p_scope_hint)) legacy)
    end
  )
  select resolved.scope from resolved where resolved.scope is not null
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260905012000','49998d4b41c70fea7a1c4d3d4614f60bacc2d10f2cffd45dbf70c726b672664c');

do $assert$
begin
  if position('identity.invitations.create' in pg_get_functiondef('access.resolve_scope(text,text,text,text)'::regprocedure))=0
    or not exists(select 1 from runtime.schemaversion
      where version='20260905012000'
        and checksum='49998d4b41c70fea7a1c4d3d4614f60bacc2d10f2cffd45dbf70c726b672664c') then
    raise exception 'INVITATION_SCOPE_HINT_INCOMPLETE';
  end if;
end
$assert$;

commit;
