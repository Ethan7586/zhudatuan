-- Merchant self-service mall applications: immutable versions, scoped writes,
-- audit evidence and a published projection consumed by the mini-program.

create table if not exists public.mall_application_versions (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  version_no bigint not null check (version_no > 0),
  lifecycle text not null check (lifecycle in ('draft','published')),
  config_json jsonb not null check (jsonb_typeof(config_json) = 'object'),
  source_version_id text references public.mall_application_versions(id),
  reason text not null check (length(trim(reason)) >= 4),
  created_by_user_id text references public.users(id),
  created_by_membership_id text references public.memberships(id),
  created_at timestamptz not null default now(),
  unique (mall_id, version_no)
);

create table if not exists public.mall_application_heads (
  mall_id text primary key references public.malls(id),
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  draft_version_id text not null references public.mall_application_versions(id),
  published_version_id text not null references public.mall_application_versions(id),
  row_version bigint not null default 1 check (row_version > 0),
  updated_by_user_id text references public.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists mall_application_versions_history
on public.mall_application_versions(tenant_id, enterprise_id, mall_id, version_no desc);

drop trigger if exists mall_application_versions_immutable on public.mall_application_versions;
create trigger mall_application_versions_immutable before update or delete on public.mall_application_versions
for each row execute function public.reject_immutable_change();

revoke all on table public.mall_application_versions from public, anon, authenticated;
revoke all on table public.mall_application_heads from public, anon, authenticated;
alter table public.mall_application_versions enable row level security;
alter table public.mall_application_heads enable row level security;

create or replace function public.api_default_mall_application_config(p_name text)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'schemaVersion',1,
    'mallDisplayName',left(coalesce(nullif(trim(p_name),''),'智慧翼福利商城'),40),
    'themePreset','smart-blue',
    'announcement','登录后识别企业福利与可购资格',
    'hero',jsonb_build_object('title','员工专享福利季','subtitle','精选好物 · 专属惠上'),
    'entries',jsonb_build_array(
      jsonb_build_object('key','enterprise','label','企业专区','visible',true,'sortOrder',1),
      jsonb_build_object('key','city','label','城市专区','visible',true,'sortOrder',2),
      jsonb_build_object('key','voucher','label','电子卡券','visible',true,'sortOrder',3),
      jsonb_build_object('key','partner','label','合作商','visible',true,'sortOrder',4)
    ),
    'partners',jsonb_build_array('全部','麦德龙','沃尔玛','山姆','大润发','永辉'),
    'segments',jsonb_build_array(
      jsonb_build_object('key','grocery','title','商超到家','description','生鲜百货 极速达送','visible',true,'sortOrder',1),
      jsonb_build_object('key','life','title','生活服务','description','乐享生活 便捷到家','visible',true,'sortOrder',2),
      jsonb_build_object('key','digital','title','数码办公','description','精选设备 高效办公','visible',true,'sortOrder',3),
      jsonb_build_object('key','dining','title','餐饮福利','description','美味折扣 员工专享','visible',true,'sortOrder',4)
    ),
    'memberCodeCta',jsonb_build_object('title','到店出示会员码','description','合作门店身份与权益核验 · 不是支付码'),
    'recommendationLimit',2
  );
$$;

do $$
declare mall_row record; published_id text; draft_id text;
begin
  for mall_row in select m.* from public.malls m
    where not exists(select 1 from public.mall_application_heads h where h.mall_id=m.id)
  loop
    published_id := gen_random_uuid()::text;
    draft_id := gen_random_uuid()::text;
    insert into public.mall_application_versions(id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,reason)
    values
      (published_id,mall_row.tenant_id,mall_row.enterprise_id,mall_row.id,1,'published',public.api_default_mall_application_config(mall_row.name),'系统初始化商城应用'),
      (draft_id,mall_row.tenant_id,mall_row.enterprise_id,mall_row.id,2,'draft',public.api_default_mall_application_config(mall_row.name),'系统初始化商城草稿');
    insert into public.mall_application_heads(mall_id,tenant_id,enterprise_id,draft_version_id,published_version_id)
    values(mall_row.id,mall_row.tenant_id,mall_row.enterprise_id,draft_id,published_id);
  end loop;
end $$;

create or replace function public.api_mall_application_actor_access(
  p_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,p_require_enterprise boolean default false
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.memberships ms
    where ms.id=p_membership_id and ms.target='admin' and ms.status='active'
      and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id
      and exists(
        select 1 from public.membership_scopes s where s.membership_id=ms.id and (
          (s.scope_kind='tenant' and s.resource_id=p_tenant_id) or
          (s.scope_kind='enterprise' and s.resource_id=p_enterprise_id) or
          (not p_require_enterprise and s.scope_kind='mall' and s.resource_id=p_mall_id)
        )
      )
  );
$$;

