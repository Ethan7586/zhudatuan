begin;

select pg_advisory_xact_lock(hashtext('sfl:permission-write-target-separation:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912220000'
        and checksum='178ce847d8cfc1719f1b6bb6956ae75a71065a2ec1da08b278fd318be95a72e2') then
    raise exception 'PERMISSION_WRITE_TARGET_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260912220000') then
    raise exception 'PERMISSION_WRITE_TARGET_FUTURE_HEAD_INVALID';
  end if;
end
$precondition$;

create or replace function access.change_administrator_segment_scope(
  p_actor_membership_id text,p_target_membership_id text,p_expected_access_version bigint,p_request jsonb
)
returns table(
  business_number text,administrator_identity_id text,administrator_membership_id text,role_id text,
  action text,scope_id text,scope_version bigint,realm_id text,line_id text,root_node_id text,
  segment text,access_version bigint,effective_at timestamptz,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_actor record;
  v_target record;
  v_root record;
  v_existing access.administratorsegmentchange%rowtype;
  v_identity access.administratoridentity%rowtype;
  v_prior access.administratorsegmentscope%rowtype;
  v_action text:=p_request->>'action';
  v_role_id text:=p_request->>'role_id';
  v_segment text:=p_request->>'segment';
  v_root_node_id text:=p_request->>'root_node_id';
  v_idempotency_key text:=p_request->>'idempotency_key';
  v_trace_id text:=p_request->>'trace_id';
  v_request_hash text:=encode(public.digest(p_request::text,'sha256'),'hex');
  v_now timestamptz:=clock_timestamp();
  v_scope_version bigint;
  v_access_version bigint;
  v_scope_id text;
  v_change_id text;
  v_business_number text;
begin
  if v_action not in('grant','replace','revoke') or v_segment not in('first_segment','second_segment','both_segments')
    or nullif(v_role_id,'') is null or nullif(v_root_node_id,'') is null or nullif(v_idempotency_key,'') is null
    or p_request<>jsonb_strip_nulls(jsonb_build_object('action',v_action,'role_id',v_role_id,'segment',v_segment,
      'root_node_id',v_root_node_id,'idempotency_key',v_idempotency_key,'trace_id',v_trace_id)) then
    raise exception 'SFL_ADMIN_SCOPE_REQUEST_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_membership_id,0));
  select * into v_existing from access.administratorsegmentchange where idempotency_key=v_idempotency_key;
  if found then
    if v_existing.request_hash<>v_request_hash then raise exception 'SFL_ADMIN_SCOPE_IDEMPOTENCY_KEY_REUSED'; end if;
    return query select v_existing.business_number,v_existing.administrator_identity_id,
      v_existing.administrator_membership_id,v_existing.role_id,v_existing.action,scope.scope_id,scope.scope_version,
      scope.realm_id,scope.line_id,scope.root_node_id,scope.segment,v_existing.resulting_access_version,
      coalesce(scope.effective_at,v_existing.created_at),true
    from (select 1) replay left join access.administratorsegmentscope scope
      on scope.administrator_identity_id=v_existing.administrator_identity_id
      and scope.scope_version=v_existing.resulting_scope_version;
    return;
  end if;

  select * into v_actor from access.resolve_administrator_context(p_actor_membership_id);
  if not found or not ('access.scope.manage'=any(v_actor.permissions)) then raise exception 'SFL_ADMIN_SCOPE_ACTOR_FORBIDDEN'; end if;

  select membership.id,membership.organization_id,membership.client,membership.status,membership.realm_id,
    membership.account_id,membership.access_version,account.legacy_principal_id principal_id,node.id host_node_id
  into v_target
  from access.membership membership
  left join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
    and account.status='active'
  left join organization.node node on node.realm_id=membership.realm_id and node.status='active'
  where membership.id=p_target_membership_id
  for update of membership;
  if not found or v_target.client<>'operator' or v_target.status<>'active' then
    raise exception 'SFL_ADMIN_SCOPE_TARGET_NOT_ACTIVE_OPERATOR';
  end if;
  if v_target.realm_id is null or v_target.account_id is null or v_target.principal_id is null or v_target.host_node_id is null
    or v_target.realm_id<>v_actor.realm_id
    or not exists(select 1 from identity.realmtarget realm_target
      where realm_target.realm_id=v_target.realm_id and realm_target.surface='admin'
        and realm_target.membership_client='operator') then
    raise exception 'SFL_ADMIN_SCOPE_REALM_MISMATCH';
  end if;
  if not exists(select 1 from identity.realmtarget realm_target
      where realm_target.realm_id=v_target.realm_id and realm_target.surface='admin'
        and realm_target.membership_client='operator'
        and realm_target.membership_organization_id=v_target.organization_id) then
    raise exception 'SFL_ADMIN_SCOPE_ORGANIZATION_MISMATCH';
  end if;
  if v_target.access_version<>p_expected_access_version then raise exception 'VERSION_CONFLICT'; end if;

  select node.id,node.line_id,node.realm_id into v_root from organization.node node
  where node.id=v_root_node_id and node.status='active';
  if not found or v_root.realm_id<>v_target.realm_id then raise exception 'SFL_ADMIN_SCOPE_REALM_MISMATCH'; end if;
  if v_root.line_id<>v_actor.line_id
    or not access.administrator_member_visible(p_actor_membership_id,v_root_node_id)
    or (v_actor.segment='first_segment' and v_segment<>'first_segment')
    or (v_actor.segment='second_segment' and v_segment<>'second_segment') then
    raise exception 'SFL_ADMIN_SCOPE_BOUNDARY_DENIED';
  end if;
  if not exists(select 1 from access.role role where role.id=v_role_id and role.status='active'
      and (role.scope_id=v_target.organization_id or exists(
        select 1 from organization.unitclosure role_boundary
        join organization.organization governance on governance.id=role_boundary.ancestor_id
          and governance.kind='tenant' and governance.status='active'
        join organization.unitclosure target_boundary on target_boundary.ancestor_id=governance.id
          and target_boundary.descendant_id=v_target.organization_id
        where role_boundary.descendant_id=role.scope_id
      ))) then
    raise exception 'SFL_ADMIN_SCOPE_ORGANIZATION_MISMATCH';
  end if;
  if not exists(select 1 from access.role role join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
      join access.permission permission on permission.id=mapping.permission_id and permission.code='member.read' and permission.status='active'
      where role.id=v_role_id and role.status='active') then raise exception 'SFL_ADMIN_ROLE_INVALID'; end if;

  select * into v_identity from access.administratoridentity
  where membership_id=p_target_membership_id and status='active' for update;
  if not found then raise exception 'SFL_ADMIN_IDENTITY_REQUIRED'; end if;
  if v_identity.realm_id<>v_target.realm_id or v_identity.account_id<>v_target.account_id
      or v_identity.principal_id<>v_target.principal_id or v_identity.host_node_id<>v_target.host_node_id then
    raise exception 'SFL_ADMIN_IDENTITY_BINDING_MISMATCH';
  end if;

  select * into v_prior from access.administratorsegmentscope prior_scope
  where prior_scope.administrator_identity_id=v_identity.id and prior_scope.status='active' for update;
  if v_action='grant' and found then raise exception 'SFL_ADMIN_SCOPE_ALREADY_ACTIVE'; end if;
  if v_action in('replace','revoke') and not found then raise exception 'SFL_ADMIN_SCOPE_NOT_ACTIVE'; end if;

  if v_prior.scope_id is not null then
    update access.administratorsegmentscope prior_scope set status='revoked',revoked_at=v_now
    where prior_scope.scope_id=v_prior.scope_id;
  end if;
  v_scope_version:=coalesce((select max(scope.scope_version) from access.administratorsegmentscope scope
    where scope.administrator_identity_id=v_identity.id),0)+1;
  v_access_version:=v_target.access_version+1;
  if v_action<>'revoke' then
    v_scope_id:='admin-scope:'||encode(public.digest(v_identity.id||':'||v_scope_version::text,'sha256'),'hex');
    insert into access.administratorsegmentscope(
      scope_id,administrator_identity_id,scope_version,realm_id,line_id,root_node_id,segment,role_id,
      access_version,status,effective_at,granted_by_administrator_identity_id
    ) values(v_scope_id,v_identity.id,v_scope_version,v_target.realm_id,v_root.line_id,v_root_node_id,v_segment,v_role_id,
      v_access_version,'active',v_now,v_actor.administrator_identity_id);
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
    select p_target_membership_id,v_role_id,v_now,null,p_actor_membership_id
    where not exists(select 1 from access.membershiprole assignment where assignment.membership_id=p_target_membership_id
      and assignment.role_id=v_role_id and assignment.effective_at<=v_now
      and (assignment.expires_at is null or assignment.expires_at>v_now));
  else
    update access.membershiprole assignment set expires_at=v_now
    where assignment.membership_id=p_target_membership_id and assignment.role_id=v_role_id
      and assignment.effective_at<=v_now and (assignment.expires_at is null or assignment.expires_at>v_now);
  end if;
  update access.membership target_membership set access_version=v_access_version
  where target_membership.id=p_target_membership_id;

  if current_setting('sfl.admin_scope_interrupt',true)='after-scope' then
    raise exception 'SFL_ADMIN_SCOPE_TEST_INTERRUPT';
  end if;

  v_change_id:='admin-change:'||encode(public.digest(v_idempotency_key,'sha256'),'hex');
  v_business_number:='SFL-ADMIN-'||upper(substr(encode(public.digest(v_change_id,'sha256'),'hex'),1,16));
  insert into access.administratorsegmentchange(
    change_id,business_number,idempotency_key,request_hash,actor_administrator_identity_id,
    administrator_identity_id,administrator_membership_id,role_id,action,previous_scope_version,
    resulting_scope_version,resulting_access_version,created_at
  ) values(v_change_id,v_business_number,v_idempotency_key,v_request_hash,v_actor.administrator_identity_id,
    v_identity.id,p_target_membership_id,v_role_id,v_action,v_prior.scope_version,
    case when v_action='revoke' then null else v_scope_version end,v_access_version,v_now);
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values('event:'||encode(public.digest(v_change_id,'sha256'),'hex'),'access.administrator.scope.changed',1,'administrator',
    v_identity.id,v_root_node_id,jsonb_build_object('business_number',v_business_number,'action',v_action,
      'administrator_identity_id',v_identity.id,'administrator_membership_id',p_target_membership_id,
      'role_id',v_role_id,'scope_version',case when v_action='revoke' then null else v_scope_version end,
      'access_version',v_access_version),coalesce(v_trace_id,v_change_id),v_now,v_now);
  return query select v_business_number,v_identity.id,p_target_membership_id,v_role_id,v_action,v_scope_id,
    case when v_action='revoke' then null else v_scope_version end,v_target.realm_id,v_root.line_id,v_root_node_id,
    v_segment,v_access_version,v_now,false;
end
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260912230000','00957fef847764497bcc033057d4feceb919c7a90a6ec984daf6e40f2694b096');

do $assert$
declare definition text;
begin
  select pg_get_functiondef('access.change_administrator_segment_scope(text,text,bigint,jsonb)'::regprocedure)
  into definition;
  if position('SFL_ADMIN_SCOPE_TARGET_NOT_ACTIVE_OPERATOR' in definition)=0
    or position('SFL_ADMIN_SCOPE_REALM_MISMATCH' in definition)=0
    or position('SFL_ADMIN_SCOPE_ORGANIZATION_MISMATCH' in definition)=0
    or position('SFL_ADMIN_IDENTITY_REQUIRED' in definition)=0
    or position('insert into access.administratoridentity' in lower(definition))>0
    or position('update access.administratoridentity' in lower(definition))>0
    or not exists(select 1 from runtime.schemaversion where version='20260912230000'
      and checksum='00957fef847764497bcc033057d4feceb919c7a90a6ec984daf6e40f2694b096') then
    raise exception 'PERMISSION_WRITE_TARGET_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
