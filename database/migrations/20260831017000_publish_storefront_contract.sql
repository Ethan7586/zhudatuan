begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260831016000') then
    raise exception 'STOREFRONT_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831017000') then
    raise exception 'STOREFRONT_CONTRACT_ALREADY_APPLIED';
  end if;
end
$precondition$;

create table notification.receipt(
  member_id text not null,
  notification_id text not null,
  kind text not null check(kind in('dispatch','announcement')),
  read_at timestamptz not null,
  primary key(member_id,notification_id),
  check(length(member_id) between 3 and 255),
  check(length(notification_id) between 3 and 255)
);

create index notification_receipt_recent on notification.receipt(member_id,read_at desc,notification_id desc);

alter table notification.receipt enable row level security;
alter table notification.receipt force row level security;

create policy appscope on notification.receipt for all to shopapp
using(member_id=(select membership.member_id from access.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'))
with check(member_id=(select membership.member_id from access.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'));

create policy jobscope on notification.receipt for all to shopjob
using(true)
with check(true);

grant select,insert,update on notification.receipt to shopapp,shopjob;

create function notification.visible_notifications(p_membership text,p_include_scope boolean)
returns table(
  member_id text,
  id text,
  kind text,
  event_type text,
  channel text,
  subject text,
  body text,
  state text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=access,organization,notification,pg_temp
as $function$
  with actor as materialized(
    select membership.member_id,membership.organization_id
    from access.membership membership
    where membership.id=p_membership and membership.status='active'
  ), visible_dispatch as(
    select actor.member_id,dispatch.id,'dispatch'::text kind,template.event_type,dispatch.channel,
      dispatch.subject,dispatch.body,dispatch.state,dispatch.created_at
    from actor join notification.dispatch dispatch on dispatch.member_id=actor.member_id
    join notification.template template on template.id=dispatch.template_id and template.scope_id=dispatch.scope_id
    union all
    select actor.member_id,dispatch.id,'dispatch'::text kind,template.event_type,dispatch.channel,
      dispatch.subject,dispatch.body,dispatch.state,dispatch.created_at
    from actor join organization.unitclosure closure on closure.descendant_id=actor.organization_id
    join notification.dispatch dispatch on p_include_scope and dispatch.member_id is null and dispatch.scope_id=closure.ancestor_id
    join notification.template template on template.id=dispatch.template_id and template.scope_id=dispatch.scope_id
  ), visible_announcement as(
    select actor.member_id,announcement.id,'announcement'::text kind,'notification.announcement'::text event_type,
      'inapp'::text channel,announcement.title subject,announcement.body,announcement.state,announcement.created_at
    from actor join organization.unitclosure closure on closure.descendant_id=actor.organization_id
    join notification.announcement announcement on announcement.scope_id=closure.ancestor_id
    where announcement.state='published' and announcement.starts_at<=statement_timestamp()
      and(announcement.ends_at is null or announcement.ends_at>statement_timestamp())
      and(announcement.audience->>'kind'='all' or announcement.audience->>'kind'='members'
        and announcement.audience->'members' @> jsonb_build_array(actor.member_id))
  )
  select * from visible_dispatch
  union all
  select * from visible_announcement
$function$;

revoke all on function notification.visible_notifications(text,boolean) from public;
grant execute on function notification.visible_notifications(text,boolean) to shopapp,shopjob;

create function access.member_allowed(p_member text)
returns boolean
language sql
stable
security definer
set search_path=access,pg_temp
as $function$
  select p_member is not null and p_member=(select membership.member_id from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active')
$function$;

revoke all on function access.member_allowed(text) from public;
grant execute on function access.member_allowed(text) to shopapp,shopjob;

alter table invoice.profile force row level security;
alter table invoice.request force row level security;
alter table invoice.document force row level security;
alter table invoice.line force row level security;
alter table invoice.requestline force row level security;
alter table invoice.requestprofile force row level security;

drop policy appscope on invoice.profile;
create policy appscope on invoice.profile for all to shopapp
using(access.scope_allowed(owner_id) or access.member_allowed(owner_id))
with check(access.scope_allowed(owner_id) or access.member_allowed(owner_id));

drop policy appscope on invoice.request;
create policy appscope on invoice.request for all to shopapp
using(exists(select 1 from invoice.profile profile where profile.id=profile_id
  and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))))
with check(exists(select 1 from invoice.profile profile where profile.id=profile_id
  and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))));

drop policy appscope on invoice.document;
create policy appscope on invoice.document for all to shopapp
using(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where request.id=request_id and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))))
with check(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where request.id=request_id and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))));

