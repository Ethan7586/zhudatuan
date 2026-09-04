begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:merge-storefront-governance-invitation-visibility:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903106000'
        and checksum='44bbc40daf78e233a94bcda38e9323e3fb874d892393291943c9f38b00228d87')
    or exists(select 1 from runtime.schemaversion where version>'20260903106000') then
    raise exception 'INVITATION_VISIBILITY_MERGE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

drop policy if exists zhudatuanidentityapi on member.invite;
create policy zhudatuanidentityapi on member.invite for select to zhudatuanidentityapi using(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
    and (use_count<max_uses or (use_count=max_uses and accepted_at>=transaction_timestamp()))
    and (
      (target_client='storefront'
        and role_id=case when organization_id='mall-zhudatuan' then 'role-zhudatuan-storefront-member'
          else 'role-zhudatuan-storefront-member:'||organization_id end
        and storefront_organization_id is null
        and exists(select 1 from organization.organization mall
          where mall.id=organization_id and mall.kind='mall' and mall.status='active'))
      or (target_client='operator'
        and (role_id='role-zhudatuan-pending-operator'
          or role_id='role-senior-administrator-v1:'||organization_id)
        and organization_id='tenant-zhudatuan' and storefront_organization_id='mall-zhudatuan'
        and allowed_destination_hash is not null and max_uses=1)
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
    and (
      created_by=nullif(current_setting('app.membership_id',true),'')
      or accepted_membership_id=nullif(current_setting('app.membership_id',true),'')
      or access.zhudatuan_owner_context()
    )
  )
);

do $postcondition$
declare policy_expression text;
begin
  select pg_get_expr(policy.polqual,policy.polrelid) into policy_expression
  from pg_policy policy
  where policy.polrelid='member.invite'::regclass and policy.polname='zhudatuanidentityapi';
  if policy_expression is null
    or position('role-zhudatuan-storefront-member:' in policy_expression)=0
    or position('zhudatuan_owner_context' in policy_expression)=0 then
    raise exception 'INVITATION_VISIBILITY_MERGE_INVALID';
  end if;
end
$postcondition$;

insert into runtime.schemaversion(version,checksum)
values('20260903107000','2f462b96c7fa8034051d4f8dc77a9391de6f8a12e07bd7a8d055769c07c8337d');

commit;
