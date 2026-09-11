create extension if not exists pgcrypto;
create role zhudatuanprovisioningapi nologin noinherit;
create schema runtime;
create schema identity;
create schema organization;

create table runtime.schemaversion(
  version text primary key,
  checksum char(64) not null
);

create table identity.realm(
  id text primary key,
  node_id text not null unique,
  status text not null check(status in('active','disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0 check(version>=0),
  node_profile text not null check(node_profile in('operating_mall','consumer')),
  mall_id text,
  host_node_id text,
  host_node_profile text,
  unique(id,node_profile),
  unique(node_id,node_profile),
  check(id~'^realm:[a-z0-9][a-z0-9-]{0,62}$'),
  check(node_id~'^node:[a-z0-9][a-z0-9-]{0,62}:l[0-9]{1,3}$'),
  check((node_profile='operating_mall' and mall_id is not null and host_node_id is null and host_node_profile is null)
    or (node_profile='consumer' and mall_id is null and host_node_id is not null
      and host_node_profile='operating_mall' and host_node_id<>node_id)),
  foreign key(host_node_id,host_node_profile) references identity.realm(node_id,node_profile)
);

insert into identity.realm(
  id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
) values
  ('realm:l0','node:zhudatuan:l0','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',
    'operating_mall','mall-zhudatuan',null,null),
  ('realm:l1','node:hbbtzn:l1','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',
    'operating_mall','mall:hbbtzn',null,null);

insert into runtime.schemaversion(version,checksum)
values('20260911010000','33504f898d2ba5f955ffd8c87584f57fa18d6d7290c567639049fc4f24f2a350');
