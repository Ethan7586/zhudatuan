begin;

select pg_advisory_xact_lock(hashtext('sfl:generalize-storefront-roles:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'SFL_STOREFRONT_ROLE_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260908012000'
        and checksum='3e3750e6e2c705183d8611649c3937b1eceb7e28e8b795ff3c80e29c3bebab2e')
    or exists(select 1 from runtime.schemaversion where version>'20260908012000') then
    raise exception 'SFL_STOREFRONT_ROLE_PREDECESSOR_INVALID';
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
        (p_target_client='storefront' and role.name='商城会员')
        or (p_target_client='operator'
          and ((role.id='role-zhudatuan-pending-operator'
              and not exists(select 1 from access.rolepermission mapping where mapping.role_id=role.id))
            or role.id='role-senior-administrator-v1:'||p_scope_id))
      )
  )
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260908013000','6c0e5cd69b82934cf6d5609ce540ec4d07f9906c78a53fb985f4f5cd75ec625a');

do $assert$
begin
  if not has_function_privilege('shopapp','access.registration_invite_role_allowed(text,text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi','access.registration_invite_role_allowed(text,text,text)','execute')
    or has_function_privilege('public','access.registration_invite_role_allowed(text,text,text)','execute')
    or not access.registration_invite_role_allowed(
      'role-zhudatuan-storefront-member','mall-zhudatuan','storefront')
    or not exists(select 1 from runtime.schemaversion
      where version='20260908013000'
        and checksum='6c0e5cd69b82934cf6d5609ce540ec4d07f9906c78a53fb985f4f5cd75ec625a') then
    raise exception 'SFL_STOREFRONT_ROLE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
