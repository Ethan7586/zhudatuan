begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904016000') then raise exception 'ORGANIZATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904017000')
    or to_regclass('organization.mall') is not null
    or to_regclass('organization.membership') is not null then raise exception 'ORGANIZATION_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table organization.organization add column mall_limit integer not null default 50 check(mall_limit between 0 and 10000);

alter table organization.syncrun add column preview_only boolean not null default false;
alter table organization.syncrun add column create_count bigint not null default 0 check(create_count>=0);
alter table organization.syncrun add column update_count bigint not null default 0 check(update_count>=0);
alter table organization.syncrun add column freeze_count bigint not null default 0 check(freeze_count>=0);
alter table organization.syncrun add column restore_count bigint not null default 0 check(restore_count>=0);
update organization.syncrun set create_count=applied_count where applied_count>0;
alter table organization.syncrun add constraint syncrun_diff_count_valid
  check(create_count+update_count+freeze_count+restore_count=applied_count);

alter table experience.version add column source_version_id text references experience.version(id) on delete restrict;
create index experience_version_source on experience.version(source_version_id) where source_version_id is not null;

create table organization.directorypreviewsubject(
  run_id uuid not null references organization.syncrun(id) on delete cascade,
  subject_hash bytea not null check(octet_length(subject_hash)=32),
  primary key(run_id,subject_hash)
);
create table organization.directorypreviewpage(
  run_id uuid not null references organization.syncrun(id) on delete cascade,
  provider_event_id text not null,
  provider_version bigint not null check(provider_version>=0),
  body_hash char(64) not null check(body_hash~'^[0-9a-f]{64}$'),
  primary key(run_id,provider_event_id)
);

