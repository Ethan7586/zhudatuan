begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904012000') then raise exception 'ACCESS_OWNERSHIP_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904013000') or to_regclass('access.ownershiptransfer') is not null then
    raise exception 'ACCESS_OWNERSHIP_ALREADY_APPLIED';
  end if;
  if exists(select 1 from access.rolepermission group by role_id,permission_id having count(*)>1) then
    raise exception 'ACCESS_ROLE_PERMISSION_EFFECT_CONFLICT';
  end if;
end
$precondition$;

alter table access.permission add column name_zh text not null default '';
alter table access.permission add column search_text text generated always as(lower(code)||' '||name_zh) stored;
create index access_permission_search on access.permission using gin(to_tsvector('simple',search_text));
create unique index access_rolepermission_decision on access.rolepermission(role_id,permission_id);

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:access.ownership.read','access.ownership.read','high','active','查看所有权'),
  ('permission:access.ownership.transfer','access.ownership.transfer','critical','active','发起或取消所有权转移'),
  ('permission:access.ownership.accept','access.ownership.accept','critical','active','接受所有权转移');

update access.permission set name_zh=case code
  when 'access.center.read' then '查看权限中心'
  when 'access.role.manage' then '管理角色权限'
  when 'access.override.manage' then '管理成员覆盖权限'
  when 'access.scope.manage' then '管理数据范围'
  when 'access.owner.transfer' then '旧所有权转移（待退役）'
  when 'approval.read' then '查看审批'
  when 'approval.task.decide' then '处理审批任务'
  when 'approval.template.manage' then '管理审批模板'
  else name_zh end
where code like 'access.%' or code like 'approval.%';

create table access.roletemplate(
  code text primary key check(code in('malloperator','catalogoperator','ordersupport','financeoperator','financereviewer','administrator','custom')),
  name text not null check(length(name) between 2 and 80),
  description text not null check(length(description) between 4 and 300),
  allows text[] not null,
  denies text[] not null,
  state text not null check(state in('active','disabled')),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(not allows&&denies),
  check(updated_at>=created_at)
);

insert into access.roletemplate(code,name,description,allows,denies,state,version,created_at,updated_at) values
  ('malloperator','商城运营','适合维护商城内容、营销活动和日常经营数据',array['access.center.read','catalog.product.read','marketing.read','reporting.dashboard.read'],array[]::text[],'active',1,clock_timestamp(),clock_timestamp()),
  ('catalogoperator','商品运营','适合维护商品、商品池、价格和库存业务',array['access.center.read','catalog.product.read','catalog.product.manage','catalog.listing.read','pricing.offer.read','inventory.read'],array[]::text[],'active',1,clock_timestamp(),clock_timestamp()),
  ('ordersupport','订单客服','适合查询订单、履约、售后和客服工单',array['access.center.read','order.read','support.case.read','fulfillment.read'],array['payment.refund'],'active',1,clock_timestamp(),clock_timestamp()),
  ('financeoperator','财务经办','适合账单、对账和提现申请等财务经办工作',array['finance.overview.read','finance.statement.read','finance.reconciliation.manage','finance.withdrawal.create'],array['finance.settlement.decide','finance.withdrawal.decide'],'active',1,clock_timestamp(),clock_timestamp()),
  ('financereviewer','财务复核','适合复核结算和财务修复，不包含经办及提现复核权限',array['finance.overview.read','finance.statement.read','finance.settlement.decide','finance.repair.decide'],array['finance.reconciliation.manage','finance.withdrawal.create','finance.withdrawal.decide'],'active',1,clock_timestamp(),clock_timestamp()),
  ('administrator','管理员','适合成员、角色、范围和常规系统配置管理',array['access.center.read','access.role.manage','access.scope.manage','capability.assignment.read'],array['access.ownership.accept'],'active',1,clock_timestamp(),clock_timestamp()),
  ('custom','自定义','从空权限集合开始，只在高级模式中逐项配置',array[]::text[],array[]::text[],'active',1,clock_timestamp(),clock_timestamp());

alter table access.role add column description text not null default '';
alter table access.role add column template_code text references access.roletemplate(code);

insert into access.rolepermission(role_id,permission_id,effect)
select mapping.role_id,replacement.id,mapping.effect
from access.rolepermission mapping join access.permission legacy on legacy.id=mapping.permission_id and legacy.code='access.owner.transfer'
cross join access.permission replacement
where replacement.code in('access.ownership.read','access.ownership.transfer','access.ownership.accept')
on conflict(role_id,permission_id) do update set effect=excluded.effect;

