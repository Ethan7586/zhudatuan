begin;

select pg_advisory_xact_lock(hashtext('catalog:media-replication-persistence:v2'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912200000'
        and checksum='c68b7a5a79051d781f53f9e4db32c9c52d3c3b899e776b861a96280d6355cf70')
    or exists(select 1 from runtime.schemaversion where version>'20260912200000') then
    raise exception 'CATALOG_MEDIA_PERSISTENCE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create table catalog.mediaobject(
  media_id text primary key,
  object_key text not null unique,
  sha256 char(64) not null,
  content_type text not null,
  byte_size bigint not null,
  overall_status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table catalog.mediareplica(
  media_id text not null references catalog.mediaobject(media_id) on delete cascade,
  target_id text not null,
  provider text not null,
  bucket text not null,
  public_url text not null,
  required boolean not null,
  upload_status text not null,
  verification_status text not null,
  error text,
  updated_at timestamptz not null,
  primary key(media_id,target_id)
);

create table catalog.productmedia(
  product_id text not null references catalog.product(id) on delete cascade,
  media_id text not null references catalog.mediaobject(media_id),
  purpose text not null,
  position integer not null,
  state text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key(product_id,purpose,position)
);

insert into runtime.schemaversion(version,checksum)
values('20260912210000','f1cf6a31ded78182cd64d96f45d81d75ef658b191a4c56bd8402cca18f0de485');

do $assert$
begin
  if to_regclass('catalog.mediaobject') is null
    or to_regclass('catalog.mediareplica') is null
    or to_regclass('catalog.productmedia') is null
    or not exists(select 1 from runtime.schemaversion
      where version='20260912210000'
        and checksum='f1cf6a31ded78182cd64d96f45d81d75ef658b191a4c56bd8402cca18f0de485') then
    raise exception 'CATALOG_MEDIA_PERSISTENCE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
