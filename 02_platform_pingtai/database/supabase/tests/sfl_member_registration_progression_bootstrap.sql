create role zhudatuanidentityapi nologin noinherit;
create schema access;
create schema member;

create table organization.organization(
  id text primary key,
  kind text not null,
  status text not null
);

create table identity.registrationpolicy(
  id text primary key,
  terms_hash char(64) not null,
  effective_at timestamptz not null,
  retired_at timestamptz
);

create table access.membership(
  id text primary key,
  member_id text not null,
  organization_id text not null,
  client text not null,
  status text not null,
  realm_id text not null references identity.realm(id),
  account_id text,
  node_profile text not null
);

create table member.invite(
  id text primary key,
  organization_id text not null,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by text not null,
  role_id text not null,
  allowed_destination_hash char(64),
  max_uses integer not null,
  use_count integer not null,
  effective_at timestamptz not null,
  status text not null,
  registration_policy_id text not null references identity.registrationpolicy(id),
  terms_hash char(64) not null,
  version bigint not null default 0,
  target_client text not null,
  storefront_organization_id text
);

create function access.registration_invite_role_allowed(text,text,text)
returns boolean language sql immutable as $$select true$$;

insert into organization.organization(id,kind,status) values
  ('mall-zhudatuan','mall','active'),('mall:direct:l3','mall','active'),('mall:direct:l5','mall','active');
insert into identity.registrationpolicy(id,terms_hash,effective_at)
values('policy:registration','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','2026-09-01T00:00:00Z');