create table access.separationrule(
  id text primary key check(id~'^separationrule:'),
  left_permission text not null references access.permission(code),
  right_permission text not null references access.permission(code),
  reason text not null check(length(reason) between 4 and 200),
  state text not null check(state in('active','disabled')),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(left_permission,right_permission),
  check(left_permission<right_permission),
  check(updated_at>=created_at)
);

insert into access.separationrule(id,left_permission,right_permission,reason,state,version,created_at,updated_at)
select 'separationrule:'||replace(left_permission,'.','-')||':'||replace(right_permission,'.','-'),
  left_permission,right_permission,reason,'active',1,clock_timestamp(),clock_timestamp()
from (values
  ('finance.settlement.decide','finance.withdrawal.decide','结算审核与提现审核必须职责分离'),
  ('voucher.cardlibrary.create','voucher.issue','卡库存创建与卡券发放必须职责分离'),
  ('finance.repair.decide','payment.refund','退款执行与财务修复审核必须职责分离')
) rule(left_permission,right_permission,reason)
where exists(select 1 from access.permission where code=left_permission)
  and exists(select 1 from access.permission where code=right_permission);

delete from access.rolepermission mapping
using access.permission permission,access.separationrule rule
where mapping.permission_id=permission.id and mapping.effect='allow' and permission.code=rule.right_permission
  and rule.state='active' and exists(
    select 1 from access.rolepermission paired join access.permission leftpermission on leftpermission.id=paired.permission_id
    where paired.role_id=mapping.role_id and paired.effect='allow' and leftpermission.code=rule.left_permission
  );

create function access.assert_role_separation()
returns trigger language plpgsql security definer set search_path=access,pg_temp set row_security=on as $function$
declare affected text:=coalesce(new.role_id,old.role_id);
begin
  if exists(
    select 1 from access.separationrule rule
    where rule.state='active'
      and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=affected and mapping.effect='allow' and permission.code=rule.left_permission)
      and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=affected and mapping.effect='allow' and permission.code=rule.right_permission)
  ) then raise exception 'ACCESS_SEPARATION_REQUIRED'; end if;
  return null;
end
$function$;

create constraint trigger access_role_separation after insert or update or delete on access.rolepermission
deferrable initially deferred for each row execute function access.assert_role_separation();

create table access.ownershiptransfer(
  id text primary key check(id~'^ownershiptransfer:'),
  tenant_id text not null,
  scope_id text not null,
  role_id text not null references access.role(id),
  source_membership_id text not null references access.membership(id),
  target_membership_id text not null references access.membership(id),
  former_owner_mode text not null check(former_owner_mode in('retain_admin','remove_admin')),
  former_owner_role_id text references access.role(id),
  former_owner_role_version bigint check(former_owner_role_version is null or former_owner_role_version>0),
  ownership_version bigint not null check(ownership_version>0),
  target_access_version bigint not null check(target_access_version>0),
  source_proof_id text,
  target_proof_id text,
  cancel_proof_id text,
  state text not null check(state in('draft','pending','accepted','cancelled','expired')),
  reason text not null check(length(reason) between 4 and 500),
  cancellation_reason text check(cancellation_reason is null or length(cancellation_reason) between 4 and 500),
  version bigint not null check(version>0),
  cooling_until timestamptz not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(id,tenant_id,scope_id),
  check(source_membership_id<>target_membership_id),
  check((former_owner_mode='retain_admin')=(former_owner_role_id is not null)),
  check((former_owner_mode='retain_admin')=(former_owner_role_version is not null)),
  check(cooling_until between created_at+interval '23 hours 59 minutes' and created_at+interval '24 hours 1 minute'),
  check(expires_at between created_at+interval '6 days 23 hours 59 minutes' and created_at+interval '7 days 1 minute'),
  check(cooling_until<expires_at),
  check(updated_at>=created_at),
  check((state='draft' and source_proof_id is null and target_proof_id is null and cancel_proof_id is null)
    or (state='pending' and source_proof_id is not null and target_proof_id is null and cancel_proof_id is null)
    or (state='accepted' and source_proof_id is not null and target_proof_id is not null and cancel_proof_id is null and accepted_at is not null)
    or (state='cancelled' and source_proof_id is not null and target_proof_id is null and cancel_proof_id is not null and cancelled_at is not null)
    or (state='expired' and source_proof_id is not null and target_proof_id is null and cancel_proof_id is null and expired_at is not null))
);

