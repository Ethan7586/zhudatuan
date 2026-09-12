create schema catalog;
create schema experience;
create schema checkout;
create schema ordering;
create schema payment;
create schema finance;
create schema inventory;
create schema fulfillment;

alter table identity.principal add column version bigint not null default 0;
alter table identity.account add column version bigint not null default 0;
alter table access.membership add column joined_at timestamptz;

create table member.profile(
  id text primary key,
  principal_id text not null unique references identity.principal(id),
  display_name text not null,
  mobile_ciphertext text,
  mobile_token char(64),
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0
);
create table access.role(
  id text primary key,scope_id text not null,name text not null,status text not null,version bigint not null default 0
);
create table access.membershiprole(
  membership_id text not null references access.membership(id),role_id text not null references access.role(id),
  effective_at timestamptz not null,expires_at timestamptz,delegated_by text,
  primary key(membership_id,role_id,effective_at)
);
create table access.scopegrant(
  id text primary key,membership_id text not null references access.membership(id),scope_kind text not null,
  scope_id text not null,scope_path text not null,effect text not null,effective_at timestamptz not null,
  expires_at timestamptz,access_version bigint not null
);
create table access.mallowner(
  mall_id text primary key references organization.organization(id),
  organization_id text not null unique references organization.organization(id),scope_id text not null unique,
  membership_id text not null unique references access.membership(id),
  source_membership_id text not null references access.membership(id),created_at timestamptz not null
);
create table organization.sourcebinding(
  source_type text not null,source_id text not null,
  organization_id text not null references organization.organization(id),source_code text not null,
  primary key(source_type,source_id),unique(organization_id,source_type)
);

create table catalog.pool(
  id text primary key,scope_id text not null,kind text not null,name text not null,status text not null,version bigint not null
);
create table catalog.poolbinding(
  mall_id text not null,pool_id text not null references catalog.pool(id),listing_kind text not null,
  status text not null,effective_at timestamptz not null,created_at timestamptz not null,
  primary key(mall_id,pool_id)
);
create table catalog.poolitem(pool_id text not null references catalog.pool(id),item_id text not null,primary key(pool_id,item_id));
create table catalog.listing(id text primary key,scope_id text not null);

create table experience.application(
  id text primary key,scope_id text not null,code text not null,public_slug text not null,name text not null,
  status text not null,head_version_id text,created_at timestamptz not null,updated_at timestamptz not null,version bigint not null
);
create table experience.version(
  id text primary key,application_id text not null references experience.application(id),sequence bigint not null,
  schema_version text not null,configuration jsonb not null,configuration_hash char(64) not null,
  validation_state text not null,reason text not null,created_by text not null,created_at timestamptz not null
);
alter table experience.application add constraint experience_application_head_version
  foreign key(head_version_id) references experience.version(id) deferrable initially deferred;
create table experience.binding(
  application_id text not null references experience.application(id),domain text not null,mall_id text not null,
  pool_id text not null references catalog.pool(id),primary key(application_id,mall_id,pool_id)
);

create table checkout.session(id text primary key,mall_id text not null);
create table ordering.orderrecord(id text primary key,mall_id text not null);
create table payment.capture(id text primary key,mall_id text not null);
create table payment.refund(id text primary key,mall_id text not null);
create table finance.account(id text primary key,scope_id text not null);
create table finance.entry(id text primary key,account_id text not null references finance.account(id));
create table inventory.stockitem(id text primary key,scope_id text not null);
create table inventory.movement(id text primary key,mall_id text not null,stockitem_id text not null references inventory.stockitem(id));
create table fulfillment.fulfillmentorder(id text primary key,mall_id text not null);

insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at) values
  ('organization:company-clone-root','platform',null,'公司克隆验收根','Asia/Shanghai','active',1,clock_timestamp(),clock_timestamp()),
  ('enterprise:company-clone-source','enterprise','organization:company-clone-root','公司克隆源经营主体','Asia/Shanghai','active',1,clock_timestamp(),clock_timestamp());
update organization.organization set parent_id='enterprise:company-clone-source',name='公司克隆源商城',version=1
where id='mall-zhudatuan';
insert into organization.unitclosure(ancestor_id,descendant_id,depth) values
  ('organization:company-clone-root','organization:company-clone-root',0),
  ('organization:company-clone-root','enterprise:company-clone-source',1),
  ('organization:company-clone-root','mall-zhudatuan',2),
  ('enterprise:company-clone-source','enterprise:company-clone-source',0),
  ('enterprise:company-clone-source','mall-zhudatuan',1);

insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
values('principal:company-clone-source','active',1,clock_timestamp(),clock_timestamp(),0);
insert into identity.account(
  id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,version
) values('account:company-clone-source','realm:l0','principal:company-clone-source','active',1,2,
  clock_timestamp(),clock_timestamp(),0);
insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
values('credential:company-clone-source','principal:company-clone-source','password',
  encode(public.digest('company-clone-source-subject','sha256'),'hex'),'fixture-source-secret-hash','active',
  clock_timestamp(),'realm:l0','account:company-clone-source');
insert into member.profile(
  id,principal_id,display_name,mobile_ciphertext,mobile_token,status,created_at,updated_at,version
) values('member:company-clone-source','principal:company-clone-source','公司克隆源所有者','fixture-mobile-ciphertext',
  encode(public.digest('13800001234','sha256'),'hex'),'active',clock_timestamp(),clock_timestamp(),0);
insert into access.membership(
  id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id,node_profile
) values('membership:company-clone-source','member:company-clone-source','mall-zhudatuan','operator','active',3,
  clock_timestamp(),'realm:l0','account:company-clone-source','operating_mall');
insert into access.role(id,scope_id,name,status,version) values('role:self','self','self','active',1);
insert into access.membershiprole(membership_id,role_id,effective_at)
values('membership:company-clone-source','role:self','2026-09-01T00:00:00Z');
insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
  ('scope:company-clone-source:mall','membership:company-clone-source','mall','mall-zhudatuan','mall-zhudatuan','allow','2026-09-01T00:00:00Z',3),
  ('scope:company-clone-source:self','membership:company-clone-source','self','self:principal:company-clone-source','self:principal:company-clone-source','allow','2026-09-01T00:00:00Z',3);
insert into identity.realmtarget(
  realm_id,surface,target,membership_client,membership_organization_id,application_slug,return_origin,created_at,node_profile
) values('realm:l0','operator','company-clone-source-console','operator','mall-zhudatuan',null,
  'https://console.company-clone.test','2026-09-01T00:00:00Z','operating_mall');
insert into identity.session(
  id,principal_id,membership_id,token_hash,credential_version,access_version,client,assurance_level,
  realm_id,account_id,auth_target,expires_at,last_seen_at,created_at
) values('session:company-clone-source','principal:company-clone-source','membership:company-clone-source',
  encode(public.digest('company-clone-source-session','sha256'),'hex'),1,3,'operator',2,'realm:l0',
  'account:company-clone-source','company-clone-source-console',clock_timestamp()+interval '1 day',clock_timestamp(),clock_timestamp());

insert into catalog.pool(id,scope_id,kind,name,status,version)
values('pool:company-clone-source','mall-zhudatuan','private','公司克隆源模板商品池','active',2);
insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
values('mall-zhudatuan','pool:company-clone-source','selected','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
values('application:company-clone-source','mall-zhudatuan','COMPANY_CLONE_SOURCE','company-clone-source',
  '公司克隆源商城','published','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',4);
insert into experience.version(
  id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at
) values('version:company-clone-source:v4','application:company-clone-source',4,'experience.v1',
  '{"application":"application:company-clone-source","mallName":"公司克隆源商城","theme":"source-template"}',
  repeat('a',64),'valid','source template','principal:company-clone-source','2026-09-01T00:00:00Z');
update experience.application set head_version_id='version:company-clone-source:v4'
where id='application:company-clone-source';
insert into experience.binding(application_id,domain,mall_id,pool_id)
values('application:company-clone-source','company-clone-source','mall-zhudatuan','pool:company-clone-source');

insert into checkout.session(id,mall_id) values('checkout:company-clone-source','mall-zhudatuan');
insert into ordering.orderrecord(id,mall_id) values('order:company-clone-source','mall-zhudatuan');
insert into payment.capture(id,mall_id) values('capture:company-clone-source','mall-zhudatuan');
insert into payment.refund(id,mall_id) values('refund:company-clone-source','mall-zhudatuan');
insert into finance.account(id,scope_id) values('finance-account:company-clone-source','mall-zhudatuan');
insert into finance.entry(id,account_id) values('finance-entry:company-clone-source','finance-account:company-clone-source');
insert into inventory.stockitem(id,scope_id) values('stock:company-clone-source','mall-zhudatuan');
insert into inventory.movement(id,mall_id,stockitem_id)
values('movement:company-clone-source','mall-zhudatuan','stock:company-clone-source');
insert into fulfillment.fulfillmentorder(id,mall_id) values('fulfillment:company-clone-source','mall-zhudatuan');

insert into runtime.schemaversion(version,checksum)
values('20260912190000','ed34c5c7137ce60aaf6995781f9a0e7a3f0792bb1a3bcefb27a8c6486a808515');