create table organization.mall(
  id text primary key references organization.organization(id) on delete restrict,
  code text not null check(code~'^[A-Z][A-Z0-9_]{1,31}$'),
  public_slug text not null check(public_slug~'^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  brand_name text not null check(length(btrim(brand_name)) between 2 and 120),
  domain_mode text not null check(domain_mode in('platform','custom')),
  custom_domain text,
  owner_membership_id text not null check(length(owner_membership_id) between 3 and 160),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  theme_preset text not null check(theme_preset in('shop','market','governance')),
  theme_primary_color char(7) not null check(theme_primary_color~'^#[0-9A-F]{6}$'),
  theme_accent_color char(7) not null check(theme_accent_color~'^#[0-9A-F]{6}$'),
  theme_logo_object_ref text,
  theme_favicon_object_ref text,
  opening_state text not null check(opening_state in('complete','actionrequired')),
  subject_type text not null check(subject_type in('enterprise','individual','organization','personal')),
  company_name text,
  credit_code text,
  legal_representative text,
  contact_name text,
  contact_mobile text,
  license_object_ref text,
  store_type text not null check(store_type in('general','specialty','franchise','government')),
  primary_category text,
  business_mode text not null check(business_mode in('selfoperated','marketplace','hybrid')),
  business_region text,
  business_address text,
  service_phone text,
  certificate_mode text not null check(certificate_mode in('managed','self','later')),
  certificate_object_ref text,
  mini_program_mode text not null check(mini_program_mode in('later','authorize','register')),
  mini_program_app_id text,
  mini_program_original_id text,
  official_account_mode text not null check(official_account_mode in('later','authorize','register')),
  official_account_app_id text,
  video_channel_id text,
  payment_plan text not null check(payment_plan in('later','wechat','multi','offline')),
  wechat_merchant_id text,
  delivery_mode text not null check(delivery_mode in('express','local','pickup','digital','mixed')),
  warehouse_region text,
  return_contact text,
  return_address text,
  invoice_mode text not null check(invoice_mode in('later','electronic','paper','both')),
  notification_contact text,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check((domain_mode='platform' and custom_domain is null) or (domain_mode='custom' and custom_domain is not null)),
  check(custom_domain is null or (custom_domain=lower(custom_domain) and custom_domain~'^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')),
  check(theme_logo_object_ref is null or theme_logo_object_ref~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$'),
  check(theme_favicon_object_ref is null or theme_favicon_object_ref~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$'),
  check(license_object_ref is null or license_object_ref~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$'),
  check(certificate_object_ref is null or certificate_object_ref~'^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$'),
  check(opening_state='actionrequired' or (
    length(btrim(company_name)) between 2 and 160 and length(btrim(contact_name)) between 2 and 80 and contact_mobile~'^\+[1-9][0-9]{7,14}$'
    and length(btrim(primary_category)) between 1 and 120 and length(btrim(business_region)) between 1 and 120 and length(btrim(business_address)) between 1 and 240
    and (notification_contact~'^\+[1-9][0-9]{7,14}$' or notification_contact~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  )),
  check(opening_state='actionrequired' or subject_type='personal' or (credit_code~'^[0-9A-HJ-NPQRTUWXY]{15,18}$' and length(btrim(legal_representative)) between 2 and 80)),
  check(service_phone is null or service_phone~'^\+[1-9][0-9]{7,14}$'),
  check(opening_state='actionrequired' or certificate_mode<>'self' or certificate_object_ref is not null),
  check(opening_state='actionrequired' or mini_program_mode<>'authorize' or (mini_program_app_id is not null and mini_program_original_id is not null)),
  check(opening_state='actionrequired' or official_account_mode<>'authorize' or official_account_app_id is not null),
  check(opening_state='actionrequired' or payment_plan not in('wechat','multi') or wechat_merchant_id is not null),
  check(opening_state='actionrequired' or delivery_mode='digital' or (warehouse_region is not null and return_contact is not null and return_address is not null)),
  check(updated_at>=created_at)
);
create unique index organization_mall_code_unique on organization.mall(lower(code));
create unique index organization_mall_slug_unique on organization.mall(lower(public_slug));
create unique index organization_mall_domain_unique on organization.mall(lower(custom_domain)) where custom_domain is not null;

create table organization.membership(
  id text primary key check(id~'^organizationmembership:'),
  organization_id text not null references organization.organization(id) on delete restrict,
  source_membership_id text not null,
  responsibility text not null check(responsibility in('owner','manager','member')),
  status text not null check(status in('active','inactive')),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(organization_id,source_membership_id,responsibility),
  check(updated_at>=created_at)
);
create index organization_membership_source on organization.membership(source_membership_id,status,organization_id);

create function organization.assert_hierarchy()
returns trigger language plpgsql security definer set search_path=organization,pg_temp set row_security=off as $function$
begin
  if new.parent_id is null then
    if new.kind<>'platform' then raise exception 'ORGANIZATION_ROOT_KIND_INVALID'; end if;
    if exists(select 1 from organization.organization current where current.parent_id is null and current.id<>new.id) then raise exception 'ORGANIZATION_ROOT_DUPLICATE'; end if;
    return new;
  end if;
  if new.id=new.parent_id or exists(
    select 1 from organization.unitclosure closure where closure.ancestor_id=new.id and closure.descendant_id=new.parent_id
  ) then raise exception 'ORGANIZATION_HIERARCHY_CYCLE'; end if;
  return new;
end
$function$;
create trigger organizationhierarchy before insert or update of parent_id,kind on organization.organization
for each row execute function organization.assert_hierarchy();

insert into organization.mall(
  id,code,public_slug,brand_name,domain_mode,custom_domain,owner_membership_id,currency,
  theme_preset,theme_primary_color,theme_accent_color,theme_logo_object_ref,theme_favicon_object_ref,
  opening_state,subject_type,company_name,credit_code,legal_representative,contact_name,contact_mobile,license_object_ref,
  store_type,primary_category,business_mode,business_region,business_address,service_phone,certificate_mode,certificate_object_ref,
  mini_program_mode,mini_program_app_id,mini_program_original_id,official_account_mode,official_account_app_id,video_channel_id,
  payment_plan,wechat_merchant_id,delivery_mode,warehouse_region,return_contact,return_address,invoice_mode,notification_contact,
  version,created_at,updated_at
)
select organization.id,
  coalesce(application.code,'MALL'||upper(substr(encode(public.digest(organization.id,'sha256'),'hex'),1,12))),
  coalesce(application.public_slug,'mall-'||substr(encode(public.digest(organization.id,'sha256'),'hex'),1,16)),
  organization.name,
  'platform',
  null,
  coalesce(owner.membership_id,'system:unassigned'),
  'CNY','shop','#1F5EFF','#0B2A5B',null,null,
  'actionrequired','enterprise',organization.name,null,null,null,null,null,
  'general',null,'selfoperated',null,null,null,'managed',null,
  'later',null,null,'later',null,null,'later',null,'express',null,null,null,'later',null,
  greatest(organization.version,1),organization.created_at,organization.updated_at
from organization.organization organization
left join experience.application application on application.mall_id=organization.id
left join lateral(
  select assignment.membership_id from access.membershiprole assignment
  join access.role role on role.id=assignment.role_id and role.kind='owner' and role.status='active'
  join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
  where membership.organization_id=organization.id and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  order by assignment.effective_at,assignment.membership_id limit 1
) owner on true
where organization.kind='mall';

insert into organization.membership(id,organization_id,source_membership_id,responsibility,status,version,created_at,updated_at)
select 'organizationmembership:'||substr(encode(public.digest(mall.id||':'||mall.owner_membership_id,'sha256'),'hex'),1,32),
  mall.id,mall.owner_membership_id,'owner','active',1,mall.created_at,mall.updated_at
from organization.mall mall;

alter table organization.mall enable row level security;
alter table organization.mall force row level security;
alter table organization.membership enable row level security;
alter table organization.membership force row level security;
alter table organization.directorypreviewsubject enable row level security;
alter table organization.directorypreviewsubject force row level security;
alter table organization.directorypreviewpage enable row level security;
alter table organization.directorypreviewpage force row level security;
create policy migrationaccess on organization.mall for all to shopmigration using(true) with check(true);
create policy migrationaccess on organization.membership for all to shopmigration using(true) with check(true);
create policy migrationaccess on organization.directorypreviewsubject for all to shopmigration using(true) with check(true);
create policy migrationaccess on organization.directorypreviewpage for all to shopmigration using(true) with check(true);
create policy mallapp on organization.mall for all to shopapp using(access.scope_allowed(id)) with check(access.scope_allowed(id));
create policy malljob on organization.mall for all to shopjob using(true) with check(true);
create policy organizationmembershipapp on organization.membership for all to shopapp using(access.scope_allowed(organization_id)) with check(access.scope_allowed(organization_id));
create policy organizationmembershipjob on organization.membership for all to shopjob using(true) with check(true);
create policy directorypreviewjob on organization.directorypreviewsubject for all to shopjob using(true) with check(true);
create policy directorypreviewpagejob on organization.directorypreviewpage for all to shopjob using(true) with check(true);

revoke all on organization.mall,organization.membership,organization.directorypreviewsubject,organization.directorypreviewpage from public;
revoke all on function organization.assert_hierarchy() from public;
grant select,insert,update on organization.mall,organization.membership to shopapp,shopjob;
grant select,insert,delete on organization.directorypreviewsubject to shopjob;
grant select,insert,delete on organization.directorypreviewpage to shopjob;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('organization.malls.create','organization','POST','/api/v1/organization/malls','5.0.0'),
  ('organization.malls.read','organization','GET','/api/v1/organization/malls/{mallid}','5.0.0'),
  ('organization.malls.update','organization','PUT','/api/v1/organization/malls/{mallid}','5.0.0');

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:organization.mall.read','organization.mall.read','high','active','查看商城完整资料'),
  ('permission:organization.mall.manage','organization.mall.manage','critical','active','创建或维护商城')
on conflict(code) do update set risk=excluded.risk,status='active',name_zh=excluded.name_zh;

insert into capability.capability(id,kind,name,version,status) values
  ('organization.malls.create','operation','organization.malls.create',1,'active'),
  ('organization.malls.read','operation','organization.malls.read',1,'active'),
  ('organization.malls.update','operation','organization.malls.update',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('organization.malls.create','organization.malls.create','organization.mall.manage','console',array['console']),
  ('organization.malls.read','organization.malls.read','organization.mall.read','console',array['console']),
  ('organization.malls.update','organization.malls.update','organization.mall.manage','console',array['console']);

insert into capability.dependency(capability_id,depends_on_id) values
  ('organization.malls.create','surface.console'),
  ('organization.malls.read','surface.console'),
  ('organization.malls.update','surface.console');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','organizationmallpublish'
from capability.capability capability where capability.id like 'organization.malls.%';

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':organizationmallpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','organizationmallpublish',clock_timestamp()
from capability.entitlement entitlement where entitlement.capability_id like 'organization.malls.%';

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code in('organization.mall.read','organization.mall.manage')
on conflict(role_id,permission_id) do update set effect='allow';

insert into runtime.event(type,version,owner,schema_ref) values
  ('organization.mall.created',1,'organization','contract://events/organization.mall.created/v1'),
  ('organization.mall.updated',1,'organization','contract://events/organization.mall.updated/v1');

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:304','sha256'),'hex'),
  expected_count=304,observed_count=(select count(*) from runtime.operation),published_at=clock_timestamp()
where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;

update runtime.contractcatalog
set checksum='805a057d1a5e79d5f99b3c1e3b8994e714ffec09ae5dd2da277574c0ea9f270e',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904017000',
  (select count(*) from organization.organization where kind='mall'),
  (select count(*) from organization.mall),0,0,
  'select id,code,public_slug,brand_name,domain_mode,custom_domain,owner_membership_id,currency,theme_preset,opening_state,subject_type,company_name,contact_name,contact_mobile,store_type,primary_category,business_mode,certificate_mode,mini_program_mode,official_account_mode,payment_plan,delivery_mode,invoice_mode,notification_contact,version from organization.mall order by id;',
  'select lower(code),count(*) from organization.mall group by lower(code) having count(*)>1 union all select lower(public_slug),count(*) from organization.mall group by lower(public_slug) having count(*)>1;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904017000','805a057d1a5e79d5f99b3c1e3b8994e714ffec09ae5dd2da277574c0ea9f270e');

do $assert$
begin
  if (select count(*) from organization.organization where kind='mall')<>(select count(*) from organization.mall) then raise exception 'ORGANIZATION_MALL_BACKFILL_MISMATCH'; end if;
  if (select count(*) from organization.organization where parent_id is null)<>1 then raise exception 'ORGANIZATION_ROOT_COUNT_INVALID'; end if;
  if exists(select 1 from organization.organization organization where organization.kind='mall' and not exists(
    select 1 from organization.membership membership where membership.organization_id=organization.id and membership.responsibility='owner' and membership.status='active'
  )) then raise exception 'ORGANIZATION_MALL_OWNER_MISSING'; end if;
  if (select count(*) from runtime.operation)<>304 or (select count(*) from capability.operation)<>304
    or (select count(*) from runtime.event)<>119 then raise exception 'ORGANIZATION_CONTRACT_CATALOG_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0' and status='active'
    and checksum='805a057d1a5e79d5f99b3c1e3b8994e714ffec09ae5dd2da277574c0ea9f270e'
    and operation_count=304 and event_count=119) then raise exception 'ORGANIZATION_CONTRACT_IDENTITY_INVALID'; end if;
end
$assert$;

commit;
