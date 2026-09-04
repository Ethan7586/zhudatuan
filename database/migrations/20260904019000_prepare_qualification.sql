begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904018000') then raise exception 'QUALIFICATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904019000') then raise exception 'QUALIFICATION_ALREADY_APPLIED'; end if;
end
$precondition$;

create table qualification.qualificationcase(
  id text primary key check(id~'^qualification:[A-Za-z0-9][A-Za-z0-9.:/-]{0,241}$'),
  scope_id text not null,
  title text not null check(length(btrim(title)) between 1 and 255),
  subject_kind text not null check(subject_kind in('partner','product','category','region')),
  subject_id text not null check(subject_id~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$'),
  state text not null check(state in('draft','verified','published','revoked','expired')),
  version bigint not null check(version>=0),
  effective_at timestamptz not null,
  expires_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by text,
  published_at timestamptz,
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(expires_at>effective_at),
  check((reviewed_at is null)=(reviewed_by is null)),
  check(state='draft' or (reviewed_at is not null and reviewed_by is not null)),
  check(state not in('published','revoked','expired') or published_at is not null),
  check(state='revoked' or (revoked_at is null and revoked_by is null and revoke_reason is null)),
  check(state<>'revoked' or (revoked_at is not null and revoked_by is not null and length(btrim(revoke_reason)) between 2 and 500))
);

create table qualification.casescope(
  case_id text not null references qualification.qualificationcase(id) on delete restrict,
  kind text not null check(kind in('partner','product','category','region')),
  target_id text not null check(target_id~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$'),
  primary key(case_id,kind,target_id)
);

create table qualification.casematerial(
  id text primary key check(id~'^evidence:[A-Za-z0-9][A-Za-z0-9.:/-]{0,246}$'),
  case_id text not null references qualification.qualificationcase(id) on delete restrict,
  kind text not null check(kind in('license','certificate','authorization','agreement','other')),
  object_ref text not null check(length(object_ref) between 3 and 2048),
  sha256 char(64) not null check(sha256~'^[a-f0-9]{64}$'),
  state text not null check(state in('submitted','verified','rejected')),
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default clock_timestamp(),
  check((state='verified')=(verified_at is not null and verified_by is not null))
);

create index qualificationcase_scope_updated on qualification.qualificationcase(scope_id,updated_at desc,id desc);
create index qualificationcase_subject on qualification.qualificationcase(subject_kind,subject_id,state,id);
create index qualificationcase_expiry on qualification.qualificationcase(expires_at,id) where state='published';
create index casescope_target on qualification.casescope(kind,target_id,case_id);
create index casematerial_case on qualification.casematerial(case_id,id);
create index casematerial_object on qualification.casematerial(object_ref,sha256);

create function qualification.protect_case_identity()
returns trigger language plpgsql set search_path=qualification,pg_temp as $function$
begin
  if row(old.id,old.scope_id,old.title,old.subject_kind,old.subject_id,old.effective_at,old.expires_at,old.created_at)
    is distinct from row(new.id,new.scope_id,new.title,new.subject_kind,new.subject_id,new.effective_at,new.expires_at,new.created_at) then
    raise exception 'QUALIFICATION_CASE_IDENTITY_IMMUTABLE';
  end if;
  if new.version<>old.version+1 then raise exception 'QUALIFICATION_CASE_VERSION_INVALID'; end if;
  if new.updated_at<=old.updated_at then raise exception 'QUALIFICATION_CASE_UPDATE_TIME_INVALID'; end if;
  return new;
end
$function$;
create trigger qualificationcaseidentity before update on qualification.qualificationcase
for each row execute function qualification.protect_case_identity();

create function qualification.protect_case_material()
returns trigger language plpgsql set search_path=qualification,pg_temp as $function$
begin
  raise exception 'QUALIFICATION_CASE_MATERIAL_IMMUTABLE';
end
$function$;
create trigger qualificationscopeimmutable before update or delete on qualification.casescope
for each row execute function qualification.protect_case_material();
create trigger qualificationmaterialimmutable before update or delete on qualification.casematerial
for each row execute function qualification.protect_case_material();

create function qualification.assert_publishable_case()
returns trigger language plpgsql security definer set search_path=qualification,pg_temp set row_security=off as $function$
declare
  subject text;
begin
  if tg_table_name='qualificationcase' then
    subject=case when tg_op='DELETE' then old.id else new.id end;
  else
    subject=case when tg_op='DELETE' then old.case_id else new.case_id end;
  end if;
  if exists(select 1 from qualification.qualificationcase where id=subject and state='published') then
    if not exists(select 1 from qualification.casescope where case_id=subject) then raise exception 'QUALIFICATION_SCOPE_REQUIRED'; end if;
    if not exists(select 1 from qualification.casematerial where case_id=subject) then raise exception 'QUALIFICATION_EVIDENCE_REQUIRED'; end if;
    if exists(select 1 from qualification.casematerial where case_id=subject and state<>'verified') then raise exception 'QUALIFICATION_EVIDENCE_NOT_VERIFIED'; end if;
    if exists(select 1 from qualification.qualificationcase where id=subject and expires_at<=published_at) then raise exception 'QUALIFICATION_EXPIRED_AT_PUBLICATION'; end if;
  end if;
  return null;
end
$function$;
create constraint trigger qualificationcasepublishable after insert or update on qualification.qualificationcase
deferrable initially deferred for each row execute function qualification.assert_publishable_case();
create constraint trigger qualificationscopecomplete after insert or update or delete on qualification.casescope
deferrable initially deferred for each row execute function qualification.assert_publishable_case();
create constraint trigger qualificationmaterialcomplete after insert or update or delete on qualification.casematerial
deferrable initially deferred for each row execute function qualification.assert_publishable_case();

create function qualification.resource_scope(p_resource text)
returns text language sql stable security definer
set search_path=qualification,pg_temp set row_security=off as $function$
  select coalesce(
    (select scope_id from qualification.qualificationcase where id=p_resource),
    (select scope_id from qualification.policy where id=p_resource)
  )
$function$;

create or replace function access.resource_scope(p_operation text,p_resource text,p_membership_id text)
returns text language plpgsql stable security definer
set search_path=access,capability,member,organization,partner,qualification,catalog,pricing,inventory,experience,cart,checkout,ordering,fulfillment,verification,payment,voucher,benefit,finance,invoice,channel,support,notification,reporting,risk,audit,extension,pg_temp as $function$
declare resolved text;
begin
  if p_operation='organization.stores.manage' then
    select coalesce((select id from partner.partner where id=p_resource and kind='store'),
      (select organization_id from access.membership where id=p_membership_id)) into resolved;
  elsif p_operation='identity.invitations.create' then
    select organization_id into resolved from access.membership where id=p_membership_id;
  elsif p_operation='identity.invitations.revoke' then
    select organization_id into resolved from identity.invitation where id=p_resource;
  elsif p_operation='identity.members.manage' then
    select organization_id into resolved from access.membership where id=p_resource;
  elsif p_operation like 'identity.%' then
    select 'self:'||profile.principal_id into resolved from access.membership membership join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='storefront')
      or p_operation like 'cart.%' or p_operation like 'checkout.%' or p_operation in(
      'order.orders.create','order.aftersales.apply','benefit.accounts.read','invoice.profiles.manage',
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
    if resolved is null then select qualification.resource_scope(p_resource) into resolved; end if;
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
    if resolved is null then select support.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select notification.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select reporting.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select risk.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from extension.installation where id=p_resource; end if;
    if resolved is null and p_operation in('access.roles.manage','access.scopes.manage','capability.assignments.manage','partner.partners.manage','qualification.policies.manage','qualification.qualifications.publish','qualification.qualifications.revoke','qualification.evidenceuploads.create','experience.applications.update','notification.templates.manage','notification.announcements.manage','reporting.exports.create','risk.policies.manage','verification.devices.manage','voucher.programs.manage','benefit.plans.manage','benefit.budgets.manage')
      then select organization_id into resolved from access.membership where id=p_membership_id; end if;
  end if;
  if resolved is null then raise exception 'RESOURCE_SCOPE_NOT_FOUND'; end if;
  return resolved;
end
$function$;

alter table qualification.qualificationcase enable row level security;
alter table qualification.qualificationcase force row level security;
alter table qualification.casescope enable row level security;
alter table qualification.casescope force row level security;
alter table qualification.casematerial enable row level security;
alter table qualification.casematerial force row level security;
create policy qualificationcaseapp on qualification.qualificationcase for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy qualificationcasejob on qualification.qualificationcase for all to shopjob using(true) with check(true);
create policy qualificationscopeapp on qualification.casescope for all to shopapp
  using(exists(select 1 from qualification.qualificationcase target where target.id=case_id))
  with check(exists(select 1 from qualification.qualificationcase target where target.id=case_id));
create policy qualificationscopejob on qualification.casescope for all to shopjob using(true) with check(true);
create policy qualificationmaterialapp on qualification.casematerial for all to shopapp
  using(exists(select 1 from qualification.qualificationcase target where target.id=case_id))
  with check(exists(select 1 from qualification.qualificationcase target where target.id=case_id));
create policy qualificationmaterialjob on qualification.casematerial for all to shopjob using(true) with check(true);

revoke all on qualification.qualificationcase,qualification.casescope,qualification.casematerial from public;
revoke all on function qualification.protect_case_identity(),qualification.protect_case_material(),qualification.assert_publishable_case(),qualification.resource_scope(text) from public;
grant select,insert,update on qualification.qualificationcase to shopapp,shopjob;
grant select,insert on qualification.casescope,qualification.casematerial to shopapp,shopjob;
grant execute on function qualification.resource_scope(text) to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('qualification.qualifications.publish','qualification','PUT','/api/v1/qualifications/{qualificationid}/publish','5.0.0'),
  ('qualification.qualifications.revoke','qualification','POST','/api/v1/qualifications/{qualificationid}/revoke','5.0.0'),
  ('qualification.evidenceuploads.create','qualification','POST','/api/v1/qualifications/evidence/uploads','5.0.0');

update capability.capability set version=2 where id in('qualification.center.read','qualification.decisions.preview');
insert into capability.capability(id,kind,name,version,status) values
  ('qualification.qualifications.publish','operation','qualification.qualifications.publish',1,'active'),
  ('qualification.qualifications.revoke','operation','qualification.qualifications.revoke',1,'active'),
  ('qualification.evidenceuploads.create','operation','qualification.evidenceuploads.create',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('qualification.qualifications.publish','qualification.qualifications.publish','qualification.manage','console',array['console']),
  ('qualification.qualifications.revoke','qualification.qualifications.revoke','qualification.manage','console',array['console']),
  ('qualification.evidenceuploads.create','qualification.evidenceuploads.create','qualification.manage','console',array['console']);

insert into capability.dependency(capability_id,depends_on_id) values
  ('qualification.qualifications.publish','qualification.center.read'),
  ('qualification.qualifications.revoke','qualification.center.read'),
  ('qualification.evidenceuploads.create','qualification.center.read');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','qualificationpublish'
from capability.capability capability where capability.id in(
  'qualification.qualifications.publish','qualification.qualifications.revoke','qualification.evidenceuploads.create'
);

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':qualificationpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','qualificationpublish',clock_timestamp()
from capability.entitlement entitlement where entitlement.capability_id in(
  'qualification.qualifications.publish','qualification.qualifications.revoke','qualification.evidenceuploads.create'
);
update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';

insert into runtime.event(type,version,owner,schema_ref) values
  ('qualification.changed',1,'qualification','contract://events/qualification.changed/v1'),
  ('qualification.expired',1,'qualification','contract://events/qualification.expired/v1'),
  ('qualification.revoked',1,'qualification','contract://events/qualification.revoked/v1');

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:307','sha256'),'hex'),
  expected_count=307,observed_count=(select count(*) from runtime.operation),published_at=clock_timestamp()
where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;

update runtime.contractcatalog
set checksum='85ecb10663a9c036a3f7551d35c1a046a888de81eed38ff2fc59201c1ba7d466',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904019000',0,(select count(*) from qualification.qualificationcase),0,0,
  'create index concurrently qualificationcase_expiry on qualification.qualificationcase(expires_at,id) where state=''published'';',
  'select id,scope_id,subject_kind,subject_id,state,version,expires_at from qualification.qualificationcase order by id;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904019000','85ecb10663a9c036a3f7551d35c1a046a888de81eed38ff2fc59201c1ba7d466');

do $assert$
begin
  if (select count(*) from runtime.operation)<>307 or (select count(*) from capability.operation)<>307
    or (select count(*) from runtime.event)<>124 then raise exception 'QUALIFICATION_CONTRACT_CATALOG_INVALID'; end if;
  if exists(select 1 from capability.capability where id in('qualification.center.read','qualification.decisions.preview') and version<>2) then
    raise exception 'QUALIFICATION_READ_CAPABILITY_VERSION_INVALID';
  end if;
  if (select count(*) from capability.capability where id in('qualification.qualifications.publish','qualification.qualifications.revoke','qualification.evidenceuploads.create') and version=1 and status='active')<>3 then
    raise exception 'QUALIFICATION_WRITE_CAPABILITY_INVALID';
  end if;
  if (select count(*) from runtime.event where type in('qualification.changed','qualification.expired','qualification.revoked') and version=1)<>3 then
    raise exception 'QUALIFICATION_EVENT_CATALOG_INVALID';
  end if;
  if exists(select 1 from pg_class where oid in('qualification.qualificationcase'::regclass,'qualification.casescope'::regclass,'qualification.casematerial'::regclass) and not(relrowsecurity and relforcerowsecurity)) then
    raise exception 'QUALIFICATION_RLS_INVALID';
  end if;
  if position('qualification.resource_scope' in pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure))=0 then
    raise exception 'QUALIFICATION_RESOURCE_SCOPE_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0' and status='active'
    and checksum='85ecb10663a9c036a3f7551d35c1a046a888de81eed38ff2fc59201c1ba7d466'
    and operation_count=307 and event_count=124) then raise exception 'QUALIFICATION_CONTRACT_IDENTITY_INVALID'; end if;
end
$assert$;

commit;