create unique index access_ownershiptransfer_active on access.ownershiptransfer(scope_id) where state in('draft','pending');
create index access_ownershiptransfer_participant on access.ownershiptransfer(scope_id,source_membership_id,target_membership_id,state,created_at desc,id);
create index access_ownershiptransfer_expiry on access.ownershiptransfer(expires_at,id) include(scope_id,source_membership_id,target_membership_id,version) where state='pending';

create table access.ownershipproof(
  id text primary key check(id~'^ownershipproof:'),
  tenant_id text not null,
  scope_id text not null,
  transfer_id text not null,
  stage text not null check(stage in('source','target','cancel')),
  actor_membership_id text not null references access.membership(id),
  token_hash bytea not null unique check(octet_length(token_hash)=32),
  consumed_at timestamptz not null,
  created_at timestamptz not null,
  foreign key(transfer_id,tenant_id,scope_id) references access.ownershiptransfer(id,tenant_id,scope_id) deferrable initially deferred,
  unique(transfer_id,stage),
  check(consumed_at>=created_at)
);

alter table access.ownershiptransfer
  add constraint ownershiptransfer_source_proof foreign key(source_proof_id) references access.ownershipproof(id) deferrable initially deferred,
  add constraint ownershiptransfer_target_proof foreign key(target_proof_id) references access.ownershipproof(id) deferrable initially deferred,
  add constraint ownershiptransfer_cancel_proof foreign key(cancel_proof_id) references access.ownershipproof(id) deferrable initially deferred;

create index access_ownershipproof_scope on access.ownershipproof(scope_id,transfer_id,stage) include(actor_membership_id,consumed_at);

create table access.ownershiptimeline(
  id text primary key check(id~'^ownershiptimeline:'),
  tenant_id text not null,
  scope_id text not null,
  transfer_id text not null,
  previous_state text check(previous_state is null or previous_state in('draft','pending','accepted','cancelled','expired')),
  state text not null check(state in('draft','pending','accepted','cancelled','expired')),
  actor_membership_id text not null,
  reason text not null check(length(reason) between 3 and 500),
  version bigint not null check(version>0),
  occurred_at timestamptz not null,
  foreign key(transfer_id,tenant_id,scope_id) references access.ownershiptransfer(id,tenant_id,scope_id) deferrable initially deferred,
  unique(transfer_id,version)
);

create index access_ownershiptimeline_page on access.ownershiptimeline(scope_id,transfer_id,occurred_at,id) include(previous_state,state,actor_membership_id,version);

create function access.guard_ownership_transfer()
returns trigger language plpgsql as $function$
begin
  if old.state in('accepted','cancelled','expired') and new.state<>old.state then raise exception 'OWNER_TRANSFER_STATE_INVALID'; end if;
  if (old.state='draft' and new.state<>'pending')
    or (old.state='pending' and new.state not in('accepted','cancelled','expired')) then raise exception 'OWNER_TRANSFER_STATE_INVALID'; end if;
  if new.id<>old.id or new.tenant_id<>old.tenant_id or new.scope_id<>old.scope_id or new.role_id<>old.role_id
    or new.source_membership_id<>old.source_membership_id or new.target_membership_id<>old.target_membership_id
    or new.former_owner_mode<>old.former_owner_mode or new.former_owner_role_id is distinct from old.former_owner_role_id
    or new.former_owner_role_version is distinct from old.former_owner_role_version
    or new.ownership_version<>old.ownership_version or new.target_access_version<>old.target_access_version
    or (old.state<>'draft' and new.source_proof_id is distinct from old.source_proof_id) or new.created_by<>old.created_by or new.created_at<>old.created_at
    or new.cooling_until<>old.cooling_until or new.expires_at<>old.expires_at then raise exception 'OWNER_TRANSFER_BINDING_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'OWNER_TRANSFER_VERSION_INVALID'; end if;
  return new;
end
$function$;

create trigger ownershiptransfer_transition before update on access.ownershiptransfer
for each row execute function access.guard_ownership_transfer();

create function access.guard_ownership_evidence()
returns trigger language plpgsql as $function$
begin
  raise exception 'OWNERSHIP_EVIDENCE_IMMUTABLE';
