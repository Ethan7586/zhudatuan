begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830130000') then
    raise exception 'STOREFRONT_RESOURCE_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830131000') then
    raise exception 'STOREFRONT_RESOURCE_SCOPE_ALREADY_APPLIED';
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
  elsif p_operation='identity.invitations.create' then
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
    if resolved is null then select application.scope_id into resolved from experience.version versionrecord
      join experience.application application on application.id=versionrecord.application_id where versionrecord.id=p_resource; end if;
    if resolved is null then select mall_id into resolved from cart.cart where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from checkout.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from ordering.orderrecord where id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.fulfillmentorder fulfillment
      join ordering.orderrecord orders on orders.id=fulfillment.order_id where fulfillment.id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.returnrecord returned
      join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
      join ordering.orderrecord orders on orders.id=fulfillment.order_id where returned.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.device where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from payment.recoverycase where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.program where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.cardpool where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.reserverequest where id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.issuebatch batch
      join voucher.program program on program.id=batch.program_id where batch.id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.voucher voucher
      join voucher.program program on program.id=voucher.program_id where voucher.id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.redemption redemption
      join voucher.voucher voucher on voucher.id=redemption.voucher_id
      join voucher.program program on program.id=voucher.program_id where redemption.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from benefit.plan where id=p_resource; end if;
    if resolved is null then select plan.scope_id into resolved from benefit.budget budget
      join benefit.plan plan on plan.id=budget.plan_id where budget.id=p_resource; end if;
    if resolved is null then select plan.scope_id into resolved from benefit.grantbatch batch
      join benefit.plan plan on plan.id=batch.plan_id where batch.id=p_resource; end if;
    if resolved is null then select finance.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from channel.connection where id=p_resource; end if;
    if resolved is null then select support.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select notification.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select reporting.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select risk.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from extension.installation where id=p_resource; end if;
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

select runtime.record_migration_evidence('20260830131000',0,0,0,0,
  'select access.resource_scope(operation_id,null,membership.id) from capability.operation cross join access.membership where audience=''storefront'' and membership.client=''storefront'';',
  'select operation_id,audience from capability.operation where audience=''storefront'' order by operation_id;');
insert into runtime.schemaversion(version,checksum)
values('20260830131000',encode(public.digest('20260830131000_hardcut_storefront_resource_scope','sha256'),'hex'));

do $assert$
declare membership text; memberid text; resolved text; snapshot jsonb;
begin
  if pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) like '%audience=''member''%' then
    raise exception 'LEGACY_MEMBER_AUDIENCE_RESOURCE_SCOPE_REMAINS';
  end if;
  select accessmembership.id,accessmembership.member_id into membership,memberid
  from access.membership accessmembership where accessmembership.client='storefront' and accessmembership.status='active'
  order by accessmembership.id limit 1;
  if membership is not null then
    select access.resource_scope('observability.clienterrors.create',null,membership) into resolved;
    if resolved is distinct from memberid then raise exception 'STOREFRONT_OWNER_RESOURCE_SCOPE_INVALID'; end if;
    select resource_scope into snapshot
    from access.authorization_snapshot(membership,'storefront','observability.clienterrors.create',null);
    if snapshot->>'kind'<>'owner' or snapshot->>'id'<>memberid then
      raise exception 'STOREFRONT_AUTHORIZATION_SNAPSHOT_SCOPE_INVALID';
    end if;
  end if;
end $assert$;

commit;