drop policy appscope on invoice.line;
create policy appscope on invoice.line for all to shopapp
using(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where request.id=request_id and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))))
with check(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where request.id=request_id and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))));

drop policy appscope on invoice.requestline;
create policy appscope on invoice.requestline for all to shopapp
using(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where request.id=request_id and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))))
with check(exists(select 1 from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where request.id=request_id and(access.scope_allowed(profile.owner_id) or access.member_allowed(profile.owner_id))));

drop policy appscope on invoice.requestprofile;
create policy appscope on invoice.requestprofile for all to shopapp
using(access.scope_allowed(owner_id) or access.member_allowed(owner_id))
with check(access.scope_allowed(owner_id) or access.member_allowed(owner_id));

delete from capability.entitlement where capability_id in(
  'checkout.context.read','experience.published.read','inventory.availability.read',
  'payment.intents.create','pricing.offers.read'
);
delete from capability.dependency where capability_id in(
  'checkout.context.read','experience.published.read','inventory.availability.read',
  'payment.intents.create','pricing.offers.read'
) or depends_on_id in(
  'checkout.context.read','experience.published.read','inventory.availability.read',
  'payment.intents.create','pricing.offers.read'
);
delete from capability.operation where operation_id in(
  'checkout.context.read','experience.published.read','inventory.availability.read',
  'payment.intents.create','pricing.offers.read'
);
delete from capability.capability where id in(
  'checkout.context.read','experience.published.read','inventory.availability.read',
  'payment.intents.create','pricing.offers.read'
);
delete from runtime.operation where id in(
  'checkout.context.read','experience.published.read','inventory.availability.read',
  'payment.intents.create','pricing.offers.read'
);

