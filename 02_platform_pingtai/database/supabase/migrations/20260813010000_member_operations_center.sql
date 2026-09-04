-- Member operations center: invitation lifecycle, admin-created storefront
-- members, profile maintenance, import reports and scoped audit history.
-- This surface can never create an admin membership or an Owner role.

alter table public.membership_registration_invites
  add column if not exists label text not null default '会员邀请码';

create table if not exists public.membership_import_jobs (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  actor_membership_id text not null references public.memberships(id) on delete restrict,
  source_name text not null,
  status text not null check (status in ('completed','partial','failed')),
  total_rows integer not null check (total_rows between 1 and 500),
  success_rows integer not null check (success_rows between 0 and total_rows),
  failed_rows integer not null check (failed_rows between 0 and total_rows),
  created_at timestamptz not null default now(),
  check (success_rows + failed_rows = total_rows)
);

create table if not exists public.membership_import_errors (
  job_id text not null references public.membership_import_jobs(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  error_code text not null,
  message text not null,
  input_json jsonb not null default '{}'::jsonb,
  primary key (job_id,row_number)
);

create index if not exists membership_import_jobs_scope_created
on public.membership_import_jobs(tenant_id,enterprise_id,mall_id,created_at desc);

drop function if exists public.api_member_operations_center(text,text,text,text,boolean,boolean);
create or replace function public.api_member_operations_center(
  p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_include_pii boolean default false,p_include_history boolean default false,
  p_include_import_errors boolean default false
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype;
begin
  select * into actor from public.memberships
  where id=p_actor_membership_id and tenant_id=p_tenant_id
    and enterprise_id=p_enterprise_id and target='admin' and status='active';
  if not found then return null; end if;
  return jsonb_build_object(
    'profiles',coalesce((select jsonb_agg(jsonb_build_object(
      'membershipId',ms.id,'memberId',ms.member_id,'userId',u.id,
      'displayName',u.display_name,'employeeNo',u.employee_no,
      'username',(select a.subject from public.member_login_aliases a where a.member_id=ms.member_id and a.provider='local_username' limit 1),
      'email',case when p_include_pii then u.email else null end,
      'mobileMasked',case when p_include_pii then u.mobile_masked else null end,
      'phoneBound',exists(select 1 from public.member_login_aliases a where a.member_id=ms.member_id and a.provider='local_phone'),
      'departmentId',u.department_id,'departmentName',d.name,
      'target',ms.target,'status',ms.status,'authzVersion',ms.authz_version,
      'isOwner',exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=ms.id and mr.revoked_at is null and r.is_owner),
      'createdAt',ms.created_at
    ) order by u.display_name)
      from public.memberships ms join public.members m on m.id=ms.member_id
      join public.users u on u.id=m.user_id left join public.departments d on d.id=u.department_id
      where ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id
        and (ms.mall_id is null or ms.mall_id=p_mall_id)
        and (exists(select 1 from public.membership_scopes s where s.membership_id=p_actor_membership_id and s.scope_kind='tenant' and s.resource_id=p_tenant_id)
          or exists(select 1 from public.membership_scopes s where s.membership_id=p_actor_membership_id and s.scope_kind='enterprise' and s.resource_id=ms.enterprise_id)
          or exists(select 1 from public.membership_scopes s where s.membership_id=p_actor_membership_id and s.scope_kind='mall' and s.resource_id=ms.mall_id)
          or ms.id=p_actor_membership_id)), '[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'label',i.label,'target',i.target,'maxUses',i.max_uses,
      'useCount',i.use_count,'startsAt',i.starts_at,'expiresAt',i.expires_at,
      'status',case when i.status='active' and i.expires_at<=now() then 'expired' else i.status end,
      'createdAt',i.created_at
    ) order by i.created_at desc) from public.membership_registration_invites i
      where i.tenant_id=p_tenant_id and i.enterprise_id=p_enterprise_id and i.mall_id=p_mall_id), '[]'::jsonb),
    'imports',coalesce((select jsonb_agg(jsonb_build_object(
      'id',j.id,'sourceName',j.source_name,'status',j.status,'totalRows',j.total_rows,
      'successRows',j.success_rows,'failedRows',j.failed_rows,'createdAt',j.created_at,
      'errors',case when p_include_import_errors then coalesce((select jsonb_agg(jsonb_build_object(
        'rowNumber',e.row_number,'code',e.error_code,'message',e.message,'input',e.input_json
      ) order by e.row_number) from public.membership_import_errors e where e.job_id=j.id),'[]'::jsonb) else '[]'::jsonb end
    ) order by j.created_at desc) from (select * from public.membership_import_jobs
      where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id
      order by created_at desc limit 30) j), '[]'::jsonb),
    'history',case when p_include_history then coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'action',a.action,'resourceType',a.resource_type,'resourceId',a.resource_id,
      'actorUserId',a.actor_user_id,'before',a.before_json,'after',a.after_json,'createdAt',a.created_at
    ) order by a.created_at desc) from (select * from public.audit_logs
      where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id
        and (mall_id is null or mall_id=p_mall_id) and action like 'member.%'
      order by created_at desc limit 100) a), '[]'::jsonb) else '[]'::jsonb end,
    'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name)
      from public.departments d where d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.api_create_membership_invite(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_label text,p_code_hash text,p_max_uses integer,p_expires_at timestamptz,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare invite_id text:='invite-'||gen_random_uuid()::text; employee_role text; actor public.memberships%rowtype;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id
    and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if not exists(select 1 from public.membership_scopes s where s.membership_id=actor.id and (
    (s.scope_kind='tenant' and s.resource_id=p_tenant_id) or (s.scope_kind='enterprise' and s.resource_id=p_enterprise_id)
    or (s.scope_kind='mall' and s.resource_id=p_mall_id))) then raise exception 'SCOPE_MISMATCH'; end if;
  if length(trim(coalesce(p_label,''))) not between 2 and 80 or length(coalesce(p_code_hash,'')) not between 40 and 128
    or p_max_uses not between 1 and 500 or p_expires_at<=now()+interval '10 minutes'
    or p_expires_at>now()+interval '90 days' then raise exception 'INVALID_INVITATION_INPUT'; end if;
  select id into employee_role from public.roles where tenant_id=p_tenant_id and code='employee' and not is_owner;
  if employee_role is null then raise exception 'EMPLOYEE_ROLE_NOT_FOUND'; end if;
  insert into public.membership_registration_invites(
    id,label,code_hash,tenant_id,enterprise_id,mall_id,role_id,target,max_uses,expires_at,created_by_membership_id
  ) values(invite_id,trim(p_label),p_code_hash,p_tenant_id,p_enterprise_id,p_mall_id,employee_role,'storefront',p_max_uses,p_expires_at,p_actor_membership_id);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.invitation.created','membership_invitation',invite_id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('label',trim(p_label),'maxUses',p_max_uses,'expiresAt',p_expires_at,'roleCode','employee'),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('id',invite_id,'label',trim(p_label),'maxUses',p_max_uses,'expiresAt',p_expires_at,'status','active');
end;
$$;

create or replace function public.api_disable_membership_invite(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_invite_id text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare invitation public.membership_registration_invites%rowtype;
begin
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'CHANGE_REASON_REQUIRED'; end if;
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id
    and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into invitation from public.membership_registration_invites where id=p_invite_id and tenant_id=p_tenant_id
    and enterprise_id=p_enterprise_id and mall_id=p_mall_id for update;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  update public.membership_registration_invites set status='disabled' where id=invitation.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.invitation.disabled','membership_invitation',invitation.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('status',invitation.status),jsonb_build_object('status','disabled','reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('id',invitation.id,'status','disabled');
end;
$$;

create or replace function public.api_admin_create_member(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_username text,p_password_hash text,p_display_name text,p_employee_no text,p_email text,p_department_id text,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare normalized_username text:=lower(trim(p_username)); new_user text:='user-admin-'||gen_random_uuid()::text;
  new_member text:='member-admin-'||gen_random_uuid()::text; new_membership text:='membership-admin-'||gen_random_uuid()::text;
  employee_role text; employee_no text:=coalesce(nullif(upper(trim(p_employee_no)),''),'ADM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
begin
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id
    and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if normalized_username !~ '^[a-z][a-z0-9._-]{3,31}$' or length(p_password_hash) not between 40 and 1024
    or length(trim(coalesce(p_display_name,''))) not between 1 and 60 or employee_no !~ '^[A-Z0-9_-]{2,40}$'
    or length(coalesce(p_email,''))>200 then return jsonb_build_object('status','invalid_input'); end if;
  if p_department_id is not null and not exists(select 1 from public.departments d where d.id=p_department_id and d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id) then return jsonb_build_object('status','invalid_department'); end if;
  if exists(select 1 from public.member_login_aliases where (provider='local_username' and subject=normalized_username) or (provider='test' and lower(subject)=normalized_username)) then return jsonb_build_object('status','account_exists'); end if;
  select id into employee_role from public.roles where tenant_id=p_tenant_id and code='employee' and not is_owner;
  if employee_role is null then raise exception 'EMPLOYEE_ROLE_NOT_FOUND'; end if;
  begin
    insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,identity_subject,status)
    values(new_user,p_tenant_id,p_enterprise_id,p_department_id,employee_no,trim(p_display_name),nullif(trim(p_email),''),'local_username:'||normalized_username,'active');
    insert into public.members(id,user_id,primary_identifier,status) values(new_member,new_user,'local_username:'||normalized_username,'active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username',normalized_username,new_member);
    insert into public.member_credentials(member_id,password_hash,phone_cipher,must_reset_password)
    values(new_member,p_password_hash,'{"version":1,"kind":"unbound"}'::jsonb,true);
    insert into public.memberships(id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,target,status)
    values(new_membership,new_member,new_user,p_tenant_id,p_enterprise_id,p_mall_id,'storefront','active');
    insert into public.membership_roles(membership_id,role_id,granted_by_membership_id) values(new_membership,employee_role,p_actor_membership_id);
    insert into public.membership_scopes(membership_id,scope_kind,resource_id) values(new_membership,'self',new_user);
    insert into public.welfare_accounts(id,tenant_id,enterprise_id,mall_id,user_id,account_type,balance_cents)
    values('account-admin-'||gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,new_user,'welfare',0);
  exception when unique_violation then return jsonb_build_object('status','account_exists'); end;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.admin_created','membership',new_membership,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('username',normalized_username,'employeeNo',employee_no,'displayName',trim(p_display_name),'roleCode','employee','mustResetPassword',true,'phoneBound',false),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('status','active','membershipId',new_membership,'memberId',new_member,'employeeNo',employee_no,'username',normalized_username);
end;
$$;

create or replace function public.api_update_member_profile(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_target_membership_id text,p_display_name text,p_email text,p_department_id text,p_reason text,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.memberships%rowtype; target_user public.users%rowtype; department_changed boolean;
begin
  if length(trim(coalesce(p_display_name,''))) not between 1 and 60 or length(coalesce(p_email,''))>200
    or length(trim(coalesce(p_reason,'')))<4 then raise exception 'INVALID_MEMBER_PROFILE'; end if;
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id
    and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into target from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target.id and mr.revoked_at is null and r.is_owner) then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  if p_department_id is not null and not exists(select 1 from public.departments d where d.id=p_department_id and d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;
  select u.* into target_user from public.members m join public.users u on u.id=m.user_id where m.id=target.member_id for update of u;
  department_changed:=target_user.department_id is distinct from p_department_id;
  update public.users set display_name=trim(p_display_name),email=nullif(trim(p_email),''),department_id=p_department_id,updated_at=now() where id=target_user.id;
  if department_changed then update public.memberships set authz_version=authz_version+1,updated_at=now() where member_id=target.member_id; end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.profile.updated','membership',target.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('displayName',target_user.display_name,'email',target_user.email,'departmentId',target_user.department_id),
    jsonb_build_object('displayName',trim(p_display_name),'email',nullif(trim(p_email),''),'departmentId',p_department_id,'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target.id,'status','updated','authzVersion',(select authz_version from public.memberships where id=target.id));
end;
$$;

create or replace function public.api_record_member_import(
  p_job_id text,p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_source_name text,p_total_rows integer,p_success_rows integer,p_errors jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; failed integer:=jsonb_array_length(coalesce(p_errors,'[]'::jsonb)); job_status text;
begin
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if p_total_rows not between 1 and 500 or p_success_rows<0 or p_success_rows+failed<>p_total_rows
    or length(trim(coalesce(p_source_name,''))) not between 1 and 200 then raise exception 'INVALID_IMPORT_SUMMARY'; end if;
  job_status:=case when failed=0 then 'completed' when p_success_rows=0 then 'failed' else 'partial' end;
  insert into public.membership_import_jobs(id,tenant_id,enterprise_id,mall_id,actor_membership_id,source_name,status,total_rows,success_rows,failed_rows)
  values(p_job_id,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_membership_id,trim(p_source_name),job_status,p_total_rows,p_success_rows,failed);
  for item in select value from jsonb_array_elements(coalesce(p_errors,'[]'::jsonb)) loop
    insert into public.membership_import_errors(job_id,row_number,error_code,message,input_json)
    values(p_job_id,(item->>'rowNumber')::integer,left(item->>'code',80),left(item->>'message',300),coalesce(item->'input','{}'::jsonb));
  end loop;
  return jsonb_build_object('id',p_job_id,'status',job_status,'totalRows',p_total_rows,'successRows',p_success_rows,'failedRows',failed,'errors',coalesce(p_errors,'[]'::jsonb));
end;
$$;

create or replace function public.api_initial_change_local_password(
  p_member_id text,p_password_hash text,p_request_id text,p_user_agent text
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.members%rowtype; membership public.memberships%rowtype; changed integer;
begin
  if length(p_password_hash) not between 40 and 1024 then return false; end if;
  select * into target from public.members where id=p_member_id and status='active';
  if not found then return false; end if;
  update public.member_credentials set password_hash=p_password_hash,password_changed_at=now(),
    must_reset_password=false,credential_version=credential_version+1,updated_at=now()
  where member_id=p_member_id and must_reset_password=true;
  get diagnostics changed=row_count;
  if changed<>1 then return false; end if;
  update public.auth_sessions set revoked_at=coalesce(revoked_at,now()),revoked_reason=coalesce(revoked_reason,'initial_password_changed')
  where member_id=p_member_id and revoked_at is null;
  select * into membership from public.memberships where member_id=p_member_id and target='storefront' order by created_at limit 1;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id)
  values(gen_random_uuid()::text,membership.tenant_id,membership.enterprise_id,membership.mall_id,target.user_id,'user','member.initial_password.changed','member',p_member_id,
    p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('otherSessionsRevoked',true),membership.id);
  return true;
end;
$$;

revoke all on table public.membership_import_jobs,public.membership_import_errors from public,anon,authenticated;
alter table public.membership_import_jobs enable row level security;
alter table public.membership_import_errors enable row level security;
revoke all on function public.api_member_operations_center(text,text,text,text,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.api_create_membership_invite(text,text,text,text,text,text,text,integer,timestamptz,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_disable_membership_invite(text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_admin_create_member(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_update_member_profile(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_record_member_import(text,text,text,text,text,text,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.api_initial_change_local_password(text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_member_operations_center(text,text,text,text,boolean,boolean,boolean) to service_role;
grant execute on function public.api_create_membership_invite(text,text,text,text,text,text,text,integer,timestamptz,text,text,jsonb) to service_role;
grant execute on function public.api_disable_membership_invite(text,text,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_admin_create_member(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_update_member_profile(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_record_member_import(text,text,text,text,text,text,integer,integer,jsonb) to service_role;
grant execute on function public.api_initial_change_local_password(text,text,text,text) to service_role;
