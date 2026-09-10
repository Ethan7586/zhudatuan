begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:conflicting-history-reconciliation:v1'));

do $boundary_guard$
begin
  if not (
    current_user='shopmigration'
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'CONFLICTING_HISTORY_RECONCILIATION_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260828183000'
      and checksum='dea267e01bc8905433242ae5cb026948750587749c5178a59ba5d08a18e0d0b8') then
    raise exception 'CONFLICTING_HISTORY_RECONCILIATION_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260828190000') then
    raise exception 'CONFLICTING_HISTORY_RECONCILIATION_ALREADY_APPLIED';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version>'20260828183000'
      and version not in('20260829040000','20260829054500')) then
    raise exception 'CONFLICTING_HISTORY_RECONCILIATION_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

create temporary table conflictingoperation(id text primary key) on commit drop;
insert into conflictingoperation(id) values
  ('access.membershiproles.manage'),
  ('catalog.categories.read'),
  ('catalog.listings.create'),
  ('catalog.products.read'),
  ('experience.versions.read'),
  ('finance.policies.read'),
  ('member.mallstats.read'),
  ('member.members.manage'),
  ('notification.smssettings.manage'),
  ('notification.smssettings.read'),
  ('order.aftersales.export'),
  ('order.exchanges.create'),
  ('organization.projects.manage'),
  ('organization.projects.read'),
  ('partner.agreements.manage'),
  ('partner.agreements.read'),
  ('partner.storebindings.manage'),
  ('partner.stores.manage'),
  ('partner.stores.read'),
  ('pricing.rules.read'),
  ('qualification.resources.read'),
  ('reporting.exports.list'),
  ('risk.listingdecisions.manage'),
  ('risk.listingdecisions.read'),
  ('verification.challenges.revoke'),
  ('voucher.holds.read'),
  ('voucher.holds.reconcile'),
  ('voucher.overview.read');

create temporary table conflictingevent(type text,version integer,primary key(type,version)) on commit drop;
insert into conflictingevent(type,version) values
  ('fulfillment.exchange.created',1),
  ('fulfillment.return.inspected',1),
  ('order.aftersale.approved',1),
  ('order.aftersale.rejected',1),
  ('risk.listing.applied',1),
  ('risk.listing.rolledback',1),
  ('verification.membercode.verified',1);

create temporary table conflictingpermission(id text primary key,code text unique not null) on commit drop;
insert into conflictingpermission(id,code) values
  ('permission:3002915032d0a97ce28b1e3d','catalog.product.read'),
  ('permission:566c6f084f4cb25060200f9a','finance.policy.read'),
  ('permission:6db8c3700142df3c4b127617','voucher.hold.reconcile'),
  ('permission:95a0767bd0df7a05e74df9b5','pricing.rule.read'),
  ('permission:b930b6784d918be10f91ff5c','voucher.hold.read'),
  ('permission:notificationsmsmanage','notification.sms.manage'),
  ('permission:notificationsmsread','notification.sms.read'),
  ('permission:organizationprojectmanage','organization.project.manage'),
  ('permission:organizationprojectread','organization.project.read');

create temporary table conflictinghistorystate(conflict boolean not null) on commit drop;

do $state_guard$
declare
  operations integer:=(select count(*) from runtime.operation);
  bindings integer:=(select count(*) from capability.operation);
  events integer:=(select count(*) from runtime.event);
  conflict boolean;
