begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:member-identity-4x4:v1'));

create table identity_display.member_store_segment(
  context_id text primary key,
  storefront_node_id text not null unique,
  segment text not null unique check(segment ~ '^[0-9A-HJKMNP-Z]{4}$'),
  created_at timestamptz not null default transaction_timestamp()
);

create table identity_display.member_code_mapping(
  context_id text not null references identity_display.member_store_segment(context_id),
  membership_id text primary key,
  suffix text not null check(suffix ~ '^[0-9A-HJKMNP-Z]{4}$'),
  code text not null unique check(code ~ '^MB-[0-9A-HJKMNP-Z]{8}$'),
  created_at timestamptz not null default transaction_timestamp(),
  unique(context_id,suffix)
);

create index identity_display_member_code_context_membership
  on identity_display.member_code_mapping(context_id,membership_id);

revoke all on identity_display.member_store_segment from public;
revoke all on identity_display.member_code_mapping from public;
grant select,insert on identity_display.member_store_segment to shopapp;
grant select,insert on identity_display.member_code_mapping to shopapp;

-- The six-character MB codes were disposable test identifiers; OP assignments are untouched.
delete from identity_display.code_mapping where kind='member';

insert into runtime.schemaversion(version,checksum)
values('20260917120000',encode(public.digest('member-identity-4x4:v1','sha256'),'hex'));

commit;
