begin;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('payment.recoveries.read','payment','GET','/api/v1/payments/recoveries','1.0.0'),
  ('payment.recoveries.resolve','payment','POST','/api/v1/payments/recoveries/{caseid}/resolutions','1.0.0');

insert into runtime.event(type,version,owner,schema_ref) values
  ('payment.late.detected',1,'payment','contract://events/payment.late.detected/v1'),
  ('payment.attempt.failed',1,'payment','contract://events/payment.attempt.failed/v1'),
  ('payment.provider.observed',1,'payment','contract://events/payment.provider.observed/v1'),
  ('payment.autorefund.requested',1,'payment','contract://events/payment.autorefund.requested/v1'),
  ('payment.recovery.opened',1,'payment','contract://events/payment.recovery.opened/v1');

insert into access.permission(id,code,risk,status) values
  ('permission:94d9e8a06eeb9bbe5b56976f','payment.recovery.manage','critical','active'),
  ('permission:eaa0108ee59ed27269992296','payment.recovery.read','high','active');

insert into capability.capability(id,kind,name,version,status) values
  ('payment.recoveries.read','operation','payment.recoveries.read',1,'active'),
  ('payment.recoveries.resolve','operation','payment.recoveries.resolve',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('payment.recoveries.read','payment.recoveries.read','payment.recovery.read','operator'),
  ('payment.recoveries.resolve','payment.recoveries.resolve','payment.recovery.manage','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:payment.recoveries.read','organization-platform-root','payment.recoveries.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:payment.recoveries.resolve','organization-platform-root','payment.recoveries.resolve','enabled',null,'1970-01-01T00:00:00Z',null,0);

alter table payment.attempt add column payer_hash char(64) check(payer_hash is null or payer_hash~'^[0-9a-f]{64}$');

create index payment_attempt_intent_provider on payment.attempt(intent_id,provider,requested_at desc,id desc);
create index payment_recoverycase_scope on payment.recoverycase(scope_id,state,opened_at desc,id desc);
create index payment_recoverycase_refund on payment.recoverycase((evidence->>'refund')) where state='open' and evidence ? 'refund';
create index payment_recoveryrequest_case on payment.recoveryrequest(case_id,created_at desc,id desc);

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
    if resolved is null then select scope_id into resolved from support.case where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from notification.dispatch where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from risk.case where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from extension.installation where id=p_resource; end if;
    if resolved is null and p_operation in('access.roles.manage','access.scopes.manage','capability.assignments.manage','partner.partners.manage','qualification.policies.manage','experience.applications.update','notification.templates.manage','risk.policies.manage','verification.devices.manage','voucher.programs.manage','benefit.plans.manage','benefit.budgets.manage')
      then select organization_id into resolved from member.membership where id=p_membership_id; end if;
  end if;
  if resolved is null then raise exception 'RESOURCE_SCOPE_NOT_FOUND'; end if;
  return resolved;
end $function$;

insert into runtime.schemaversion(version,checksum)
values('20260821040000','29584248fac105f962fcd33ec22b46e40ed62e397554303109e0fe5bfd64fac4');

do $assert$
begin
  if (select count(*) from runtime.operation)<>156 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from runtime.event where type='payment.provider.observed' and version=1) then raise exception 'PAYMENT_PROVIDER_EVENT_MISSING'; end if;
  if not exists(select 1 from access.permission where code='payment.recovery.manage' and risk='critical') then raise exception 'PAYMENT_RECOVERY_PERMISSION_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821040000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
