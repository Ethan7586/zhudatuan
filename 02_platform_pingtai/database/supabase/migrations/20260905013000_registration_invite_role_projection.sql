begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:registration-invite-role-projection:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'REGISTRATION_INVITE_ROLE_PROJECTION_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260905012000'
        and checksum='49998d4b41c70fea7a1c4d3d4614f60bacc2d10f2cffd45dbf70c726b672664c')
    or exists(select 1 from runtime.schemaversion where version>'20260905012000') then
    raise exception 'REGISTRATION_INVITE_ROLE_PROJECTION_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create or replace function access.registration_invite_role_allowed(
  p_role_id text,
  p_scope_id text,
  p_target_client text
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,pg_temp
as $function$
  select exists(
    select 1
    from access.role role
    where role.id=p_role_id and role.scope_id=p_scope_id and role.status='active'
      and (
        (p_target_client='storefront'
          and role.id=case when p_scope_id='mall-zhudatuan'
            then 'role-zhudatuan-storefront-member'
            else 'role-zhudatuan-storefront-member:'||p_scope_id end)
        or (p_target_client='operator'
          and ((role.id='role-zhudatuan-pending-operator'
              and not exists(select 1 from access.rolepermission mapping where mapping.role_id=role.id))
            or role.id='role-senior-administrator-v1:'||p_scope_id))
      )
  )
$function$;

revoke all on function access.registration_invite_role_allowed(text,text,text)
  from public,shopjob,shopread;
grant execute on function access.registration_invite_role_allowed(text,text,text)
  to shopapp,zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260905013000','437e5a0a393ead6552b7fcfcc2735f2033edfbd13ab48250bd6952bfe49c9329');

do $assert$
begin
  if not has_function_privilege('shopapp','access.registration_invite_role_allowed(text,text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi','access.registration_invite_role_allowed(text,text,text)','execute')
    or has_function_privilege('public','access.registration_invite_role_allowed(text,text,text)','execute')
    or not exists(select 1 from runtime.schemaversion
      where version='20260905013000'
        and checksum='437e5a0a393ead6552b7fcfcc2735f2033edfbd13ab48250bd6952bfe49c9329') then
    raise exception 'REGISTRATION_INVITE_ROLE_PROJECTION_INCOMPLETE';
  end if;
end
$assert$;

commit;
