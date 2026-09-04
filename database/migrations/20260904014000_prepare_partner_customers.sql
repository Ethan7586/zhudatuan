begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904013000') then raise exception 'PARTNER_CUSTOMER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904014000') or to_regclass('partner.customer') is not null then
    raise exception 'PARTNER_CUSTOMER_ALREADY_APPLIED';
  end if;
end
$precondition$;

create table partner.customer(
  id text primary key check(id~'^partnercustomer:'),
  tenant_id text not null,
  scope_id text not null,
  identifier_ciphertext text not null check(length(identifier_ciphertext)>=16),
  identifier_hash char(64) not null check(identifier_hash~'^[0-9a-f]{64}$'),
  identifier_key_version text not null check(length(identifier_key_version) between 1 and 128),
  identifier_masked text not null check(length(identifier_masked) between 5 and 64),
  name text not null check(length(name) between 2 and 160),
  kind text not null check(kind in('enterprise','institution','government')),
  status text not null check(status in('draft','active','disabled')),
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(tenant_id,identifier_hash),
  unique(id,tenant_id,scope_id),
  check(updated_at>=created_at)
);

create index partner_customer_scope_page on partner.customer(scope_id,updated_at desc,id desc) include(name,kind,status,version,identifier_masked);
create index partner_customer_name_search on partner.customer(scope_id,lower(name) text_pattern_ops,id);

create table partner.customercontact(
  id text primary key check(id~'^customercontact:'),
  tenant_id text not null,
  scope_id text not null,
  customer_id text not null,
  kind text not null check(kind in('primary','billing','operations')),
  name_ciphertext text not null check(length(name_ciphertext)>=16),
  name_hash char(64) not null check(name_hash~'^[0-9a-f]{64}$'),
  name_key_version text not null check(length(name_key_version) between 1 and 128),
  name_masked text not null check(length(name_masked) between 1 and 128),
  phone_ciphertext text,
  phone_hash char(64),
  phone_key_version text,
  phone_masked text,
  email_ciphertext text,
  email_hash char(64),
  email_key_version text,
  email_masked text,
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  foreign key(customer_id,tenant_id,scope_id) references partner.customer(id,tenant_id,scope_id),
  unique(customer_id,kind),
  check((phone_ciphertext is null and phone_hash is null and phone_key_version is null and phone_masked is null)
    or (length(phone_ciphertext)>=16 and phone_hash~'^[0-9a-f]{64}$' and length(phone_key_version) between 1 and 128 and length(phone_masked)>0)),
  check((email_ciphertext is null and email_hash is null and email_key_version is null and email_masked is null)
    or (length(email_ciphertext)>=16 and email_hash~'^[0-9a-f]{64}$' and length(email_key_version) between 1 and 128 and length(email_masked)>0)),
  check(phone_ciphertext is not null or email_ciphertext is not null),
  check(updated_at>=created_at)
);

create index partner_customer_contact_scope on partner.customercontact(scope_id,customer_id,kind) include(version,name_masked,phone_masked,email_masked);
create index partner_customer_contact_phone on partner.customercontact(tenant_id,phone_hash) where phone_hash is not null;
create index partner_customer_contact_email on partner.customercontact(tenant_id,email_hash) where email_hash is not null;

create table partner.customeragreement(
  id text primary key check(id~'^customeragreement:'),
  tenant_id text not null,
  scope_id text not null,
  customer_id text not null,
  contract_ref text not null check(length(contract_ref) between 2 and 128),
  contract_hash char(64) not null check(contract_hash~'^[0-9a-f]{64}$'),
  capabilities jsonb not null check(jsonb_typeof(capabilities)='array' and jsonb_array_length(capabilities)>0),
  status text not null check(status in('draft','active','expired','terminated')),
  effective_at timestamptz not null,
  expires_at timestamptz not null,
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  foreign key(customer_id,tenant_id,scope_id) references partner.customer(id,tenant_id,scope_id),
  unique(customer_id,version),
  check(expires_at>effective_at),
  check(updated_at>=created_at)
);

create index partner_customer_agreement_active on partner.customeragreement(scope_id,expires_at,customer_id) include(effective_at,version,capabilities) where status='active';
create unique index partner_customer_agreement_current on partner.customeragreement(customer_id) where status in('draft','active');

