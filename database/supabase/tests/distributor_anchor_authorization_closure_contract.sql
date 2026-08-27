begin;

do $$
<<distributor_anchor_authorization_closure_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  distributor_result jsonb;
  distributor_id text;
  user_id text:='contract-anchor-user-'||suffix;
  member_id text:='contract-anchor-member-'||suffix;
  membership_id text:='contract-anchor-membership-'||suffix;
  session_id uuid:=gen_random_uuid();
  center jsonb;
  error_message text;
  before_invites bigint;
  before_roles bigint;
  before_audits bigint;
  protected_name text;
  protected_definition text;
begin
  distributor_result:=public.api_platform_create_distributor(
    'membership-test-owner-admin','user-test-owner','closure_'||suffix,
    '授权闭环契约分销商','{}'::jsonb,'manual','{}'::jsonb,'创建闭环测试分销商',
    'closure-create-'||suffix,'hash-closure-create-'||suffix,
    'closure-create','contract-test'
  );
  distributor_id:=distributor_result#>>'{distributor,id}';
  perform public.api_platform_attach_tenant_to_distributor(
    'membership-test-owner-admin','user-test-owner',distributor_id,'tenant-smart-wing',
    now()-interval '1 minute',null,'{"contract":true}'::jsonb,'挂接闭环测试租户',
    'closure-attach-'||suffix,'hash-closure-attach-'||suffix,
    'closure-attach','contract-test'
  );

  insert into public.users(
    id,tenant_id,enterprise_id,employee_no,display_name,identity_subject,status
  ) values(
    user_id,'tenant-smart-wing','enterprise-demo','ANCHOR-'||suffix,
    '授权闭环契约用户','contract:anchor:'||suffix,'active'
  );
  insert into public.members(id,user_id,primary_identifier,status)
  values(member_id,user_id,'contract:anchor:'||suffix,'active');
  insert into public.memberships(
    id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,target,status
  ) values(
    membership_id,member_id,user_id,'tenant-smart-wing','enterprise-demo','mall-demo','admin','active'
  );
  insert into public.membership_roles(membership_id,role_id,granted_by_membership_id)
  values(membership_id,'role-enterprise-manager-v2','membership-test-owner-admin');
  insert into public.role_permissions(role_id,permission_id)
  select 'role-enterprise-manager-v2',permission.id from public.permissions permission
  where permission.code=any(array[
    'member.read','member.pii.read','member.invite','member.update','member.import',
    'audit.read','role.read','role.create','role.update','role.delete','role.grant','scope.grant',
    'commercial_resource.read','commercial_resource.manage','employee_qualification.read',
    'employee_qualification.manage','qualification.approve'
  ]) on conflict do nothing;
  insert into public.membership_scopes(membership_id,scope_kind,resource_id)
  values(membership_id,'distributor',distributor_id);

  -- One live canonical distributor binding is a usable authority anchor.
  if not public.api_lock_membership_actor(
       membership_id,user_id,'admin','tenant-smart-wing','enterprise-demo','mall-demo'
     ) or not public.api_admin_step_up_identity_matches(membership_id,user_id)
     or not public.api_voucher_membership_actor_matches(membership_id,user_id)
  then raise exception 'CONTRACT_ACTIVE_ANCHOR_REJECTED'; end if;
  center:=public.api_permission_command_center(
    membership_id,'tenant-smart-wing','enterprise-demo','mall-demo',false
  );
  if center is null or public.api_member_operations_center(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo',false,false,false
     ) is null or public.api_custom_role_center(membership_id,'tenant-smart-wing') is null
     or public.api_qualification_center_authorized(
       membership_id,user_id,'tenant-smart-wing','enterprise-demo','mall-demo'
     ) is null
  then raise exception 'CONTRACT_ACTIVE_ANCHOR_CENTER_REJECTED'; end if;
  if not exists(
    select 1 from jsonb_array_elements(public.api_list_login_memberships(member_id)) item
    where item->>'id'=membership_id
  ) then raise exception 'CONTRACT_ACTIVE_ANCHOR_LOGIN_MISSING'; end if;
  if not public.api_create_auth_session(
    session_id,member_id,membership_id,'admin','contract-ip','contract-agent',
    'contract-device',now()+interval '1 hour'
  ) then raise exception 'CONTRACT_ACTIVE_ANCHOR_SESSION_REJECTED'; end if;

  select count(*) into before_invites from public.membership_registration_invites;
  select count(*) into before_roles from public.roles;
  select count(*) into before_audits from public.audit_logs;
  update public.distributor_tenants relation
  set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour'
  where relation.distributor_id=distributor_anchor_authorization_closure_contract.distributor_id
    and relation.tenant_id='tenant-smart-wing';

  -- Every requested read surface fails closed after relation expiry.
  if public.api_permission_command_center(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo',false
     ) is not null or public.api_member_operations_center(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo',false,false,false
     ) is not null or public.api_custom_role_center(membership_id,'tenant-smart-wing') is not null
     or public.api_admin_step_up_identity_matches(membership_id,user_id)
     or public.api_voucher_membership_actor_matches(membership_id,user_id)
     or exists(
       select 1 from jsonb_array_elements(public.api_list_login_memberships(member_id)) item
       where item->>'id'=membership_id
     ) or public.api_create_auth_session(
       gen_random_uuid(),member_id,membership_id,'admin','contract-ip','contract-agent',
       'contract-device',now()+interval '1 hour'
     )
  then raise exception 'CONTRACT_EXPIRED_ANCHOR_READ_ALLOWED'; end if;
  begin
    perform public.api_qualification_center_authorized(
      membership_id,user_id,'tenant-smart-wing','enterprise-demo','mall-demo'
    );
    raise exception 'CONTRACT_EXPIRED_QUALIFICATION_CENTER_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%QUALIFICATION_ACTOR_INVALID%' then raise; end if;
  end;
  begin
    perform public.api_admin_step_up_start(
      membership_id,user_id,'contract-session-123456','contract-step-up','contract-agent'
    );
    raise exception 'CONTRACT_EXPIRED_STEP_UP_WRITE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%STEP_UP_IDENTITY_INVALID%' then raise; end if;
  end;

  -- Rejection happens in the wrapper, before primitive validation or ledger writes.
  begin
    perform public.api_create_membership_invite(
      membership_id,user_id,'tenant-smart-wing','enterprise-demo','mall-demo',
      '闭环测试邀请码',repeat('a',64),1,now()+interval '1 day',
      'closure-invite','contract-agent','{}'::jsonb
    );
    raise exception 'CONTRACT_EXPIRED_MEMBER_WRITE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%MEMBERSHIP_NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.api_create_custom_role(
      membership_id,user_id,'tenant-smart-wing','enterprise-demo','mall-demo',
      'closure_'||suffix,'闭环契约角色','contract','{}'::text[],null,
      '验证失效锚点','closure-role','contract-agent','{}'::jsonb
    );
    raise exception 'CONTRACT_EXPIRED_ROLE_WRITE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%MEMBERSHIP_NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.api_apply_qualification_config(
      'tenant-smart-wing','enterprise-demo','mall-demo',user_id,membership_id,
      'catalog_pool','',0,'{}'::jsonb,'验证失效锚点','closure-config-'||suffix,
      repeat('b',64),'closure-config','contract-agent','{}'::jsonb
    );
    raise exception 'CONTRACT_EXPIRED_QUALIFICATION_WRITE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%QUALIFICATION_ACTOR_INVALID%' then raise; end if;
  end;
  if (select count(*) from public.membership_registration_invites)<>before_invites
     or (select count(*) from public.roles)<>before_roles
     or (select count(*) from public.audit_logs)<>before_audits
     or exists(select 1 from public.admin_step_up_challenges challenge
       where challenge.membership_id=distributor_anchor_authorization_closure_contract.membership_id)
  then raise exception 'CONTRACT_EXPIRED_ANCHOR_LEDGER_CHANGED'; end if;

  -- All write entry points contain the lock gate; StepUp and vouchers inherit it.
  foreach protected_name in array array[
    'api_update_membership_access','api_update_membership_status','api_record_step_up',
    'api_create_membership_invite','api_disable_membership_invite','api_admin_create_member',
    'api_update_member_profile','api_record_member_import','api_initial_change_local_password',
    'api_create_custom_role','api_update_custom_role','api_set_custom_role_status',
    'api_apply_qualification_config','api_request_qualification_change',
    'api_review_qualification_change','api_update_employee_qualification','api_create_auth_session'
  ] loop
    select pg_get_functiondef(proc.oid) into strict protected_definition
    from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
    where ns.nspname='public' and proc.proname=protected_name;
    if position('api_lock_membership_actor' in protected_definition)=0
    then raise exception 'CONTRACT_WRITE_GATE_MISSING:%',protected_name; end if;
  end loop;
  if position('api_admin_step_up_identity_matches' in pg_get_functiondef(
       'public.api_admin_step_up_start(text,text,text,text,text)'::regprocedure
     ))=0 or position('api_voucher_membership_actor_matches' in pg_get_functiondef(
       'public.api_create_voucher_reserve_authorized(text,text,text,integer,text,text,text,text,text,jsonb)'::regprocedure
     ))=0
  then raise exception 'CONTRACT_INHERITED_WRITE_GATE_MISSING'; end if;

  -- Actor-less qualification primitives are owner-only; six replacements are callable.
  if (select count(*) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
      where ns.nspname='public' and proc.proname=any(array[
        'api_qualification_center','api_qualification_entity_version',
        'api_qualification_change_preview','api_qualification_history',
        'api_qualification_rollback_snapshot','api_qualification_governance_center'
      ]) and has_function_privilege('service_role',proc.oid,'execute'))<>0
  then raise exception 'CONTRACT_QUALIFICATION_PRIMITIVE_EXPOSED'; end if;
  if (select count(*) from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
      where ns.nspname='public' and proc.proname=any(array[
        'api_qualification_center_authorized','api_qualification_entity_version_authorized',
        'api_qualification_change_preview_authorized','api_qualification_history_authorized',
        'api_qualification_rollback_snapshot_authorized',
        'api_qualification_governance_center_authorized'
      ]) and has_function_privilege('service_role',proc.oid,'execute'))<>6
  then raise exception 'CONTRACT_QUALIFICATION_WRAPPER_ACL_INVALID'; end if;
  if has_function_privilege(
       'service_role','public.api_lock_membership_actor(text,text,text,text,text,text)','execute'
     ) or exists(
       select 1 from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
       where ns.nspname='public' and proc.proname like 'internal_anchor_%'
         and has_function_privilege('service_role',proc.oid,'execute')
     )
  then raise exception 'CONTRACT_INTERNAL_PRIMITIVE_EXPOSED'; end if;
end;
$$;

rollback;
