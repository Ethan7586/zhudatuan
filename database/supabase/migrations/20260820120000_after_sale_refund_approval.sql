-- Make approval a separate, audited authority and make every refund fail closed.

insert into public.permissions (id, code, name, category, risk_level, is_mvp)
values ('permission-order-refund-approve-v1', 'order.refund.approve', '审批退款', '售后', 'critical', true)
on conflict (code) do update
set name = excluded.name, category = excluded.category,
    risk_level = excluded.risk_level, is_mvp = excluded.is_mvp;

-- Keep approval independently revocable while preserving the current role
-- assignments for operators that already own the refund responsibility.
insert into public.role_permissions (role_id, permission_id)
select distinct existing.role_id, approval.id
from public.role_permissions existing
join public.permissions refund on refund.id = existing.permission_id and refund.code = 'order.refund'
cross join public.permissions approval
where approval.code = 'order.refund.approve'
on conflict do nothing;

alter table public.after_sales
  add column if not exists requested_by_membership_id text references public.memberships(id) on delete restrict,
  add column if not exists requested_by_member_id text references public.members(id) on delete restrict,
  add column if not exists order_status_before_request text
    check (order_status_before_request in ('paid', 'processing', 'shipped', 'completed')),
  add column if not exists review_started_at timestamptz,
  add column if not exists review_started_by_membership_id text references public.memberships(id) on delete restrict,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_membership_id text references public.memberships(id) on delete restrict,
  add column if not exists migration_status text not null default 'manual_review'
    check (migration_status in ('ready', 'manual_review'));

alter table public.after_sales drop constraint if exists after_sales_ready_source_check;
alter table public.after_sales add constraint after_sales_ready_source_check check (
  migration_status = 'manual_review'
  or (
    requested_by_membership_id is not null
    and requested_by_member_id is not null
    and order_status_before_request is not null
  )
);

-- Existing rows receive the column default and therefore fail closed. Guessing
-- their submitter or former order state would mint authority or corrupt data.

create index idx_after_sales_migration_review
on public.after_sales (tenant_id, mall_id, migration_status, created_at)
where migration_status='manual_review';

create or replace function public.api_admin_after_sale_page(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null,
  p_keyword text default null, p_status text default null, p_created_from timestamptz default null,
  p_created_to timestamptz default null, p_sort text default 'created_at_desc',
  p_limit integer default 20, p_offset integer default 0
) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with filtered as (
    select after_sale.*, orders.order_no, count(*) over() as total
    from public.after_sales after_sale
    join public.orders orders on orders.id = after_sale.order_id
    where orders.tenant_id = p_tenant_id
      and orders.enterprise_id = p_enterprise_id
      and orders.mall_id = p_mall_id
      and (p_user_id is null or orders.user_id = p_user_id)
      and (
        nullif(trim(p_keyword), '') is null
        or after_sale.after_sale_no ilike '%' || trim(p_keyword) || '%'
        or orders.order_no ilike '%' || trim(p_keyword) || '%'
      )
      and (p_status is null or after_sale.status = p_status)
      and (p_created_from is null or after_sale.created_at >= p_created_from)
      and (p_created_to is null or after_sale.created_at < p_created_to)
  ), ranked as (
    select *, row_number() over (
      order by case when p_sort = 'created_at_asc' then created_at end asc,
        case when p_sort = 'payable_asc' then requested_amount_cents end asc,
        case when p_sort = 'payable_desc' then requested_amount_cents end desc,
        created_at desc, id desc
    ) as position
    from filtered
  ), paged as (
    select * from ranked
    where position > greatest(coalesce(p_offset, 0), 0)
    order by position
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', page.id,
      'afterSaleNo', page.after_sale_no,
      'orderId', page.order_id,
      'orderNo', page.order_no,
      'type', page.type,
      'status', page.status,
      'reason', page.reason,
      'requestedAmountCents', page.requested_amount_cents,
      'migrationStatus', page.migration_status,
      'reviewBlockedReason', case when page.migration_status = 'manual_review'
        then '历史售后缺少申请身份或原订单状态，需先完成受审计核对' else null end,
      'firstProductName', coalesce(
        (select item.product_name_snapshot from public.order_items item where item.id = page.order_item_id),
        (select item.product_name_snapshot from public.order_items item where item.order_id = page.order_id order by item.id limit 1),
        '订单商品'
      ),
      'createdAt', page.created_at,
      'updatedAt', page.updated_at
    ) order by page.position), '[]'::jsonb),
    'total', coalesce((select max(total) from filtered), 0),
    'limit', least(greatest(coalesce(p_limit, 20), 1), 100),
    'offset', greatest(coalesce(p_offset, 0), 0)
  ) from paged page;