end
$function$;

create trigger ownershipproof_immutable before update or delete on access.ownershipproof
for each row execute function access.guard_ownership_evidence();
create trigger ownershiptimeline_immutable before update or delete on access.ownershiptimeline
for each row execute function access.guard_ownership_evidence();

create or replace function access.resource_scope(p_operation text,p_resource text,p_membership_id text)
returns text language plpgsql stable security definer
set search_path=access,capability,member,organization,partner,catalog,pricing,inventory,experience,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,identity,pg_temp as $function$
declare resolved text;
begin
  if p_operation like 'access.ownership.transfers.%' and p_resource like 'ownershiptransfer:%' then
    select scope_id into resolved from access.ownershiptransfer where id=p_resource;
  elsif p_operation='organization.stores.manage' then
    select coalesce((select id from partner.partner where id=p_resource and kind='store'),
      (select organization_id from access.membership where id=p_membership_id)) into resolved;
  elsif p_operation in('identity.invitations.create','identity.invitations.read') then
    select organization_id into resolved from access.membership where id=p_membership_id;
  elsif p_operation='identity.invitations.revoke' then
    select organization_id into resolved from identity.invitation where id=p_resource;
  elsif p_operation='identity.members.manage' then
    select organization_id into resolved from access.membership where id=p_resource;
  elsif p_operation like 'identity.%' then
    select 'self:'||profile.principal_id into resolved from access.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='storefront')
      or p_operation like 'cart.%' or p_operation like 'checkout.%' or p_operation in(
      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read','invoice.profiles.manage',
      'invoice.requests.create','invoice.requests.read','invoice.requests.cancel',
      'notification.notifications.read','notification.preferences.manage','notification.endpoints.manage') then
    select profile.id into resolved from access.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_operation in('order.orders.read','order.aftersales.read','support.cases.read','support.messages.read')
      and exists(select 1 from access.membership where id=p_membership_id and client='storefront') then
    select profile.id into resolved from access.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_resource is null then select organization_id into resolved from access.membership where id=p_membership_id;
  else
    select id into resolved from organization.organization where id=p_resource;
    if resolved is null then select id into resolved from partner.partner where id=p_resource; end if;
    if resolved is null then select id into resolved from member.profile where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.pool where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.sourcelisting where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.listing where id=p_resource; end if;
    if resolved is null then
      select listing.scope_id into resolved from catalog.sku sku
      join catalog.listing listing on listing.sku_id=sku.id
      where sku.product_id=p_resource order by listing.scope_id,listing.id limit 1;
    end if;
    if resolved is null then select scope_id into resolved from catalog.importjob where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.pricebook where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.rule where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from pricing.quote where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from inventory.stockitem where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from experience.application where id=p_resource; end if;
    if resolved is null then select application.scope_id into resolved from experience.version versionrecord
      join experience.application application on application.id=versionrecord.application_id where versionrecord.id=p_resource; end if;
    if resolved is null then select mall_id into resolved from cart.cart where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from checkout.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from ordering.orderrecord where id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.fulfillmentorder fulfillment join ordering.orderrecord orders on orders.id=fulfillment.order_id where fulfillment.id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id join ordering.orderrecord orders on orders.id=fulfillment.order_id where returned.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.device where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from payment.recoverycase where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.program where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.cardpool where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.reserverequest where id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.issuebatch batch join voucher.program program on program.id=batch.program_id where batch.id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.voucher voucher join voucher.program program on program.id=voucher.program_id where voucher.id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id join voucher.program program on program.id=voucher.program_id where redemption.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from benefit.plan where id=p_resource; end if;
    if resolved is null then select plan.scope_id into resolved from benefit.budget budget join benefit.plan plan on plan.id=budget.plan_id where budget.id=p_resource; end if;
    if resolved is null then select plan.scope_id into resolved from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id where batch.id=p_resource; end if;
    if resolved is null then select finance.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from channel.connection where id=p_resource; end if;
    if resolved is null then select support.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select notification.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select reporting.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select risk.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from extension.installation where id=p_resource; end if;
    if resolved is null and p_operation in('access.roles.manage','access.scopes.manage','capability.assignments.manage','partner.partners.manage','qualification.policies.manage','experience.applications.update','notification.templates.manage','notification.announcements.manage','reporting.exports.create','risk.policies.manage','verification.devices.manage','voucher.programs.manage','benefit.plans.manage','benefit.budgets.manage')
      then select organization_id into resolved from access.membership where id=p_membership_id; end if;
  end if;
  if resolved is null then raise exception 'RESOURCE_SCOPE_NOT_FOUND'; end if;
  return resolved;
