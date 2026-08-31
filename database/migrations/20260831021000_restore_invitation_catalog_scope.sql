begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831020000') then
    raise exception 'RESOURCE_SCOPE_REPAIR_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831021000') then
    raise exception 'RESOURCE_SCOPE_REPAIR_ALREADY_APPLIED';
  end if;
end $precondition$;

create or replace function access.resource_scope(p_operation text,p_resource text,p_membership_id text)
returns text language plpgsql stable security definer
set search_path=access,capability,member,organization,partner,catalog,pricing,inventory,experience,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,identity,pg_temp as $function$
declare resolved text;
begin
  if p_operation='organization.stores.manage' then
    select coalesce((select id from partner.partner where id=p_resource and kind='store'),
      (select organization_id from access.membership where id=p_membership_id)) into resolved;
  elsif p_operation in('identity.invitations.create','identity.invitations.read') then
    select organization_id into resolved from access.membership where id=p_membership_id;
  elsif p_operation='identity.invitations.revoke' then
    select organization_id into resolved from identity.invitation where id=p_resource;
  elsif p_operation like 'identity.%' then
    select 'self:'||profile.principal_id into resolved from access.membership membership
    join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='storefront')
      or p_operation like 'cart.%' or p_operation like 'checkout.%' or p_operation in(
      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read','invoice.profiles.manage',
      'invoice.requests.create','invoice.requests.read','invoice.requests.cancel',
      'notification.notifications.read','notification.preferences.manage','notification.endpoints.manage') then
    select profile.id into resolved from access.membership membership
    join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_operation in('order.orders.read','order.aftersales.read','support.cases.read','support.messages.read')
      and exists(select 1 from access.membership where id=p_membership_id and client='storefront') then
    select profile.id into resolved from access.membership membership
    join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_resource is null then
    select organization_id into resolved from access.membership where id=p_membership_id;
  else
    select id into resolved from organization.organization where id=p_resource;
    if resolved is null then select id from partner.partner where id=p_resource into resolved; end if;
    if resolved is null then select id from member.profile where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from catalog.pool where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from catalog.sourcelisting where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from catalog.listing where id=p_resource into resolved; end if;
    if resolved is null then
      select listing.scope_id into resolved from catalog.sku sku
      join catalog.listing listing on listing.sku_id=sku.id
      where sku.product_id=p_resource order by listing.scope_id,listing.id limit 1;
    end if;
    if resolved is null then select scope_id from catalog.importjob where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from pricing.pricebook where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from pricing.rule where id=p_resource into resolved; end if;
    if resolved is null then select mall_id from pricing.quote where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from inventory.stockitem where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from experience.application where id=p_resource into resolved; end if;
    if resolved is null then select application.scope_id from experience.version versionrecord
      join experience.application application on application.id=versionrecord.application_id where versionrecord.id=p_resource into resolved; end if;
    if resolved is null then select mall_id from cart.cart where id=p_resource into resolved; end if;
    if resolved is null then select mall_id from checkout.session where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from ordering.orderrecord where id=p_resource into resolved; end if;
    if resolved is null then select orders.mall_id from fulfillment.fulfillmentorder fulfillment
      join ordering.orderrecord orders on orders.id=fulfillment.order_id where fulfillment.id=p_resource into resolved; end if;
    if resolved is null then select orders.mall_id from fulfillment.returnrecord returned
      join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
      join ordering.orderrecord orders on orders.id=fulfillment.order_id where returned.id=p_resource into resolved; end if;
    if resolved is null then select scope_id from verification.session where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from verification.device where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from payment.recoverycase where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from voucher.program where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from voucher.cardpool where id=p_resource into resolved; end if;
    if resolved is null then select scope_id from voucher.reserverequest where id=p_resource into resolved; end if;
    if resolved is null then select program.scope_id from voucher.issuebatch batch
      join voucher.program program on program.id=batch.program_id where batch.id=p_resource into resolved; end if;
    if resolved is null then select program.scope_id from voucher.voucher voucher
      join voucher.program program on program.id=voucher.program_id where voucher.id=p_resource into resolved; end if;
    if resolved is null then select program.scope_id from voucher.redemption redemption
      join voucher.voucher voucher on voucher.id=redemption.voucher_id
      join voucher.program program on program.id=voucher.program_id where redemption.id=p_resource into resolved; end if;
    if resolved is null then select scope_id from benefit.plan where id=p_resource into resolved; end if;
    if resolved is null then select plan.scope_id from benefit.budget budget
      join benefit.plan plan on plan.id=budget.plan_id where budget.id=p_resource into resolved; end if;
    if resolved is null then select plan.scope_id from benefit.grantbatch batch
      join benefit.plan plan on plan.id=batch.plan_id where batch.id=p_resource into resolved; end if;
    if resolved is null then select finance.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id from channel.connection where id=p_resource into resolved; end if;
    if resolved is null then select support.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select notification.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select reporting.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select risk.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id from extension.installation where id=p_resource into resolved; end if;
    if resolved is null and p_operation in(
      'access.roles.manage','access.scopes.manage','capability.assignments.manage','partner.partners.manage',
      'qualification.policies.manage','experience.applications.update','notification.templates.manage',
      'notification.announcements.manage','reporting.exports.create','risk.policies.manage',
      'verification.devices.manage','voucher.programs.manage','benefit.plans.manage','benefit.budgets.manage') then
      select organization_id into resolved from access.membership where id=p_membership_id;
    end if;
  end if;
  if resolved is null then raise exception 'RESOURCE_SCOPE_NOT_FOUND'; end if;
  return resolved;
end $function$;

revoke all on function access.resource_scope(text,text,text) from public;
grant execute on function access.resource_scope(text,text,text) to shopapp;

select runtime.record_migration_evidence('20260831021000',1,1,0,0,
  'select access.resource_scope(operation_id,resource_id,membership_id) from runtime.authorization_probe;',
  'select version,checksum from runtime.schemaversion where version=''20260831021000'';');
insert into runtime.schemaversion(version,checksum)
values('20260831021000','2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285');

do $assert$
declare candidate record; resolved text; definition text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  if position('sku.product_id=p_resource' in definition)=0
      or position('identity.invitations.create' in definition)=0
      or position('identity.invitations.read' in definition)=0
      or position('payment.intents.create' in definition)=0
      or position('versionrecord.application_id' in definition)=0 then
    raise exception 'RESOURCE_SCOPE_REPAIR_INCOMPLETE';
  end if;
  for candidate in select membership.id,membership.organization_id from access.membership membership
      where membership.status='active' and membership.client<>'storefront'
  loop
    select access.resource_scope('identity.invitations.read',null,candidate.id) into resolved;
    if resolved is distinct from candidate.organization_id then
      raise exception 'INVITATION_READ_SCOPE_INVALID:%',candidate.id;
    end if;
  end loop;
end $assert$;

commit;