delete from access.rolepermission where permission_id=(
  select id from access.permission where code='payment.create'
);
delete from access.permission where code='payment.create';

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.memberships.read','identity','GET','/api/v1/identity/memberships','3.0.0'),
  ('identity.memberships.switch','identity','PUT','/api/v1/identity/memberships/current','3.0.0'),
  ('member.favorites.read','member','GET','/api/v1/members/me/favorites','3.0.0'),
  ('member.favorites.put','member','PUT','/api/v1/members/me/favorites/{listingid}','3.0.0'),
  ('payment.intents.read','payment','GET','/api/v1/payments/intents/{paymentid}','3.0.0'),
  ('notification.notifications.ack','notification','PUT','/api/v1/notifications/{notificationid}/ack','3.0.0'),
  ('checkout.quotes.current.read','checkout','GET','/api/v1/checkouts/quotes/current','3.0.0'),
  ('storefront.bootstrap.read','navigation','GET','/api/v1/storefront/bootstrap','3.0.0'),
  ('storefront.catalog.read','navigation','GET','/api/v1/storefront/catalog','3.0.0'),
  ('finance.invoices.read','finance','GET','/api/v1/finance/invoices','3.0.0'),
  ('finance.invoices.download','finance','GET','/api/v1/finance/invoices/{invoiceid}/download','3.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into access.permission(id,code,risk,status) values
  ('permission:4551e0fea695439811ce62fd','identity.session.read','low','active'),
  ('permission:a061c751526602d3562ce3b4','identity.session.manage','elevated','active'),
  ('permission:41ef32994dd668e1c83d8202','member.favorite.read','low','active'),
  ('permission:6b65d3753b3a9246322dbcf6','member.favorite.manage','low','active'),
  ('permission:59057b99e9b0d1fe62c54b66','payment.read','low','active'),
  ('permission:07f422cddbdcd24c49a83a81','notification.ack','low','active'),
  ('permission:577ce0108012e8739385f27f','checkout.create','elevated','active'),
  ('permission:1ccaa34b9444d087456c1667','finance.invoice.download','elevated','active'),
  ('permission:7db960b56ccae9fdfa3fedc3','finance.invoice.read','low','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;

insert into capability.capability(id,kind,name,version,status) values
  ('identity.memberships.read','operation','identity.memberships.read',3,'active'),
  ('identity.memberships.switch','operation','identity.memberships.switch',3,'active'),
  ('member.favorites.read','operation','member.favorites.read',3,'active'),
  ('member.favorites.put','operation','member.favorites.put',3,'active'),
  ('payment.intents.read','operation','payment.intents.read',3,'active'),
  ('notification.notifications.ack','operation','notification.notifications.ack',3,'active'),
  ('checkout.quotes.current.read','operation','checkout.quotes.current.read',3,'active'),
  ('storefront.bootstrap.read','operation','storefront.bootstrap.read',3,'active'),
  ('storefront.catalog.read','operation','storefront.catalog.read',3,'active'),
  ('finance.invoices.read','operation','finance.invoices.read',3,'active'),
  ('finance.invoices.download','operation','finance.invoices.download',3,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('identity.memberships.read','identity.memberships.read','identity.session.read','storefront'),
  ('identity.memberships.switch','identity.memberships.switch','identity.session.manage','storefront'),
  ('member.favorites.read','member.favorites.read','member.favorite.read','storefront'),
  ('member.favorites.put','member.favorites.put','member.favorite.manage','storefront'),
  ('payment.intents.read','payment.intents.read','payment.read','storefront'),
  ('notification.notifications.ack','notification.notifications.ack','notification.ack','storefront'),
  ('checkout.quotes.current.read','checkout.quotes.current.read','checkout.create','storefront'),
  ('storefront.bootstrap.read','storefront.bootstrap.read',null,'storefront'),
  ('storefront.catalog.read','storefront.catalog.read',null,'storefront'),
  ('finance.invoices.read','finance.invoices.read','finance.invoice.read','storefront'),
  ('finance.invoices.download','finance.invoices.download','finance.invoice.download','storefront')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability
where capability.id in(
  'identity.memberships.read','identity.memberships.switch','member.favorites.read','member.favorites.put',
  'payment.intents.read','notification.notifications.ack','checkout.quotes.current.read',
  'storefront.bootstrap.read','storefront.catalog.read','finance.invoices.read','finance.invoices.download'
)
on conflict do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission where permission.code in(
  'identity.session.read','identity.session.manage','member.favorite.read','member.favorite.manage',
  'payment.read','notification.ack','checkout.create','finance.invoice.read','finance.invoice.download'
)
on conflict do nothing;

insert into runtime.event(type,version,owner,schema_ref) values
  ('identity.membership.switched',1,'identity','contract://events/identity.membership.switched/v1'),
  ('payment.captured',1,'payment','contract://events/payment.captured/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

update runtime.outbox set event_type='payment.captured'
where event_type='payment.succeeded' and event_version=1;
delete from runtime.event where type='payment.succeeded' and version=1;

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:269','sha256'),'hex'),
  expected_count=269,observed_count=269,published_at=clock_timestamp()
where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;

update runtime.contractcatalog
set checksum=encode(public.digest('commerce:3.0.0:storefront:269:97','sha256'),'hex'),
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

-- Historical migrations intentionally support a privileged bootstrap runner.
-- Reconcile every application-owned object to the canonical NOLOGIN migration
-- role before publishing the new head so PostgreSQL owner privileges and the
-- generated object contract are identical regardless of bootstrap identity.
do $ownership$
declare item record;
begin
  if not exists(select 1 from pg_roles where rolname='shopmigration'
    and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls) then
    raise exception 'CANONICAL_MIGRATION_OWNER_INVALID';
  end if;
  for item in
    select namespace.nspname schema_name,relation.relname object_name,relation.relkind
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname not in('pg_catalog','information_schema','public','supabase_migrations')
      and namespace.nspname not like 'pg\_%' escape '\'
      and relation.relkind in('r','p','v','m','S')
      and not exists(select 1 from pg_depend dependency where dependency.classid='pg_class'::regclass
        and dependency.objid=relation.oid and dependency.deptype='e')
  loop
    if item.relkind='v' then
      execute format('alter view %I.%I owner to shopmigration',item.schema_name,item.object_name);
    elsif item.relkind='m' then
      execute format('alter materialized view %I.%I owner to shopmigration',item.schema_name,item.object_name);
    elsif item.relkind='S' then
      if not exists(
        select 1 from pg_depend dependency
        where dependency.classid='pg_class'::regclass
          and dependency.objid=to_regclass(format('%I.%I',item.schema_name,item.object_name))
          and dependency.refclassid='pg_class'::regclass
          and dependency.deptype in('a','i')
      ) then
        execute format('alter sequence %I.%I owner to shopmigration',item.schema_name,item.object_name);
      end if;
    else
      execute format('alter table %I.%I owner to shopmigration',item.schema_name,item.object_name);
    end if;
  end loop;
  for item in
    select namespace.nspname schema_name,procedure.proname object_name,
      pg_get_function_identity_arguments(procedure.oid) arguments
    from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where procedure.prokind='f' and not procedure.prosecdef
      and namespace.nspname not in('pg_catalog','information_schema','public','supabase_migrations')
      and namespace.nspname not like 'pg\_%' escape '\'
      and not exists(select 1 from pg_depend dependency where dependency.classid='pg_proc'::regclass
        and dependency.objid=procedure.oid and dependency.deptype='e')
  loop
    execute format('alter function %I.%I(%s) owner to shopmigration',item.schema_name,item.object_name,item.arguments);
  end loop;
  for item in
    select namespace.nspname schema_name from pg_namespace namespace
    where namespace.nspname not in('pg_catalog','information_schema','public','supabase_migrations')
      and namespace.nspname not like 'pg\_%' escape '\'
      and exists(select 1 from pg_class relation where relation.relnamespace=namespace.oid)
      and not exists(select 1 from pg_depend dependency where dependency.classid='pg_namespace'::regclass
        and dependency.objid=namespace.oid and dependency.deptype='e')
  loop
    execute format('alter schema %I owner to shopmigration',item.schema_name);
  end loop;
end
$ownership$;

select runtime.record_migration_evidence('20260831017000',
  (select count(*) from runtime.operation)+(select count(*) from runtime.event),
  (select count(*) from capability.operation)+(select count(*) from runtime.event),0,0,
  'create index concurrently if not exists notification_receipt_recent_live on notification.receipt(member_id,read_at desc,notification_id desc);',
  'select artifact,version,operation_count,event_count,checksum from runtime.contractcatalog where status=''active'';');

insert into runtime.schemaversion(version,checksum)
values('20260831017000','b353ba866ba712c8e2a654e519fa7708082851ce26b657c3276d565a1b4b0d4a');

do $assert$
begin
  if (select count(*) from runtime.operation)<>269 or (select count(*) from capability.operation)<>269 then
    raise exception 'STOREFRONT_CONTRACT_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from runtime.event)<>97 then raise exception 'STOREFRONT_CONTRACT_EVENT_COUNT_INVALID'; end if;
  if not exists(select 1 from runtime.event where type='payment.captured' and version=1)
    or exists(select 1 from runtime.event where type='payment.succeeded') then
    raise exception 'PAYMENT_CAPTURE_EVENT_HARDCUT_INVALID';
  end if;
  if exists(select 1 from runtime.operation where id in(
    'checkout.context.read','experience.published.read','inventory.availability.read',
    'payment.intents.create','pricing.offers.read')) then
    raise exception 'STOREFRONT_CONTRACT_RETIRED_OPERATION_REMAINS';
  end if;
  if exists(select 1 from access.permission where code='payment.create') then
    raise exception 'STOREFRONT_CONTRACT_RETIRED_PERMISSION_REMAINS';
  end if;
  if (select count(*) from runtime.operation where id in(
    'identity.memberships.read','identity.memberships.switch','member.favorites.read','member.favorites.put',
    'payment.intents.read','notification.notifications.ack','checkout.quotes.current.read',
    'storefront.bootstrap.read','storefront.catalog.read','finance.invoices.read','finance.invoices.download'))<>11 then
    raise exception 'STOREFRONT_CONTRACT_OPERATION_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and operation_count=269 and event_count=97) then raise exception 'STOREFRONT_CONTRACT_CATALOG_INVALID'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260831017000'
    and checksum='b353ba866ba712c8e2a654e519fa7708082851ce26b657c3276d565a1b4b0d4a') then
    raise exception 'STOREFRONT_CONTRACT_CHECKSUM_INVALID';
  end if;
  if not exists(select 1 from runtime.mvpauthority where id='mvp:operations'
    and expected_count=269 and observed_count=269) then raise exception 'STOREFRONT_MVP_AUTHORITY_INVALID'; end if;
  if not exists(select 1 from pg_policies where schemaname='notification' and tablename='receipt'
    and policyname='appscope') then raise exception 'NOTIFICATION_RECEIPT_RLS_MISSING'; end if;
  if to_regprocedure('notification.visible_notifications(text,boolean)') is null then
    raise exception 'NOTIFICATION_VISIBILITY_FUNCTION_MISSING';
  end if;
  if to_regprocedure('access.member_allowed(text)') is null
    or (select count(*) from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='invoice' and relation.relname in('profile','request','document','line','requestline','requestprofile') and relation.relforcerowsecurity)<>6 then
    raise exception 'INVOICE_MEMBER_RLS_INVALID';
  end if;
end
$assert$;

commit;
