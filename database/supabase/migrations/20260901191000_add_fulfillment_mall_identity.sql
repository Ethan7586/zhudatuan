begin;

alter table fulfillment.fulfillmentorder add column mall_id text;
alter table fulfillment.fulfillmentorder add column member_id text;
alter table fulfillment.fulfillmentorder add column provider_scope_id text;
alter table fulfillment.line add column mall_id text;
alter table fulfillment.milestone add column mall_id text;
alter table fulfillment.returnrecord add column mall_id text;

update fulfillment.fulfillmentorder target set mall_id=orders.mall_id,member_id=orders.member_id,provider_scope_id=orders.scope_id
from ordering.orderrecord orders where orders.id=target.order_id;
update fulfillment.line target set mall_id=parent.mall_id
from fulfillment.fulfillmentorder parent where parent.id=target.fulfillment_id;
update fulfillment.milestone target set mall_id=parent.mall_id
from fulfillment.fulfillmentorder parent where parent.id=target.fulfillment_id;
update fulfillment.returnrecord target set mall_id=parent.mall_id
from fulfillment.fulfillmentorder parent where parent.id=target.fulfillment_id;
update runtime.job job set scope_id=parent.mall_id,updated_at=clock_timestamp()
from fulfillment.fulfillmentorder parent
where job.owner='fulfillment' and job.kind in('fulfillment','tracking')
  and (job.payload->>'fulfillment'=parent.id or exists(
    select 1 from channel.provideroperation operation where operation.id=job.payload->>'operation'
      and operation.kind='order' and operation.internal_reference=parent.id))
  and job.scope_id is distinct from parent.mall_id;

do $backfill$
declare orphan_count bigint;
  conflict_count bigint;
  duplicate_count bigint;
  report jsonb;
begin
  select count(*) into orphan_count from(
    select 1 from fulfillment.fulfillmentorder target left join ordering.orderrecord orders on orders.id=target.order_id
      where orders.id is null
    union all select 1 from fulfillment.fulfillmentorder target left join ordering.suborder suborder on suborder.id=target.suborder_id
      where suborder.id is null
    union all select 1 from fulfillment.line target left join fulfillment.fulfillmentorder parent on parent.id=target.fulfillment_id
      left join ordering.line ordered on ordered.id=target.order_line_id where parent.id is null or ordered.id is null
    union all select 1 from fulfillment.milestone target left join fulfillment.fulfillmentorder parent on parent.id=target.fulfillment_id
      where parent.id is null
    union all select 1 from fulfillment.returnrecord target left join fulfillment.fulfillmentorder parent on parent.id=target.fulfillment_id
      left join ordering.aftersale aftersale on aftersale.id=target.aftersale_id where parent.id is null or aftersale.id is null
  ) orphans;

  select count(*) into conflict_count from(
    select 1 from fulfillment.fulfillmentorder target join ordering.orderrecord orders on orders.id=target.order_id
      where target.mall_id<>orders.mall_id or target.member_id<>orders.member_id or target.provider_scope_id<>orders.scope_id
    union all select 1 from fulfillment.fulfillmentorder target join ordering.suborder suborder on suborder.id=target.suborder_id
      where suborder.order_id<>target.order_id
    union all select 1 from fulfillment.line target join fulfillment.fulfillmentorder parent on parent.id=target.fulfillment_id
      join ordering.line ordered on ordered.id=target.order_line_id join ordering.orderrecord orders on orders.id=ordered.order_id
      where target.mall_id<>parent.mall_id or ordered.order_id<>parent.order_id or orders.mall_id<>parent.mall_id
    union all select 1 from fulfillment.milestone target join fulfillment.fulfillmentorder parent on parent.id=target.fulfillment_id
      where target.mall_id<>parent.mall_id
    union all select 1 from fulfillment.returnrecord target join fulfillment.fulfillmentorder parent on parent.id=target.fulfillment_id
      join ordering.aftersale aftersale on aftersale.id=target.aftersale_id
      where target.mall_id<>parent.mall_id or aftersale.order_id<>parent.order_id
  ) conflicts;

  select coalesce(sum(repeated),0) into duplicate_count from(
    select count(*)-1 repeated from fulfillment.fulfillmentorder group by id having count(*)>1
    union all select count(*)-1 from fulfillment.line group by fulfillment_id,order_line_id having count(*)>1
    union all select count(*)-1 from fulfillment.milestone group by id having count(*)>1
    union all select count(*)-1 from fulfillment.returnrecord group by id having count(*)>1
  ) duplicates;

  report:=jsonb_build_object(
    'fulfillmentorder',jsonb_build_object('total',(select count(*) from fulfillment.fulfillmentorder),
      'nullMall',(select count(*) from fulfillment.fulfillmentorder where mall_id is null),
      'nullMember',(select count(*) from fulfillment.fulfillmentorder where member_id is null),
      'nullProviderScope',(select count(*) from fulfillment.fulfillmentorder where provider_scope_id is null)),
    'line',jsonb_build_object('total',(select count(*) from fulfillment.line),'nullMall',(select count(*) from fulfillment.line where mall_id is null)),
    'milestone',jsonb_build_object('total',(select count(*) from fulfillment.milestone),'nullMall',(select count(*) from fulfillment.milestone where mall_id is null)),
    'returnrecord',jsonb_build_object('total',(select count(*) from fulfillment.returnrecord),'nullMall',(select count(*) from fulfillment.returnrecord where mall_id is null)),
    'orphans',orphan_count,'crossMallConflicts',conflict_count,'duplicateIds',duplicate_count);
  raise notice 'FULFILLMENT_MALL_BACKFILL_REPORT %',report;

  if exists(select 1 from fulfillment.fulfillmentorder where mall_id is null or member_id is null or provider_scope_id is null)
    or exists(select 1 from fulfillment.line where mall_id is null)
    or exists(select 1 from fulfillment.milestone where mall_id is null)
    or exists(select 1 from fulfillment.returnrecord where mall_id is null)
  then raise exception 'FULFILLMENT_MALL_BACKFILL_NULL'; end if;
  if orphan_count<>0 then raise exception 'FULFILLMENT_MALL_BACKFILL_ORPHAN:%',orphan_count; end if;
  if conflict_count<>0 then raise exception 'FULFILLMENT_MALL_BACKFILL_CONFLICT:%',conflict_count; end if;
  if duplicate_count<>0 then raise exception 'FULFILLMENT_MALL_BACKFILL_DUPLICATE:%',duplicate_count; end if;
