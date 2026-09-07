begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:create-identity-realm-accounts:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_REALM_ACCOUNT_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907113000'
        and checksum='8f76706e2dcccbb24c984f0f000fd4d2846832dc0b2b304046283345e1022e4f')
    or exists(select 1 from runtime.schemaversion where version>'20260907113000') then
    raise exception 'IDENTITY_REALM_ACCOUNT_PREDECESSOR_INVALID';
  end if;
  if to_regclass('identity.credential') is null or to_regclass('access.membership') is null then
    raise exception 'IDENTITY_REALM_ACCOUNT_SOURCE_MISSING';
  end if;
end
$precondition$;

create table identity.realm(
  id text primary key,
  node_id text not null unique,
  status text not null check(status in('active','disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0 check(version>=0),
  check(id ~ '^realm:[a-z0-9][a-z0-9-]{0,62}$'),
  check(node_id ~ '^[a-z0-9][a-z0-9-]{0,62}$')
);

create table identity.realmentry(
  host text primary key,
  realm_id text not null references identity.realm(id),
  kind text not null check(kind in('accounts','api','storefront')),
  status text not null check(status in('active','disabled')),
  created_at timestamptz not null,
  unique(realm_id,host),
  check(host=lower(host) and host ~ '^[a-z0-9.-]+$')
);

create table identity.realmtarget(
  realm_id text not null references identity.realm(id),
  surface text not null check(surface in('admin','consumer')),
  target text not null,
  membership_client text not null check(membership_client in('operator','storefront','store','supplier')),
  membership_organization_id text not null,
  application_slug text,
  return_origin text not null,
  created_at timestamptz not null,
  primary key(realm_id,target),
  unique(target),
  check(target ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  check((surface='consumer' and membership_client='storefront' and application_slug is not null)
    or (surface='admin' and application_slug is null)),
  check(return_origin ~ '^https://[a-z0-9.-]+(?::[0-9]+)?(?:/[^[:space:]]*)?$')
);

create table identity.account(
  id text primary key,
  realm_id text not null references identity.realm(id),
  legacy_principal_id text references identity.principal(id),
  status text not null check(status in('pending','active','locked','disabled')),
  credential_version bigint not null default 1 check(credential_version>0),
  assurance_level smallint not null default 0 check(assurance_level between 0 and 3),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0 check(version>=0),
  unique(id,realm_id),
  check(id ~ '^account:[a-z0-9][A-Za-z0-9:_-]{2,190}$')
);
create unique index identity_account_realm_legacy_principal_unique
  on identity.account(realm_id,legacy_principal_id) where legacy_principal_id is not null;

insert into identity.realm(id,node_id,status,created_at,updated_at)
values
  ('realm:l0','l0','active',clock_timestamp(),clock_timestamp()),
  ('realm:l1','l1','active',clock_timestamp(),clock_timestamp());

insert into identity.realmentry(host,realm_id,kind,status,created_at)
values
  ('accounts.zhudatuan.com','realm:l0','accounts','active',clock_timestamp()),
  ('api.zhudatuan.com','realm:l0','api','active',clock_timestamp()),
  ('accounts.hbbtzn.com','realm:l1','accounts','active',clock_timestamp()),
  ('api.hbbtzn.com','realm:l1','api','active',clock_timestamp()),
  ('hbbtzn.com','realm:l1','storefront','active',clock_timestamp());

insert into identity.realmtarget(realm_id,surface,target,membership_client,membership_organization_id,application_slug,return_origin,created_at)
values
  ('realm:l0','admin','console','operator','tenant-zhudatuan',null,'https://console.zhudatuan.com',clock_timestamp()),
  ('realm:l0','admin','store','store','tenant-zhudatuan',null,'https://console.zhudatuan.com/entrances/store',clock_timestamp()),
  ('realm:l0','admin','supplier','supplier','tenant-zhudatuan',null,'https://console.zhudatuan.com/entrances/supplier',clock_timestamp()),
  ('realm:l0','consumer','storefront','storefront','mall-zhudatuan','zhudatuan-storefront','https://zhudatuan.com',clock_timestamp()),
  ('realm:l1','admin','console-hbbtzn','operator','mall:d1708f04df2dd8a61736852c4900fb43',null,'https://console.hbbtzn.com',clock_timestamp()),
  ('realm:l1','consumer','storefront-hbbtzn','storefront','mall:d1708f04df2dd8a61736852c4900fb43','zdt-l1-verify','https://hbbtzn.com',clock_timestamp());

insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,version)
select 'account:'||mapping.realm_id||':'||substr(encode(public.digest(mapping.principal_id,'sha256'::text),'hex'),1,32),
  mapping.realm_id,mapping.principal_id,principal.status,principal.credential_version,0,
  principal.created_at,principal.updated_at,principal.version
from (
  select distinct profile.principal_id,
    case
      when membership.organization_id in('tenant-zhudatuan','mall-zhudatuan') then 'realm:l0'
      when membership.organization_id='mall:d1708f04df2dd8a61736852c4900fb43' then 'realm:l1'
    end realm_id
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  where membership.organization_id in('tenant-zhudatuan','mall-zhudatuan','mall:d1708f04df2dd8a61736852c4900fb43')
) mapping
join identity.principal principal on principal.id=mapping.principal_id;

alter table access.membership add column realm_id text;
alter table access.membership add column account_id text;
alter table access.membership add constraint membership_realm_account_pair
  check((realm_id is null)=(account_id is null));
alter table access.membership add constraint membership_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
create index access_membership_realm_account_idx on access.membership(realm_id,account_id,status);

update access.membership membership
set realm_id=account.realm_id,account_id=account.id
from member.profile profile
join identity.account account on account.legacy_principal_id=profile.principal_id
where profile.id=membership.member_id
  and account.realm_id=case
    when membership.organization_id in('tenant-zhudatuan','mall-zhudatuan') then 'realm:l0'
    when membership.organization_id='mall:d1708f04df2dd8a61736852c4900fb43' then 'realm:l1'
  end;

alter table identity.credential add column realm_id text;
alter table identity.credential add column account_id text;
alter table identity.credential drop constraint credential_provider_subject_hash_key;
alter table identity.credential add constraint credential_realm_account_pair
  check((realm_id is null)=(account_id is null));
alter table identity.credential add constraint credential_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
create unique index identity_credential_realm_provider_subject_unique
  on identity.credential(realm_id,provider,subject_hash) where realm_id is not null;
create index identity_credential_account_status_idx on identity.credential(account_id,status,provider);

with ranked as (
  select credential.id credential_id,account.id account_id,account.realm_id,
    row_number() over(partition by credential.id order by account.realm_id) position
  from identity.credential credential
  join identity.account account on account.legacy_principal_id=credential.principal_id
)
update identity.credential credential
set account_id=ranked.account_id,realm_id=ranked.realm_id
from ranked where ranked.credential_id=credential.id and ranked.position=1;

insert into identity.credential(id,principal_id,provider,subject_hash,subject_ciphertext,subject_key_version,secret_hash,encrypted_secret,
  status,rotated_at,created_at,realm_id,account_id)
select 'credential:realm-backfill:'||substr(encode(public.digest(source.id||':'||account.id,'sha256'::text),'hex'),1,40),
  source.principal_id,source.provider,source.subject_hash,source.subject_ciphertext,source.subject_key_version,source.secret_hash,
  source.encrypted_secret,source.status,source.rotated_at,source.created_at,account.realm_id,account.id
from identity.credential source
join identity.account account on account.legacy_principal_id=source.principal_id
where source.account_id is not null
  and not exists(select 1 from identity.credential existing
    where existing.account_id=account.id and existing.provider=source.provider and existing.subject_hash=source.subject_hash);

alter table identity.federatedidentity add column realm_id text;
alter table identity.federatedidentity add column account_id text;
alter table identity.federatedidentity add constraint federatedidentity_realm_account_pair
  check((realm_id is null)=(account_id is null));
alter table identity.federatedidentity add constraint federatedidentity_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
create index identity_federatedidentity_account_idx on identity.federatedidentity(account_id,status,provider);
update identity.federatedidentity federated
set realm_id=membership.realm_id,account_id=membership.account_id
from access.membership membership
where membership.id=federated.membership_id and membership.realm_id is not null;

grant select on identity.realm,identity.realmentry,identity.realmtarget to shopapp,shopjob,zhudatuanidentityapi;
grant select,insert,update,delete on identity.account to shopapp,shopjob,zhudatuanidentityapi;

alter table identity.realm enable row level security;
alter table identity.realmentry enable row level security;
alter table identity.realmtarget enable row level security;
alter table identity.account enable row level security;

create policy appread on identity.realm for select to shopapp using(current_setting('app.workload',true)='api');
create policy appread on identity.realmentry for select to shopapp using(current_setting('app.workload',true)='api');
create policy appread on identity.realmtarget for select to shopapp using(current_setting('app.workload',true)='api');
create policy appscope on identity.account for all to shopapp
  using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobread on identity.realm for select to shopjob using(true);
create policy jobread on identity.realmentry for select to shopjob using(true);
create policy jobread on identity.realmtarget for select to shopjob using(true);
create policy jobscope on identity.account for all to shopjob using(true) with check(true);
create policy identityapi on identity.realm for select to zhudatuanidentityapi using(true);
create policy identityapi on identity.realmentry for select to zhudatuanidentityapi using(true);
create policy identityapi on identity.realmtarget for select to zhudatuanidentityapi using(true);
create policy identityapi on identity.account for all to zhudatuanidentityapi using(true) with check(true);

insert into runtime.schemaversion(version,checksum)
values('20260907120000','d0a23337279f44c222ef1b385caaefe9562a20689caafde703dea6e9fed38b96');

do $assert$
begin
  if (select count(*) from identity.realm where status='active')<>2
    or (select count(*) from identity.realmentry where status='active')<>5
    or (select count(*) from identity.realmtarget)<>6 then
    raise exception 'IDENTITY_REALM_REGISTRY_INCOMPLETE';
  end if;
  if exists(
      select 1 from access.membership membership
      where membership.organization_id in('tenant-zhudatuan','mall-zhudatuan','mall:d1708f04df2dd8a61736852c4900fb43')
        and (membership.realm_id is null or membership.account_id is null)) then
    raise exception 'IDENTITY_REALM_MEMBERSHIP_BACKFILL_INCOMPLETE';
  end if;
  if exists(
      select 1 from identity.account account
      join identity.credential source on source.principal_id=account.legacy_principal_id
      where not exists(select 1 from identity.credential credential
        where credential.account_id=account.id and credential.provider=source.provider and credential.subject_hash=source.subject_hash)) then
    raise exception 'IDENTITY_REALM_CREDENTIAL_BACKFILL_INCOMPLETE';
  end if;
  if exists(select 1 from identity.credential credential join identity.account account on account.id=credential.account_id
      where credential.realm_id<>account.realm_id)
    or exists(select 1 from access.membership membership join identity.account account on account.id=membership.account_id
      where membership.realm_id<>account.realm_id)
    or not exists(select 1 from runtime.schemaversion
      where version='20260907120000'
        and checksum='d0a23337279f44c222ef1b385caaefe9562a20689caafde703dea6e9fed38b96') then
    raise exception 'IDENTITY_REALM_ACCOUNT_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