begin
  if (operations,bindings,events)=(217,217,58) then
    conflict:=false;
  elsif (operations,bindings,events)=(245,245,65) then
    conflict:=true;
  else
    raise exception 'CONFLICTING_HISTORY_SIGNATURE_UNKNOWN:%:%:%',operations,bindings,events;
  end if;
  insert into conflictinghistorystate values(conflict);

  if conflict then
    if (select count(*) from runtime.operation operation join conflictingoperation item on item.id=operation.id)<>28
      or (select count(*) from capability.operation operation join conflictingoperation item on item.id=operation.operation_id)<>28
      or (select count(*) from capability.capability capability join conflictingoperation item on item.id=capability.id)<>28
      or (select count(*) from runtime.event event join conflictingevent item using(type,version))<>7
      or (select count(*) from access.permission permission join conflictingpermission item using(id) where permission.code=item.code)<>9 then
      raise exception 'CONFLICTING_HISTORY_CATALOG_SIGNATURE_INVALID';
    end if;

    if exists(select 1 from capability.dependency dependency
        join conflictingoperation item on item.id in(dependency.capability_id,dependency.depends_on_id))
      or exists(select 1 from access.membershipoverride override
        join conflictingpermission item on item.id=override.permission_id)
      or exists(select 1 from runtime.outbox outbox
        join conflictingevent item on (item.type,item.version)=(outbox.event_type,outbox.event_version))
      or exists(select 1 from runtime.inbox inbox
        join conflictingevent item on (item.type,item.version)=(inbox.event_type,inbox.event_version)) then
      raise exception 'CONFLICTING_HISTORY_REFERENCED_DATA_PRESENT';
    end if;

    if to_regclass('organization.project') is null
      or to_regclass('notification.smssetting') is null
      or to_regclass('notification.smsratewindow') is null
      or to_regclass('risk.listingrecommendation') is null
      or to_regprocedure('notification.sms_connection_enabled(text,text)') is null
      or to_regprocedure('access.settings_resource_scope(text)') is null
      or to_regprocedure('access.assert_scopegrant_reference()') is null then
      raise exception 'CONFLICTING_HISTORY_SCHEMA_SIGNATURE_INVALID';
    end if;

    if exists(select 1 from organization.project)
      or exists(select 1 from notification.smssetting)
      or exists(select 1 from notification.smsratewindow)
      or exists(select 1 from risk.listingrecommendation)
      or exists(select 1 from organization.organization where kind='project')
      or exists(select 1 from access.scopegrant where scope_kind='project')
      or exists(select 1 from ordering.aftersale)
      or exists(select 1 from fulfillment.returnrecord)
      or exists(select 1 from ordering.orderrecord where fulfillment_state='partially_fulfilled')
      or exists(select 1 from pricing.rule where author_id<>'migration:legacy'
        or approved_by is distinct from case when status in('published','retired') then 'migration:legacy' else null end
        or approved_at is distinct from case when status in('published','retired')
          then coalesce(effective_at,'1970-01-01T00:00:00Z'::timestamptz) else null end
        or expires_at is not null)
      or exists(select 1 from voucher.statusbatch where evidence<>'{}'::jsonb)
      or exists(select 1 from reporting.export where report='aftersales' or file_format<>'csv')
      or exists(select 1 from support.message where client_message_id<>id)
      or exists(select 1 from partner.agreement where version<>0)
      or exists(select 1 from partner.store where binding_status<>'active' or version<>0) then
      raise exception 'CONFLICTING_HISTORY_BUSINESS_DATA_REQUIRES_MANUAL_RECONCILIATION';
    end if;

    if position('settings_resource_scope' in
      pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure))>0 then
      raise exception 'CONFLICTING_HISTORY_RESOURCE_SCOPE_REWRITE_REMAINS';
    end if;
  end if;
end
$state_guard$;