create or replace function public.api_mall_application_center(
  p_tenant_id text,p_enterprise_id text,p_actor_membership_id text
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('malls',coalesce(jsonb_agg(item order by item->>'name'),'[]'::jsonb))
  from (
    select jsonb_build_object(
      'id',m.id,'code',m.code,'publicSlug',m.public_slug,'name',m.name,'status',m.status,
      'rowVersion',h.row_version,'draftVersion',jsonb_build_object(
        'id',draft.id,'versionNo',draft.version_no,'config',draft.config_json,'createdAt',draft.created_at,'reason',draft.reason
      ),'publishedVersion',jsonb_build_object(
        'id',published.id,'versionNo',published.version_no,'config',published.config_json,'createdAt',published.created_at,'reason',published.reason
      ),'history',coalesce((
        select jsonb_agg(jsonb_build_object('id',v.id,'versionNo',v.version_no,'lifecycle',v.lifecycle,'reason',v.reason,'createdAt',v.created_at) order by v.version_no desc)
        from (select * from public.mall_application_versions vh where vh.mall_id=m.id order by vh.version_no desc limit 20) v
      ),'[]'::jsonb)
    ) item
    from public.malls m
    join public.mall_application_heads h on h.mall_id=m.id
    join public.mall_application_versions draft on draft.id=h.draft_version_id
    join public.mall_application_versions published on published.id=h.published_version_id
    where m.tenant_id=p_tenant_id and m.enterprise_id=p_enterprise_id
      and public.api_mall_application_actor_access(p_actor_membership_id,p_tenant_id,p_enterprise_id,m.id,false)
  ) visible;
$$;

create or replace function public.api_mall_application_experience(p_tenant_id text,p_mall_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select v.config_json from public.mall_application_heads h
  join public.mall_application_versions v on v.id=h.published_version_id
  join public.malls m on m.id=h.mall_id
  where h.tenant_id=p_tenant_id and h.mall_id=p_mall_id and m.status='active';
$$;

create or replace function public.api_mutate_mall_application(
  p_action text,p_tenant_id text,p_enterprise_id text,p_context_mall_id text,
  p_actor_user_id text,p_actor_membership_id text,p_target_mall_id text,
  p_payload jsonb,p_expected_row_version bigint,p_source_version_id text,
  p_reason text,p_idempotency_key text,p_request_hash text,p_request_id text,p_user_agent text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_mall public.malls%rowtype; head_row public.mall_application_heads%rowtype;
  source_version public.mall_application_versions%rowtype; new_version_id text; next_version bigint;
  response jsonb; stored public.idempotency_keys%rowtype; new_mall_id text;
begin
  if coalesce(p_action,'') not in ('create','save','publish','restore') then raise exception 'MALL_APPLICATION_ACTION_INVALID'; end if;
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'MALL_APPLICATION_REASON_REQUIRED'; end if;
  if length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  -- Authorize the requested scope before returning a prior idempotent response.
  -- This prevents possession of an idempotency key from becoming a read bypass.
  if p_action='create' then
    if not public.api_mall_application_actor_access(p_actor_membership_id,p_tenant_id,p_enterprise_id,p_context_mall_id,true) then raise exception 'MALL_APPLICATION_SCOPE_FORBIDDEN'; end if;
  else
    select * into target_mall from public.malls where id=p_target_mall_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id;
    if not found then raise exception 'MALL_APPLICATION_NOT_FOUND'; end if;
    if not public.api_mall_application_actor_access(p_actor_membership_id,p_tenant_id,p_enterprise_id,p_target_mall_id,false) then raise exception 'MALL_APPLICATION_SCOPE_FORBIDDEN'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_context_mall_id||':mall_application:'||p_idempotency_key));
  select * into stored from public.idempotency_keys where mall_id=p_context_mall_id and scope='mall_application:'||p_action and idempotency_key=p_idempotency_key;
  if found then
    if stored.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return stored.response_json;
  end if;

  if p_action='create' then
    new_mall_id := gen_random_uuid()::text;
    insert into public.malls(id,tenant_id,enterprise_id,code,public_slug,name,brand_name,status)
    values(new_mall_id,p_tenant_id,p_enterprise_id,p_payload->>'code',p_payload->>'publicSlug',p_payload->>'name','智慧翼企业福利商城','disabled');
    new_version_id := gen_random_uuid()::text;
    insert into public.mall_application_versions(id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,reason,created_by_user_id,created_by_membership_id)
    values(new_version_id,p_tenant_id,p_enterprise_id,new_mall_id,1,'published',p_payload->'config',p_reason,p_actor_user_id,p_actor_membership_id);
    p_source_version_id := new_version_id;
    new_version_id := gen_random_uuid()::text;
    insert into public.mall_application_versions(id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,source_version_id,reason,created_by_user_id,created_by_membership_id)
    values(new_version_id,p_tenant_id,p_enterprise_id,new_mall_id,2,'draft',p_payload->'config',p_source_version_id,p_reason,p_actor_user_id,p_actor_membership_id);
    insert into public.mall_application_heads(mall_id,tenant_id,enterprise_id,draft_version_id,published_version_id,updated_by_user_id)
    values(new_mall_id,p_tenant_id,p_enterprise_id,new_version_id,p_source_version_id,p_actor_user_id);
    insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json)
    values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,new_mall_id,p_actor_user_id,'admin','mall.application.create','mall_application',new_mall_id,p_request_id,left(p_user_agent,300),p_payload);
    response:=jsonb_build_object('mallId',new_mall_id,'rowVersion',1,'status','created');
  else
    select * into head_row from public.mall_application_heads where mall_id=p_target_mall_id for update;
    if not found then raise exception 'MALL_APPLICATION_NOT_FOUND'; end if;
    if head_row.row_version<>p_expected_row_version then raise exception 'MALL_APPLICATION_VERSION_CONFLICT'; end if;
    select coalesce(max(version_no),0)+1 into next_version from public.mall_application_versions where mall_id=p_target_mall_id;
    new_version_id:=gen_random_uuid()::text;
    if p_action='save' then
      insert into public.mall_application_versions(id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,source_version_id,reason,created_by_user_id,created_by_membership_id)
      values(new_version_id,p_tenant_id,p_enterprise_id,p_target_mall_id,next_version,'draft',p_payload,head_row.draft_version_id,p_reason,p_actor_user_id,p_actor_membership_id);
      update public.mall_application_heads set draft_version_id=new_version_id,row_version=row_version+1,updated_by_user_id=p_actor_user_id,updated_at=now() where mall_id=p_target_mall_id;
    elsif p_action='publish' then
      select * into source_version from public.mall_application_versions where id=head_row.draft_version_id;
      insert into public.mall_application_versions(id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,source_version_id,reason,created_by_user_id,created_by_membership_id)
      values(new_version_id,p_tenant_id,p_enterprise_id,p_target_mall_id,next_version,'published',source_version.config_json,source_version.id,p_reason,p_actor_user_id,p_actor_membership_id);
      update public.mall_application_heads set published_version_id=new_version_id,row_version=row_version+1,updated_by_user_id=p_actor_user_id,updated_at=now() where mall_id=p_target_mall_id;
      update public.malls set status='active',updated_at=now() where id=p_target_mall_id;
    elsif p_action='restore' then
      select * into source_version from public.mall_application_versions where id=p_source_version_id and mall_id=p_target_mall_id;
      if not found then raise exception 'MALL_APPLICATION_HISTORY_NOT_FOUND'; end if;
      insert into public.mall_application_versions(id,tenant_id,enterprise_id,mall_id,version_no,lifecycle,config_json,source_version_id,reason,created_by_user_id,created_by_membership_id)
      values(new_version_id,p_tenant_id,p_enterprise_id,p_target_mall_id,next_version,'draft',source_version.config_json,source_version.id,p_reason,p_actor_user_id,p_actor_membership_id);
      update public.mall_application_heads set draft_version_id=new_version_id,row_version=row_version+1,updated_by_user_id=p_actor_user_id,updated_at=now() where mall_id=p_target_mall_id;
    end if;
    insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json)
    values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_target_mall_id,p_actor_user_id,'admin','mall.application.'||p_action,'mall_application',p_target_mall_id,p_request_id,left(p_user_agent,300),to_jsonb(head_row),jsonb_build_object('versionId',new_version_id,'versionNo',next_version,'reason',p_reason));
    response:=jsonb_build_object('mallId',p_target_mall_id,'versionId',new_version_id,'versionNo',next_version,'rowVersion',head_row.row_version+1,'status',p_action);
  end if;
  insert into public.idempotency_keys(tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,expires_at)
  values(p_tenant_id,p_context_mall_id,'mall_application:'||p_action,p_idempotency_key,p_request_hash,coalesce(new_mall_id,p_target_mall_id),response,now()+interval '24 hours');
  return response;
exception
  when unique_violation then
    if p_action='create' then raise exception 'MALL_APPLICATION_CODE_OR_SLUG_CONFLICT'; end if;
    raise;
end;
$$;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on (
  (r.code='enterprise_manager' and p.code in ('mall.read','mall.manage','mall.decorate','mall.publish')) or
  (r.code='mall_admin' and p.code in ('mall.read','mall.decorate','mall.publish')) or
  (r.code='test_admin' and p.code in ('mall.read','mall.decorate'))
) on conflict do nothing;

revoke all on function public.api_default_mall_application_config(text) from public,anon,authenticated;
revoke all on function public.api_mall_application_actor_access(text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.api_mall_application_center(text,text,text) from public,anon,authenticated;
revoke all on function public.api_mall_application_experience(text,text) from public,anon,authenticated;
revoke all on function public.api_mutate_mall_application(text,text,text,text,text,text,text,jsonb,bigint,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_mall_application_center(text,text,text) to service_role;
grant execute on function public.api_mall_application_experience(text,text) to service_role;
grant execute on function public.api_mutate_mall_application(text,text,text,text,text,text,text,jsonb,bigint,text,text,text,text,text,text) to service_role;