end $function$;

revoke all on function access.resource_scope(text,text,text) from public;
grant execute on function access.resource_scope(text,text,text) to shopapp;

create or replace function identity.resolve_session(p_token_hash text)
returns table(
  actor_id text,
  session_id text,
  membership_id text,
  credential_version bigint,
  access_version bigint,
  target text,
  assurance_level smallint,
  assurance_verified_at timestamptz
)
language sql stable security definer
set search_path=identity,member,access,pg_temp as $function$
  select session.principal_id,session.id,session.membership_id,session.credential_version,session.access_version,
    case session.client when 'operator' then 'console' else session.client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null then stepup.verified_at else null end
  from identity.session session
  join identity.principal principal on principal.id=session.principal_id
  join member.profile profile on profile.principal_id=session.principal_id
  join access.membership membership on membership.id=session.membership_id and membership.member_id=profile.id
  left join lateral (
    select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1
  ) phone on true
  left join lateral (
    select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.level>=3
      and evidence.verified_at<=clock_timestamp() and (evidence.expires_at is null or evidence.expires_at>clock_timestamp())
    order by evidence.level desc,evidence.verified_at desc limit 1
  ) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version and session.access_version=membership.access_version
    and principal.status='active' and membership.status='active'
$function$;

do $security$
declare target text;
begin
  foreach target in array array['roletemplate','separationrule','ownershiptransfer','ownershipproof','ownershiptimeline'] loop
    execute format('alter table access.%I enable row level security',target);
    execute format('alter table access.%I force row level security',target);
    execute format('revoke all on table access.%I from public',target);
  end loop;
  create policy separationruleapp on access.separationrule for select to shopapp using(true);
  create policy separationrulejob on access.separationrule for select to shopjob using(true);
  create policy migrationaccess on access.separationrule for all to shopmigration using(true) with check(true);
  create policy roletemplateapp on access.roletemplate for select to shopapp using(true);
  create policy roletemplatejob on access.roletemplate for select to shopjob using(true);
  create policy migrationaccess on access.roletemplate for all to shopmigration using(true) with check(true);
  create policy ownershiptransferapp on access.ownershiptransfer for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
  create policy ownershiptransferjob on access.ownershiptransfer for all to shopjob using(true) with check(true);
  create policy ownershipproofapp on access.ownershipproof for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
  create policy ownershipproofjob on access.ownershipproof for all to shopjob using(true) with check(true);
  create policy ownershiptimelineapp on access.ownershiptimeline for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
  create policy ownershiptimelinejob on access.ownershiptimeline for all to shopjob using(true) with check(true);
end
$security$;

revoke all on function access.assert_role_separation(),access.guard_ownership_transfer(),access.guard_ownership_evidence() from public;
grant select on access.separationrule to shopapp,shopjob,shopaccessreader;
grant select on access.roletemplate to shopapp,shopjob,shopaccessreader;
grant select,insert,update on access.ownershiptransfer to shopapp,shopjob,shopaccesswriter;
grant select,insert on access.ownershipproof,access.ownershiptimeline to shopapp,shopjob,shopaccesswriter;