do $security$
declare target text;
begin
  foreach target in array array['customer','customercontact','customeragreement'] loop
    execute format('alter table partner.%I enable row level security',target);
    execute format('alter table partner.%I force row level security',target);
    execute format('create policy appscope on partner.%I for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id))',target);
    execute format('create policy jobscope on partner.%I for all to shopjob using(true) with check(true)',target);
    execute format('revoke all on table partner.%I from public',target);
    execute format('grant select on partner.%I to shoppartnerreader',target);
    execute format('grant select,insert,update on partner.%I to shoppartnerwriter',target);
  end loop;
end
$security$;

grant select,insert,update on partner.customer,partner.customercontact,partner.customeragreement to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('partner.customers.create','partner','POST','/api/v1/partners/customers','5.0.0'),
  ('partner.customers.update','partner','PATCH','/api/v1/partners/customers/{customerid}','5.0.0'),
  ('partner.customers.enable','partner','POST','/api/v1/partners/customers/{customerid}/enable','5.0.0'),
  ('partner.customers.disable','partner','POST','/api/v1/partners/customers/{customerid}/disable','5.0.0'),
  ('partner.customers.get','partner','GET','/api/v1/partners/customers/{customerid}','5.0.0'),
  ('partner.customers.list','partner','GET','/api/v1/partners/customers','5.0.0'),
  ('partner.customeroptions.list','partner','GET','/api/v1/partners/customer-options','5.0.0');

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:partner.customer.read','partner.customer.read','elevated','active','查看客户'),
  ('permission:partner.customer.manage','partner.customer.manage','high','active','管理客户')
on conflict(code) do update set risk=excluded.risk,status='active',name_zh=excluded.name_zh;

insert into capability.capability(id,kind,name,version,status) values
  ('partner.customers.create','operation','partner.customers.create',1,'active'),
  ('partner.customers.update','operation','partner.customers.update',1,'active'),
  ('partner.customers.enable','operation','partner.customers.enable',1,'active'),
  ('partner.customers.disable','operation','partner.customers.disable',1,'active'),
  ('partner.customers.get','operation','partner.customers.get',1,'active'),
  ('partner.customers.list','operation','partner.customers.list',1,'active'),
  ('partner.customeroptions.list','operation','partner.customeroptions.list',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('partner.customers.create','partner.customers.create','partner.customer.manage','console'),
  ('partner.customers.update','partner.customers.update','partner.customer.manage','console'),
  ('partner.customers.enable','partner.customers.enable','partner.customer.manage','console'),
  ('partner.customers.disable','partner.customers.disable','partner.customer.manage','console'),
  ('partner.customers.get','partner.customers.get','partner.customer.read','console'),
  ('partner.customers.list','partner.customers.list','partner.customer.read','console'),
  ('partner.customeroptions.list','partner.customeroptions.list','partner.customer.read','console');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id like 'partner.customer%'
on conflict(scope_id,capability_id,effective_at) do update set state='enabled',expires_at=null,version=capability.entitlement.version+1;

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code in('partner.customer.read','partner.customer.manage')
on conflict(role_id,permission_id) do update set effect='allow';

select runtime.record_migration_evidence(
  '20260904014000',3,3,0,0,
  'select status,count(*) from partner.customer group by status; select status,count(*) from partner.customeragreement group by status;',
  'select count(*) duplicate_identifiers from(select tenant_id,identifier_hash from partner.customer group by tenant_id,identifier_hash having count(*)>1) duplicate; select count(*) unprotected_contacts from partner.customercontact where name_ciphertext is null or name_hash is null;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904014000',encode(public.digest('20260904014000_prepare_partner_customers','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from partner.customer group by tenant_id,identifier_hash having count(*)>1) then raise exception 'PARTNER_CUSTOMER_IDENTIFIER_DUPLICATE'; end if;
  if exists(select 1 from partner.customercontact where name_ciphertext is null or name_hash is null) then raise exception 'PARTNER_CUSTOMER_CONTACT_UNPROTECTED'; end if;
  if exists(select 1 from partner.customeragreement where expires_at<=effective_at) then raise exception 'PARTNER_CUSTOMER_AGREEMENT_PERIOD_INVALID'; end if;
  if (select count(*) from runtime.operation where id like 'partner.customer%')<>7 then raise exception 'PARTNER_CUSTOMER_CONTRACT_CATALOG_INVALID'; end if;
end
$assert$;

commit;