end $backfill$;

alter table fulfillment.fulfillmentorder alter column mall_id set not null;
alter table fulfillment.fulfillmentorder alter column member_id set not null;
alter table fulfillment.fulfillmentorder alter column provider_scope_id set not null;
alter table fulfillment.line alter column mall_id set not null;
alter table fulfillment.milestone alter column mall_id set not null;
alter table fulfillment.returnrecord alter column mall_id set not null;

alter table fulfillment.fulfillmentorder add constraint fulfillment_order_mall_id_key unique(mall_id,id);
alter table fulfillment.line add constraint fulfillment_line_mall_key unique(mall_id,fulfillment_id,order_line_id);
alter table fulfillment.milestone add constraint fulfillment_milestone_mall_id_key unique(mall_id,id);
alter table fulfillment.milestone add constraint fulfillment_milestone_mall_event_key unique(mall_id,fulfillment_id,kind,external_id);
alter table fulfillment.returnrecord add constraint fulfillment_return_mall_id_key unique(mall_id,id);

alter table fulfillment.line add constraint fulfillment_line_mall_order_fkey foreign key(mall_id,fulfillment_id)
  references fulfillment.fulfillmentorder(mall_id,id);
alter table fulfillment.milestone add constraint fulfillment_milestone_mall_order_fkey foreign key(mall_id,fulfillment_id)
  references fulfillment.fulfillmentorder(mall_id,id);
alter table fulfillment.returnrecord add constraint fulfillment_return_mall_order_fkey foreign key(mall_id,fulfillment_id)
  references fulfillment.fulfillmentorder(mall_id,id);

alter table fulfillment.fulfillmentorder drop constraint fulfillmentorder_provider_external_reference_key;
alter table fulfillment.fulfillmentorder add constraint fulfillment_order_mall_provider_reference_key
  unique(mall_id,provider,external_reference);
alter table fulfillment.fulfillmentorder drop constraint fulfillmentorder_source_effect_id_suborder_id_key;
alter table fulfillment.fulfillmentorder add constraint fulfillment_order_mall_source_suborder_key
  unique(mall_id,source_effect_id,suborder_id);

create index fulfillment_order_mall_state on fulfillment.fulfillmentorder(mall_id,state,updated_at,id);
create index fulfillment_order_mall_order on fulfillment.fulfillmentorder(mall_id,order_id,id);
create index fulfillment_order_provider_reference_mall on fulfillment.fulfillmentorder(provider,external_reference,mall_id);
create index fulfillment_return_mall_state on fulfillment.returnrecord(mall_id,state,id);

create or replace function access.resource_scope(p_operation text,p_resource text,p_membership_id text)
returns text language plpgsql stable security definer
set search_path=access,capability,member,organization,partner,catalog,pricing,inventory,experience,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,pg_temp as $function$
declare resolved text;
begin
  if p_operation='organization.stores.manage' then
    select coalesce((select id from partner.partner where id=p_resource and kind='store'),
      (select organization_id from access.membership where id=p_membership_id)) into resolved;
  elsif p_operation='identity.invitations.create' then
    select organization_id into resolved from access.membership where id=p_membership_id;
  elsif p_operation='identity.invitations.revoke' then
    select organization_id into resolved from member.invite where id=p_resource;
  elsif p_operation like 'identity.%' then
    select 'self:'||profile.principal_id into resolved from access.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='member')
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
    if resolved is null then select scope_id into resolved from catalog.importjob where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.pricebook where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.rule where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from pricing.quote where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from inventory.stockitem where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from experience.application where id=p_resource; end if;
    if resolved is null then select application.scope_id into resolved from experience.version versionrecord join experience.application application on application.id=versionrecord.application_id where versionrecord.id=p_resource; end if;
    if resolved is null then select mall_id into resolved from cart.cart where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from checkout.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from ordering.orderrecord where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from fulfillment.fulfillmentorder where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from fulfillment.returnrecord where id=p_resource; end if;
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

insert into runtime.schemaversion(version,checksum)
values('20260901191000',encode(public.digest('fulfillment-mall-identity:v1','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from information_schema.columns where table_schema='fulfillment'
      and table_name in('fulfillmentorder','line','milestone','returnrecord') and column_name='mall_id' and is_nullable='NO')<>4
  then raise exception 'FULFILLMENT_MALL_COLUMN_INCOMPLETE'; end if;
  if (select count(*) from information_schema.columns where table_schema='fulfillment' and table_name='fulfillmentorder'
      and column_name in('member_id','provider_scope_id') and is_nullable='NO')<>2
  then raise exception 'FULFILLMENT_RECOVERY_SNAPSHOT_INCOMPLETE'; end if;
  if position('join ordering.orderrecord' in lower(pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure)))>0
      and position('fulfillment.fulfillmentorder fulfillment join ordering.orderrecord' in lower(pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure)))>0
  then raise exception 'FULFILLMENT_RESOURCE_SCOPE_ORDER_DEPENDENCY'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260901191000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