delete from capability.entitlement where capability_id='access.owners.transfer';
delete from capability.dependency where capability_id='access.owners.transfer' or depends_on_id='access.owners.transfer';
delete from capability.operation where operation_id='access.owners.transfer';
delete from capability.capability where id='access.owners.transfer';
delete from runtime.operation where id='access.owners.transfer';
delete from access.rolepermission where permission_id=(select id from access.permission where code='access.owner.transfer');
delete from access.permission where code='access.owner.transfer';

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('access.ownership.read','access','GET','/api/v1/access/ownership','5.0.0'),
  ('access.ownership.transfers.preview','access','POST','/api/v1/access/ownership/transfers/preview','5.0.0'),
  ('access.ownership.transfers.create','access','POST','/api/v1/access/ownership/transfers','5.0.0'),
  ('access.ownership.transfers.accept.preview','access','POST','/api/v1/access/ownership/transfers/{transferid}/accept/preview','5.0.0'),
  ('access.ownership.transfers.accept','access','POST','/api/v1/access/ownership/transfers/{transferid}/accept','5.0.0'),
  ('access.ownership.transfers.cancel.preview','access','POST','/api/v1/access/ownership/transfers/{transferid}/cancel/preview','5.0.0'),
  ('access.ownership.transfers.cancel','access','POST','/api/v1/access/ownership/transfers/{transferid}/cancel','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('access.ownership.read','operation','access.ownership.read',1,'active'),
  ('access.ownership.transfers.preview','operation','access.ownership.transfers.preview',1,'active'),
  ('access.ownership.transfers.create','operation','access.ownership.transfers.create',1,'active'),
  ('access.ownership.transfers.accept.preview','operation','access.ownership.transfers.accept.preview',1,'active'),
  ('access.ownership.transfers.accept','operation','access.ownership.transfers.accept',1,'active'),
  ('access.ownership.transfers.cancel.preview','operation','access.ownership.transfers.cancel.preview',1,'active'),
  ('access.ownership.transfers.cancel','operation','access.ownership.transfers.cancel',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('access.ownership.read','access.ownership.read','access.ownership.read','console'),
  ('access.ownership.transfers.preview','access.ownership.transfers.preview','access.ownership.transfer','console'),
  ('access.ownership.transfers.create','access.ownership.transfers.create','access.ownership.transfer','console'),
  ('access.ownership.transfers.accept.preview','access.ownership.transfers.accept.preview','access.ownership.accept','console'),
  ('access.ownership.transfers.accept','access.ownership.transfers.accept','access.ownership.accept','console'),
  ('access.ownership.transfers.cancel.preview','access.ownership.transfers.cancel.preview','access.ownership.transfer','console'),
  ('access.ownership.transfers.cancel','access.ownership.transfers.cancel','access.ownership.transfer','console');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id like 'access.ownership.%'
on conflict(scope_id,capability_id,effective_at) do update set state='enabled',expires_at=null,version=capability.entitlement.version+1;

insert into runtime.event(type,version,owner,schema_ref) values
  ('access.owner.transfer.initiated',1,'access','contract://events/access.owner.transfer.initiated/v1'),
  ('access.owner.transfer.cancelled',1,'access','contract://events/access.owner.transfer.cancelled/v1'),
  ('access.owner.transfer.expired',1,'access','contract://events/access.owner.transfer.expired/v1');

select runtime.record_migration_evidence(
  '20260904013000',5,5,0,0,
  'select state,count(*) from access.ownershiptransfer group by state; select stage,count(*) from access.ownershipproof group by stage;',
  'select count(*) pending from access.ownershiptransfer where state=''pending''; select count(*) role_conflicts from access.rolepermission group by role_id,permission_id having count(*)>1;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904013000',encode(public.digest('20260904013000_prepare_access_ownership','sha256'),'hex'));

do $assert$
begin
  if not exists(select 1 from access.permission where code='access.ownership.read' and name_zh='查看所有权')
    or not exists(select 1 from pg_indexes where schemaname='access' and indexname='access_permission_search') then
    raise exception 'ACCESS_PERMISSION_SEARCH_INVALID';
  end if;
  if exists(select 1 from access.rolepermission group by role_id,permission_id having count(*)>1) then
    raise exception 'ACCESS_ROLE_PERMISSION_EFFECT_CONFLICT';
  end if;
  if not exists(select 1 from pg_constraint where conname='ownershiptransfer_source_proof')
    or not exists(select 1 from pg_trigger where tgname='ownershiptransfer_transition') then
    raise exception 'ACCESS_OWNERSHIP_CONTRACT_INVALID';
  end if;
  if position('access.ownershiptransfer' in pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure))=0 then
    raise exception 'ACCESS_OWNERSHIP_RESOURCE_SCOPE_INVALID';
  end if;
  if position('session.access_version=membership.access_version' in replace(pg_get_functiondef('identity.resolve_session(text)'::regprocedure),' ',''))=0 then
    raise exception 'ACCESS_VERSION_SESSION_INVALIDATION_MISSING';
  end if;
  if exists(select 1 from runtime.operation where id='access.owners.transfer')
    or (select count(*) from runtime.operation where id like 'access.ownership.%')<>7 then
    raise exception 'ACCESS_OWNERSHIP_HARDCUT_INVALID';
  end if;
end
$assert$;

commit;