-- Preserve visible storefront content while translating the abandoned V2
-- component vocabulary into the canonical V2 document emitted by 20260821078000.
with abandoned as(
  select version.id,version.application_id,version.configuration,
    (select block from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component'='announcement' limit 1) announcement,
    (select block from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component'='entries' limit 1) entries,
    (select block from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component'='hero' limit 1) hero,
    (select block from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component'='partners' limit 1) partners,
    (select block from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component'='segments' limit 1) segments,
    (select block from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component'='content' and block->>'id'='membercode' limit 1) membercode
  from experience.version version
  where (select conflict from conflictinghistorystate)
    and version.schema_version='2'
    and version.configuration->>'version'='2'
    and version.configuration->>'application'=version.application_id
    and jsonb_typeof(version.configuration->'pages')='array'
    and jsonb_array_length(version.configuration->'pages')=1
    and version.configuration->'pages'->0->>'path'='/'
    and exists(select 1 from jsonb_array_elements(version.configuration->'pages'->0->'blocks') block
      where block->>'component' in('announcement','entries','partners','segments','content'))
), normalized as(
  select abandoned.id,abandoned.application_id,jsonb_build_object(
    'version',2,
    'application',abandoned.application_id,
    'pages',jsonb_build_array(jsonb_build_object(
      'id',abandoned.application_id||':home',
      'path','home',
      'blocks',jsonb_build_array(
        jsonb_build_object('id',abandoned.application_id||':home:identity','component','richtext','content',jsonb_build_object(
          'mallDisplayName',abandoned.hero->'content'->'eyebrow',
          'themePreset',abandoned.hero->'content'->'theme',
          'memberCodeCta',coalesce(abandoned.membercode->'content','{}'::jsonb))),
        jsonb_build_object('id',abandoned.application_id||':home:hero','component','hero','content',jsonb_build_object(
          'title',abandoned.hero->'content'->'title',
          'subtitle',abandoned.hero->'content'->'description')),
        jsonb_build_object('id',abandoned.application_id||':home:notice','component','notice','content',jsonb_build_object(
          'announcement',abandoned.announcement->'content'->'title')),
        jsonb_build_object('id',abandoned.application_id||':home:shortcut','component','shortcut','content',jsonb_build_object(
          'entries',coalesce((select jsonb_agg(jsonb_build_object(
            'key',coalesce(item.value->>'id','entry'||item.ordinality::text),
            'label',coalesce(item.value->>'label','入口'||item.ordinality::text),
            'visible',true,'sortOrder',item.ordinality) order by item.ordinality)
            from jsonb_array_elements(coalesce(abandoned.entries->'content'->'items','[]'::jsonb))
              with ordinality item(value,ordinality)),'[]'::jsonb))),
        jsonb_build_object('id',abandoned.application_id||':home:products','component','productcollection','content',jsonb_build_object(
          'partners',coalesce((select jsonb_agg(item.value->'label' order by item.ordinality)
            from jsonb_array_elements(coalesce(abandoned.partners->'content'->'items','[]'::jsonb))
              with ordinality item(value,ordinality)),'[]'::jsonb),
          'segments',coalesce((select jsonb_agg(jsonb_build_object(
            'key',coalesce(item.value->>'id','segment'||item.ordinality::text),
            'title',coalesce(item.value->>'label','专区'||item.ordinality::text),
            'description',coalesce(item.value->>'description',''),
            'visible',true,'sortOrder',item.ordinality) order by item.ordinality)
            from jsonb_array_elements(coalesce(abandoned.segments->'content'->'items','[]'::jsonb))
              with ordinality item(value,ordinality)),'[]'::jsonb),
          'recommendationLimit',coalesce(abandoned.hero->'content'->'recommendationLimit','4'::jsonb))
        )
      )
    ))
  ) as converted_configuration
  from abandoned
  where abandoned.announcement is not null and abandoned.entries is not null
    and abandoned.hero is not null and abandoned.partners is not null and abandoned.segments is not null
)
update experience.version target
set configuration=normalized.converted_configuration,
  configuration_hash=encode(public.digest(normalized.converted_configuration::text,'sha256'),'hex'),
  validation_state='valid'
from normalized where normalized.id=target.id;

delete from capability.dependency dependency using conflictingoperation item
where dependency.capability_id=item.id or dependency.depends_on_id=item.id;
delete from capability.entitlement entitlement using conflictingoperation item
where entitlement.capability_id=item.id;
delete from capability.operation operation using conflictingoperation item
where operation.operation_id=item.id;
delete from capability.capability capability using conflictingoperation item
where capability.id=item.id;
delete from runtime.operation operation using conflictingoperation item
where operation.id=item.id;
delete from runtime.event event using conflictingevent item
where (event.type,event.version)=(item.type,item.version);
delete from access.rolepermission mapping using conflictingpermission item
where mapping.permission_id=item.id;
delete from access.permission permission using conflictingpermission item
where permission.id=item.id;

update capability.operation set audience='operator'
where operation_id='verification.challenges.issue';

alter table reporting.export drop constraint if exists reporting_export_report;
alter table reporting.export add constraint reporting_export_report
  check(report in('metrics','orders','finance.statement'));

alter table fulfillment.returnrecord drop constraint if exists fulfillment_returnrecord_aftersale_key;
alter table ordering.aftersale drop constraint if exists aftersale_state_check;
alter table ordering.aftersale add constraint aftersale_state_check
  check(state in('requested','processing','approved','rejected','completed','cancelled'));
alter table ordering.orderrecord drop constraint if exists orderrecord_fulfillment_state_check;
alter table ordering.orderrecord add constraint orderrecord_fulfillment_state_check
  check(fulfillment_state in('unallocated','allocated','processing','shipped','delivered','cancelled','returned'));

drop index if exists catalog.catalog_product_owner_updated;
alter table catalog.product drop column if exists owner_scope_id;
alter table pricing.rule drop constraint if exists pricing_rule_approval_check;
alter table pricing.rule drop constraint if exists pricing_rule_window_check;
alter table pricing.rule drop column if exists expires_at;
alter table pricing.rule drop column if exists author_id;
alter table pricing.rule drop column if exists approved_by;
alter table pricing.rule drop column if exists approved_at;

drop index if exists voucher.voucher_hold_read;
alter table voucher.statusbatch drop column if exists evidence;
alter table reporting.export drop column if exists file_format;
drop index if exists support.support_message_client_once;
alter table support.message drop constraint if exists support_message_client_id;
alter table support.message drop column if exists client_message_id;

drop index if exists partner.partner_store_mall;
drop index if exists partner.partner_agreement_mall_time;
alter table partner.agreement drop column if exists version;
alter table partner.store drop column if exists binding_status;
alter table partner.store drop column if exists version;

create or replace function notification.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=notification,pg_temp as $function$
  select coalesce((select scope_id from notification.dispatch where id=p_resource),
    (select scope_id from notification.template where id=p_resource),
    (select scope_id from notification.announcement where id=p_resource))
$function$;
revoke all on function notification.resource_scope(text) from public;

create or replace function risk.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=risk,pg_temp as $function$
  select scope_id from (
    select scope_id,1 priority from risk.policy where id=p_resource
    union all select scope_id,2 priority from risk.case where id=p_resource
  ) candidate order by priority limit 1
$function$;
revoke all on function risk.resource_scope(text) from public;

drop function if exists access.settings_resource_scope(text);
drop function if exists notification.sms_connection_enabled(text,text);
drop table if exists notification.smsratewindow;
drop table if exists notification.smssetting;
drop table if exists risk.listingrecommendation;
drop table if exists organization.project;

alter table organization.organization drop constraint if exists organization_kind_check;
alter table organization.organization add constraint organization_kind_check
  check(kind in('platform','distributor','tenant','enterprise','mall','department'));
alter table access.scopegrant drop constraint if exists scopegrant_scope_kind_check;
alter table access.scopegrant add constraint scopegrant_scope_kind_check
  check(scope_kind in('platform','distributor','tenant','enterprise','mall','department','supplier','brand','store','owner','self'));

drop trigger if exists scopegrant_reference on access.scopegrant;
drop function if exists access.assert_scopegrant_reference();

drop policy if exists appscope on partner.store;
create policy appscope on partner.store for all to shopapp
  using(current_setting('app.workload',true)='api')
  with check(current_setting('app.workload',true)='api');
drop policy if exists appscope on partner.agreement;
create policy appscope on partner.agreement for all to shopapp
  using(current_setting('app.workload',true)='api')
  with check(current_setting('app.workload',true)='api');

drop policy if exists appread on capability.entitlement;
drop policy if exists appinsert on capability.entitlement;
drop policy if exists appupdate on capability.entitlement;
drop policy if exists appdelete on capability.entitlement;
drop policy if exists appscope on capability.entitlement;
create policy appscope on capability.entitlement for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260828190000','dfe129a442784c826455991dc288d569b6dcec19a8154c264ec95f0274e0ead1');

do $assert$
begin
  if (select count(*) from runtime.operation)<>217
    or (select count(*) from capability.operation)<>217 then
    raise exception 'CONFLICTING_HISTORY_OPERATION_RECONCILIATION_INVALID';
  end if;
  if (select count(*) from runtime.event)<>58 then
    raise exception 'CONFLICTING_HISTORY_EVENT_RECONCILIATION_INVALID';
  end if;
  if exists(select 1 from runtime.operation operation join conflictingoperation item on item.id=operation.id)
    or exists(select 1 from capability.capability capability join conflictingoperation item on item.id=capability.id)
    or exists(select 1 from runtime.event event join conflictingevent item using(type,version))
    or exists(select 1 from access.permission permission join conflictingpermission item on item.id=permission.id) then
    raise exception 'CONFLICTING_HISTORY_CATALOG_REMAINS';
  end if;
  if to_regclass('organization.project') is not null
    or to_regclass('notification.smssetting') is not null
    or to_regclass('notification.smsratewindow') is not null
    or to_regclass('risk.listingrecommendation') is not null
    or to_regprocedure('notification.sms_connection_enabled(text,text)') is not null
    or to_regprocedure('access.settings_resource_scope(text)') is not null
    or to_regprocedure('access.assert_scopegrant_reference()') is not null then
    raise exception 'CONFLICTING_HISTORY_SCHEMA_REMAINS';
  end if;
  if exists(select 1 from information_schema.columns where
    (table_schema,table_name,column_name) in(
      ('catalog','product','owner_scope_id'),
      ('pricing','rule','expires_at'),('pricing','rule','author_id'),
      ('pricing','rule','approved_by'),('pricing','rule','approved_at'),
      ('voucher','statusbatch','evidence'),('reporting','export','file_format'),
      ('support','message','client_message_id'),('partner','agreement','version'),
      ('partner','store','binding_status'),('partner','store','version')
    )) then
    raise exception 'CONFLICTING_HISTORY_COLUMN_REMAINS';
  end if;
  if not exists(select 1 from capability.operation
    where operation_id='verification.challenges.issue' and audience='operator') then
    raise exception 'VERIFICATION_ISSUE_AUDIENCE_NOT_RESTORED';
  end if;
  if exists(select 1 from experience.version version
    cross join lateral jsonb_array_elements(version.configuration->'pages') page
    cross join lateral jsonb_array_elements(page->'blocks') block
    where version.schema_version='2' and page->>'path'='/'
      and block->>'component' in('announcement','entries','partners','segments','content')) then
    raise exception 'ABANDONED_EXPERIENCE_DOCUMENT_REMAINS';
  end if;
  if (select count(*) from pg_policies where schemaname||'.'||tablename in(
      'partner.store','partner.agreement','capability.entitlement') and policyname='appscope')<>3
    or exists(select 1 from pg_policies where schemaname='capability' and tablename='entitlement'
      and policyname in('appread','appinsert','appupdate','appdelete')) then
    raise exception 'CONFLICTING_HISTORY_POLICY_RECONCILIATION_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260828190000'
      and checksum='dfe129a442784c826455991dc288d569b6dcec19a8154c264ec95f0274e0ead1') then
    raise exception 'CONFLICTING_HISTORY_RECONCILIATION_MARKER_MISSING';
  end if;
end
$assert$;

commit;
