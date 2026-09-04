begin;

alter table pricing.quote
  add column dependencies jsonb not null default '{}'::jsonb check(jsonb_typeof(dependencies)='object'),
  add column signed_payload jsonb not null default '{}'::jsonb check(jsonb_typeof(signed_payload)='object'),
  add column signature char(64) not null default repeat('0',64) check(signature~'^[0-9a-f]{64}$');
alter table pricing.quote alter column dependencies drop default,alter column signed_payload drop default,alter column signature drop default;

alter table checkout.session add column input jsonb not null default '{}'::jsonb check(jsonb_typeof(input)='object');
alter table checkout.session alter column input drop default;
alter table checkout.evidence drop constraint evidence_kind_check;
alter table checkout.evidence add constraint evidence_kind_check check(kind in(
  'cart','profile','address','invoice','experience','qualification','pricing','marketing','vouchers','benefits','inventory','delivery'
));

alter table ordering.orderrecord
  add column address_snapshot jsonb not null default 'null'::jsonb,
  add column invoice_snapshot jsonb not null default 'null'::jsonb,
  add column delivery_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(delivery_snapshot)='object'),
  add column experience_version text;
alter table ordering.line
  add column partner_id text,
  add column discount_minor bigint not null default 0 check(discount_minor>=0 and discount_minor<=total_minor),
  add column payable_minor bigint generated always as(total_minor-discount_minor) stored,
  add column evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object');
create sequence ordering.order_number_seq as bigint start with 1;

alter table payment.intent drop constraint intent_amount_minor_check;
alter table payment.intent add constraint intent_amount_minor_check check(amount_minor>=0);
alter table payment.payment drop constraint payment_amount_minor_check;
alter table payment.payment add constraint payment_amount_minor_check check(amount_minor>=0);
alter table payment.refund add column aftersale_id text references ordering.aftersale(id);
create unique index payment_refund_aftersale on payment.refund(aftersale_id) where aftersale_id is not null;
create table payment.intenttender(
  intent_id text not null references payment.intent(id) on delete cascade,
  sequence integer not null check(sequence>0),
  kind text not null check(kind in('wechat','benefit','voucher')),
  reference_id text,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('planned','held','captured','released')),
  primary key(intent_id,sequence),
  unique(intent_id,kind,reference_id),
  check((kind='wechat' and reference_id is null) or (kind<>'wechat' and reference_id is not null))
);
insert into payment.tender(id,kind,provider,currency,status) values('tender:wechat','wechat','wechat','CNY','active')
on conflict(id) do update set kind='wechat',provider='wechat',currency='CNY',status='active';
create index payment_intenttender_reference on payment.intenttender(kind,reference_id) where state in('planned','held');
create unique index payment_intenttender_wechat on payment.intenttender(intent_id) where kind='wechat';
alter table payment.intenttender enable row level security;
create policy appscope on payment.intenttender for all to shopapp
  using(exists(select 1 from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id
    where intent.id=intent_id and access.scope_allowed(orders.scope_id)))
  with check(exists(select 1 from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id
    where intent.id=intent_id and access.scope_allowed(orders.scope_id)));
create policy jobscope on payment.intenttender for all to shopjob using(true) with check(true);
grant select,insert,update,delete on payment.intenttender to shopapp,shopjob;

create table payment.refundtender(
  refund_id text not null references payment.refund(id) on delete cascade,
  sequence integer not null check(sequence>0),
  kind text not null check(kind in('wechat','benefit','voucher')),
  reference_id text,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('planned','processing','succeeded','failed')),
  provider_reference text,
  primary key(refund_id,sequence),
  unique(refund_id,kind,reference_id),
  check((kind='wechat' and reference_id is null) or (kind<>'wechat' and reference_id is not null))
);
create index payment_refundtender_reference on payment.refundtender(kind,reference_id,state);
create unique index payment_refundtender_wechat on payment.refundtender(refund_id) where kind='wechat';
alter table payment.refundtender enable row level security;
create policy appscope on payment.refundtender for all to shopapp
  using(exists(select 1 from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
    join payment.intent intent on intent.id=payment.intent_id join ordering.orderrecord orders on orders.id=intent.order_id
    where refund.id=refund_id and access.scope_allowed(orders.scope_id)))
  with check(exists(select 1 from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
    join payment.intent intent on intent.id=payment.intent_id join ordering.orderrecord orders on orders.id=intent.order_id
    where refund.id=refund_id and access.scope_allowed(orders.scope_id)));
create policy jobscope on payment.refundtender for all to shopjob using(true) with check(true);
grant select,insert,update,delete on payment.refundtender to shopapp,shopjob;