$$;
revoke all on function public.api_admin_after_sale_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer)
from public,anon,authenticated;
grant execute on function public.api_admin_after_sale_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer)
to service_role;

create table public.after_sale_review_actions (
  id text primary key,
  after_sale_id text not null references public.after_sales(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  status_before text not null check (status_before in ('submitted', 'reviewing')),
  status_after text not null check (status_after in ('reviewing', 'approved', 'rejected')),
  reason text not null check (char_length(reason) between 4 and 500),
  evidence text check (char_length(evidence) <= 2000),
  actor_user_id text not null references public.users(id) on delete restrict,
  actor_membership_id text not null references public.memberships(id) on delete restrict,
  granted_via jsonb not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  check (
    (status_before = 'submitted' and status_after = 'reviewing')
    or (status_before = 'reviewing' and status_after in ('approved', 'rejected'))
  ),
  unique (after_sale_id, status_after)
);

create unique index after_sale_review_actions_one_resolution
on public.after_sale_review_actions (after_sale_id)
where status_after in ('approved', 'rejected');

create index idx_after_sale_review_actions_scope
on public.after_sale_review_actions (tenant_id, enterprise_id, mall_id, created_at desc);

alter table public.after_sale_review_actions enable row level security;
revoke all on table public.after_sale_review_actions from public, anon, authenticated;
create trigger after_sale_review_actions_immutable
before update or delete on public.after_sale_review_actions
for each row execute function public.reject_immutable_change();

create or replace function public.api_membership_has_permission(
  p_membership_id text, p_permission_code text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  with actor as (
    select membership.id
    from public.memberships membership
    join public.members member on member.id = membership.member_id
    where membership.id = p_membership_id and membership.status = 'active'
      and member.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  ), granted as (
    select permission.code
    from actor
    join public.membership_roles membership_role on membership_role.membership_id = actor.id
    join public.roles role on role.id = membership_role.role_id and role.status = 'active'
    join public.role_permissions role_permission on role_permission.role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    where membership_role.revoked_at is null
      and (membership_role.expires_at is null or membership_role.expires_at > now())
    union
    select permission.code
    from actor
    join public.membership_permission_overrides permission_override on permission_override.membership_id = actor.id
    join public.permissions permission on permission.id = permission_override.permission_id
    where permission_override.effect = 'allow' and permission_override.revoked_at is null
      and (permission_override.expires_at is null or permission_override.expires_at > now())
  ), denied as (
    select permission.code
    from actor
    join public.membership_permission_overrides permission_override on permission_override.membership_id = actor.id
    join public.permissions permission on permission.id = permission_override.permission_id
    where permission_override.effect = 'deny' and permission_override.revoked_at is null
      and (permission_override.expires_at is null or permission_override.expires_at > now())
  )
  select exists(select 1 from granted where code = p_permission_code)
    and not exists(select 1 from denied where code = p_permission_code);
$$;

create or replace function public.api_membership_actor_matches(
  p_membership_id text, p_actor_user_id text, p_target text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships membership
    join public.members member on member.id = membership.member_id
    join public.users actor on actor.id = membership.context_user_id
    where membership.id = p_membership_id and membership.context_user_id = p_actor_user_id
      and membership.target = p_target and membership.status = 'active'
      and member.status = 'active' and actor.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  );
$$;

create or replace function public.api_membership_scope_allows(
  p_membership_id text, p_tenant_id text, p_enterprise_id text, p_mall_id text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.memberships membership
    join public.members member on member.id = membership.member_id
    where membership.id = p_membership_id and membership.status = 'active'
      and member.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
      and exists (
        select 1 from public.membership_scopes scope
        where scope.membership_id = membership.id and (
          (scope.scope_kind = 'platform' and exists (
            select 1 from public.org_units platform
            where platform.id = scope.resource_id
              and platform.kind = 'platform'
              and platform.status = 'active'
          ))
          or (scope.scope_kind = 'tenant' and scope.resource_id = p_tenant_id)
          or (scope.scope_kind = 'enterprise' and scope.resource_id = p_enterprise_id)
          or (scope.scope_kind = 'mall' and scope.resource_id = p_mall_id)
          or (scope.scope_kind = 'distributor'
            and 1 = (
              select count(distinct distributor_scope.resource_id)
              from public.membership_scopes distributor_scope
              where distributor_scope.membership_id = membership.id
                and distributor_scope.scope_kind = 'distributor'
            )
            and exists (
            select 1
            from public.distributors distributor
            join public.distributor_tenants relation on relation.distributor_id = distributor.id
            where distributor.id = scope.resource_id
              and distributor.status = 'active'
              and relation.tenant_id = p_tenant_id
              and relation.status = 'active'
              and relation.starts_at <= now()
              and (relation.ends_at is null or relation.ends_at > now())
          ))
        )
      )
  );
$$;

create or replace function public.api_authorization_evidence_matches(
  p_evidence jsonb, p_membership_id text, p_permission_code text, p_require_step_up boolean
) returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_step_up_at timestamptz;
  v_authz_version integer;
  v_session_id uuid;
begin
  if jsonb_typeof(p_evidence) is distinct from 'object'
     or (p_evidence ->> 'membershipId') is distinct from p_membership_id
     or (p_evidence ->> 'permission') is distinct from p_permission_code then return false; end if;
  begin
    v_authz_version := (p_evidence ->> 'authzVersion')::integer;
    v_session_id := (p_evidence ->> 'sessionId')::uuid;
  exception when others then return false; end;
  if v_authz_version is null or v_session_id is null then return false; end if;
  perform 1
    from public.memberships membership
    join public.members member on member.id = membership.member_id
    join public.users actor on actor.id = membership.context_user_id
    join public.auth_sessions session
      on session.membership_id = membership.id
     and session.member_id = membership.member_id
    left join public.member_credentials credential
      on credential.member_id = membership.member_id
    where membership.id = p_membership_id
      and membership.status = 'active'
      and member.status = 'active'
      and actor.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
      and membership.authz_version = v_authz_version
      and session.id = v_session_id
      and session.target = membership.target
      and session.revoked_at is null
      and session.expires_at > now()
      and (
        credential.credential_version is null
        or session.credential_version is not distinct from credential.credential_version
      )
    for share of membership, member, actor, session;
  if not found then return false; end if;
  if not p_require_step_up then return true; end if;
  begin
    v_step_up_at := (p_evidence ->> 'stepUpAt')::timestamptz;
  exception when others then return false; end;
  if v_step_up_at is null then return false; end if;
  perform 1 from public.admin_step_up_challenges challenge
    join public.memberships membership on membership.id=challenge.membership_id
    where challenge.membership_id = p_membership_id
      and challenge.user_id = membership.context_user_id
      and challenge.session_id = v_session_id::text
      and challenge.status = 'verified'
      and challenge.verified_at between now() - interval '15 minutes' and now() + interval '1 minute'
      and abs(extract(epoch from challenge.verified_at - v_step_up_at)) < 2
    for share of challenge;
  return found;
end;
$$;

revoke all on function public.api_create_after_sale(text,text,text,text,text,text,text,bigint,text,text)
from service_role;

create or replace function public.api_create_after_sale_authorized(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_type text, p_reason text, p_requested_amount_cents bigint,
  p_request_id text, p_user_agent text, p_membership_id text, p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
  v_after_sale_id text;
  v_order_status text;
  v_requester_member_id text;
begin
  if not public.api_membership_actor_matches(p_membership_id, p_user_id, 'storefront')
     or not public.api_membership_has_permission(p_membership_id, 'order.create')
     or not public.api_authorization_evidence_matches(p_granted_via, p_membership_id, 'order.create', false)
     or not exists(select 1 from public.membership_scopes where membership_id=p_membership_id and scope_kind='self' and resource_id=p_user_id)
  then raise exception 'AFTER_SALE_SUBMITTER_NOT_AUTHORIZED'; end if;
  select member_id into v_requester_member_id
  from public.memberships where id = p_membership_id;
  if v_requester_member_id is null then raise exception 'AFTER_SALE_SUBMITTER_NOT_AUTHORIZED'; end if;
  select status into v_order_status from public.orders
  where id=p_order_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id
    and mall_id=p_mall_id and user_id=p_user_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_result := public.api_create_after_sale(
    p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,p_order_id,p_type,p_reason,
    p_requested_amount_cents,p_request_id,p_user_agent
  );
  v_after_sale_id := v_result #>> '{afterSale,id}';
  update public.after_sales set requested_by_membership_id=p_membership_id,
    requested_by_member_id=v_requester_member_id,order_status_before_request=v_order_status,
    migration_status='ready' where id=v_after_sale_id;
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,
    resource_id,request_id,user_agent,after_json,membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,'user',
    'after_sale.submit.authorized','after_sale',v_after_sale_id,p_request_id,
    left(coalesce(p_user_agent,''),300),jsonb_build_object('orderId',p_order_id),
    p_membership_id,p_granted_via,now()
  );
  return v_result;
end;
$$;
revoke all on function public.api_create_after_sale_authorized(text,text,text,text,text,text,text,bigint,text,text,text,jsonb)
from public,anon,authenticated;

create or replace function public.api_review_after_sale_authorized(
  p_membership_id text, p_operator_user_id text, p_after_sale_id text,
  p_transition text, p_reason text, p_evidence text, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text, p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_after_sale public.after_sales%rowtype; v_order public.orders%rowtype;
  v_locked record;
  v_existing public.idempotency_keys%rowtype; v_now timestamptz:=clock_timestamp();
  v_response jsonb; v_expected_status text; v_reviewer_member_id text; v_updated_rows integer;
begin
  if p_transition not in ('reviewing','approved','rejected')
     or char_length(trim(coalesce(p_reason,''))) not between 4 and 500
     or char_length(trim(coalesce(p_evidence,''))) > 2000
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 120
     or char_length(trim(coalesce(p_request_hash,''))) = 0 then raise exception 'INVALID_AFTER_SALE_REVIEW_INPUT'; end if;
  if not public.api_membership_actor_matches(p_membership_id,p_operator_user_id,'admin')
     or not public.api_membership_has_permission(p_membership_id,'order.refund.approve')
     or not public.api_authorization_evidence_matches(p_granted_via,p_membership_id,'order.refund.approve',true)
  then raise exception 'AFTER_SALE_REVIEWER_NOT_AUTHORIZED'; end if;
  select member_id into v_reviewer_member_id
  from public.memberships where id = p_membership_id;
  if v_reviewer_member_id is null then raise exception 'AFTER_SALE_REVIEWER_NOT_AUTHORIZED'; end if;
  select after_sale as after_sale_row, orders as order_row into v_locked
  from public.after_sales after_sale join public.orders orders on orders.id=after_sale.order_id
  where after_sale.id=p_after_sale_id for update of after_sale, orders;
  if not found then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  v_after_sale:=v_locked.after_sale_row;
  v_order:=v_locked.order_row;
  if v_after_sale.user_id<>v_order.user_id
     or v_after_sale.tenant_id<>v_order.tenant_id or v_after_sale.mall_id<>v_order.mall_id
     or not public.api_membership_scope_allows(p_membership_id,v_after_sale.tenant_id,v_order.enterprise_id,v_after_sale.mall_id)
  then raise exception 'AFTER_SALE_NOT_FOUND'; end if;
  if v_after_sale.migration_status<>'ready' then raise exception 'AFTER_SALE_HISTORY_REQUIRES_REVIEW'; end if;
  if v_after_sale.requested_by_membership_id=p_membership_id
     or v_after_sale.requested_by_member_id=v_reviewer_member_id
     or v_after_sale.user_id=p_operator_user_id
  then raise exception 'AFTER_SALE_SELF_APPROVAL_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtext(v_after_sale.mall_id||':after-sale:review:'||p_idempotency_key));
  select * into v_existing from public.idempotency_keys
  where mall_id=v_after_sale.mall_id and scope='after_sale:review'
    and idempotency_key=p_idempotency_key and expires_at>now();
  if found then
    if v_existing.request_hash is distinct from p_request_hash
       or v_existing.resource_id is distinct from v_after_sale.id
       or v_existing.tenant_id is distinct from v_after_sale.tenant_id
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if v_order.status <> 'refund_pending' then raise exception 'AFTER_SALE_ORDER_STATE_CONFLICT'; end if;
  v_expected_status:=case when p_transition='reviewing' then 'submitted' else 'reviewing' end;
  if v_after_sale.status<>v_expected_status then raise exception 'AFTER_SALE_REVIEW_TRANSITION_INVALID'; end if;
  insert into public.after_sale_review_actions (
    id,after_sale_id,tenant_id,enterprise_id,mall_id,status_before,status_after,reason,evidence,
    actor_user_id,actor_membership_id,granted_via,request_id,created_at
  ) values (
    gen_random_uuid()::text,v_after_sale.id,v_after_sale.tenant_id,v_order.enterprise_id,v_after_sale.mall_id,
    v_after_sale.status,p_transition,trim(p_reason),nullif(trim(coalesce(p_evidence,'')),''),
    p_operator_user_id,p_membership_id,p_granted_via,p_request_id,v_now
  );
  update public.after_sales set status=p_transition,updated_at=v_now,
    review_started_at=case when p_transition='reviewing' then v_now else review_started_at end,
    review_started_by_membership_id=case when p_transition='reviewing' then p_membership_id else review_started_by_membership_id end,
    resolved_at=case when p_transition in ('approved','rejected') then v_now else resolved_at end,
    resolved_by_membership_id=case when p_transition in ('approved','rejected') then p_membership_id else resolved_by_membership_id end
  where id=v_after_sale.id;
  if p_transition='rejected' and v_after_sale.order_status_before_request is not null then
    update public.orders set status=v_after_sale.order_status_before_request,updated_at=v_now
    where id=v_order.id and status='refund_pending';
    get diagnostics v_updated_rows = row_count;
    if v_updated_rows <> 1 then raise exception 'AFTER_SALE_ORDER_STATE_CONFLICT'; end if;
  end if;
  v_response:=jsonb_build_object('afterSale',jsonb_build_object(
    'id',v_after_sale.id,'afterSaleNo',v_after_sale.after_sale_no,'status',p_transition,'updatedAt',v_now
  ),'requestId',p_request_id);
  insert into public.idempotency_keys values (
    v_after_sale.tenant_id,v_after_sale.mall_id,'after_sale:review',p_idempotency_key,p_request_hash,
    v_after_sale.id,v_response,v_now,v_now+interval '24 hours'
  );
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,
    request_id,user_agent,before_json,after_json,membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,v_after_sale.tenant_id,v_order.enterprise_id,v_after_sale.mall_id,p_operator_user_id,
    'admin','after_sale.'||p_transition,'after_sale',v_after_sale.id,p_request_id,
    left(coalesce(p_user_agent,''),300),jsonb_build_object('status',v_after_sale.status),
    jsonb_build_object('status',p_transition,'reason',trim(p_reason),'evidence',nullif(trim(coalesce(p_evidence,'')),'')),
    p_membership_id,p_granted_via,v_now
  );
  return v_response;
end;
$$;
revoke all on function public.api_review_after_sale_authorized(text,text,text,text,text,text,text,text,text,text,jsonb)
from public,anon,authenticated;

-- Retire the legacy refund command instead of leaving a temporary unchecked
-- primitive or wrapper. The final approved refund command is introduced once
-- in the refund closure migration.
revoke all on function public.api_execute_internal_refund(text,text,text,text,text,bigint,text,text,text,text)
from public,anon,authenticated,service_role;
drop function public.api_execute_internal_refund(
  text,text,text,text,text,bigint,text,text,text,text);

revoke all on function public.api_membership_has_permission(text,text) from public,anon,authenticated;
revoke all on function public.api_membership_actor_matches(text,text,text) from public,anon,authenticated;
revoke all on function public.api_membership_scope_allows(text,text,text,text) from public,anon,authenticated;
revoke all on function public.api_authorization_evidence_matches(jsonb,text,text,boolean) from public,anon,authenticated;
revoke all on function public.api_create_after_sale(text,text,text,text,text,text,text,bigint,text,text) from service_role;
revoke all on function public.api_create_after_sale_authorized(text,text,text,text,text,text,text,bigint,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_review_after_sale_authorized(text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;

grant execute on function public.api_create_after_sale_authorized(text,text,text,text,text,text,text,bigint,text,text,text,jsonb) to service_role;
grant execute on function public.api_review_after_sale_authorized(text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
