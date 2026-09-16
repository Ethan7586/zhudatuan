begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-display-code:v1'));

create schema if not exists identity_display;

create table identity_display.code_mapping(
  context_id text not null,
  kind text not null check(kind in('operator','member')),
  membership_id text not null,
  code text not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key(context_id,kind,membership_id),
  unique(context_id,kind,code),
  check((kind='operator' and code ~ '^OP-[2-9A-HJKMNP-Z]{4}$')
    or (kind='member' and code ~ '^MB-[2-9A-HJKMNP-Z]{6}$'))
);

revoke all on schema identity_display from public;
revoke all on identity_display.code_mapping from public;
grant usage on schema identity_display to shopapp;
grant select,insert on identity_display.code_mapping to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260916150000',encode(public.digest('identity-display-code:v1','sha256'),'hex'));

commit;