alter table voucher.reversal add column reference_id text;
update voucher.reversal set reference_id=id where reference_id is null;
alter table voucher.reversal alter column reference_id set not null;
alter table voucher.reversal drop constraint reversal_redemption_id_key;
alter table voucher.reversal add unique(redemption_id,reference_id);
grant usage,select on all sequences in schema ordering to shopapp,shopjob;

insert into runtime.event(type,version,owner,schema_ref) values
  ('checkout.quote.created',1,'checkout','contract://events/checkout.quote.created/v1'),
  ('checkout.quote.confirmed',1,'checkout','contract://events/checkout.quote.confirmed/v1'),
  ('inventory.stock.reserved',1,'inventory','contract://events/inventory.stock.reserved/v1');

delete from capability.entitlement where capability_id='checkout.quote.confirm';
delete from capability.dependency where capability_id='checkout.quote.confirm' or depends_on_id='checkout.quote.confirm';
delete from capability.capability where id='checkout.quote.confirm';
delete from runtime.operation where id='checkout.quote.confirm';
delete from access.rolepermission where permission_id in(select id from access.permission where code='checkout.confirm');
delete from access.membershipoverride where permission_id in(select id from access.permission where code='checkout.confirm');
delete from access.permission where code='checkout.confirm';

insert into runtime.operation(id,owner,method,path,contract_version)
values('invoice.profiles.read','finance','GET','/api/v1/invoices/profiles','1.0.0');
insert into access.permission(id,code,risk,status)
values('permission:a28f1dca10025bbac8ecb8a6','invoice.profile.read','elevated','active');
insert into access.rolepermission(role_id,permission_id,effect)
values('role:self','permission:a28f1dca10025bbac8ecb8a6','allow') on conflict do nothing;
insert into capability.capability(id,kind,name,version,status)
values('invoice.profiles.read','operation','invoice.profiles.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('invoice.profiles.read','invoice.profiles.read','invoice.profile.read','member');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:invoice.profiles.read','organization-platform-root','invoice.profiles.read','enabled',null,'1970-01-01T00:00:00Z',null,0);

create or replace function access.resource_scope(p_operation text,p_resource text,p_membership_id text)
returns text language plpgsql stable security definer
set search_path=access,capability,member,organization,partner,catalog,pricing,inventory,experience,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,pg_temp as $function$
declare resolved text;
begin
  if p_operation like 'identity.%' then
    select 'self:'||profile.principal_id into resolved from member.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='member')
      or p_operation like 'cart.%' or p_operation like 'checkout.%' or p_operation in(
      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read','invoice.profiles.manage',
      'invoice.requests.create','invoice.requests.read','invoice.requests.cancel',
      'notification.notifications.read','notification.preferences.manage','notification.endpoints.manage') then
    select profile.id into resolved from member.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_operation in('order.orders.read','order.aftersales.read','support.cases.read','support.messages.read')
      and exists(select 1 from member.membership where id=p_membership_id and client='storefront') then
    select profile.id into resolved from member.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_resource is null then select organization_id into resolved from member.membership where id=p_membership_id;
  else
    select id into resolved from organization.organization where id=p_resource;
    if resolved is null then select id into resolved from partner.partner where id=p_resource; end if;
    if resolved is null then select id into resolved from member.profile where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.pool where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.sourcelisting where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.listing where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.importjob where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.pricebook where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.rule where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from pricing.quote where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from inventory.stockitem where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from experience.application where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from cart.cart where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from checkout.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from ordering.orderrecord where id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.fulfillmentorder fulfillment join ordering.orderrecord orders on orders.id=fulfillment.order_id where fulfillment.id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id join ordering.orderrecord orders on orders.id=fulfillment.order_id where returned.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.device where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from channel.connection where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from support.case where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from notification.dispatch where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from risk.case where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from extension.installation where id=p_resource; end if;
    if resolved is null and p_operation in('access.roles.manage','access.scopes.manage','capability.assignments.manage','partner.partners.manage','qualification.policies.manage','experience.applications.update','notification.templates.manage','risk.policies.manage','verification.devices.manage')
      then select organization_id into resolved from member.membership where id=p_membership_id; end if;
  end if;
  if resolved is null then raise exception 'RESOURCE_SCOPE_NOT_FOUND'; end if;
  return resolved;
end $function$;

insert into runtime.schemaversion(version,checksum)
values('20260821039000','bb58f95c5bf6f1da4917b35caaf6bd7bd22362d9ffb3f1638c030996763cbb57');

do $assert$
begin
  if exists(select 1 from runtime.operation where id='checkout.quote.confirm') then raise exception 'DUPLICATE_CHECKOUT_CONFIRM_REMAINS'; end if;
  if (select count(*) from runtime.operation)<>154 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if to_regclass('payment.intenttender') is null then raise exception 'PAYMENT_TENDER_PLAN_MISSING'; end if;
  if to_regclass('payment.refundtender') is null then raise exception 'PAYMENT_REFUND_PLAN_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821039000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
