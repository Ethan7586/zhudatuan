begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904049000') then raise exception 'IDEAL_VOUCHER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904050000') then raise exception 'IDEAL_VOUCHER_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema='voucher' and table_name in(
    'product','productversion','credentialpool','credential','stockrequest','issueorder','issuebatch','issueitem',
    'voucher','holder','timeline','tenderhold','redemption','refund','actionbatch','actionitem'))<>16
  then raise exception 'IDEAL_VOUCHER_TABLES_MISSING'; end if;
end
$precondition$;

create table voucher.migrationsource(
  tenant_id text not null,
  scope_id text not null,
  source_table text not null check(source_table in(
    'program','cardpool','credential','issuebatch','voucher','reserve','redemption','refund')),
  source_id text not null,
  target_table text not null check(target_table in(
    'product','credentialpool','credential','issuebatch','voucher','tenderhold','redemption','refund')),
  target_id text not null,
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  migrated_by text not null,
  migrated_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(source_table,source_id),
  unique(target_table,target_id)
);
alter table voucher.migrationsource enable row level security;
alter table voucher.migrationsource force row level security;
create policy migrationaccess on voucher.migrationsource for all to shopmigration using(true) with check(true);
create policy migrationsourcejob on voucher.migrationsource for all to shopjob using(true) with check(true);
revoke all on voucher.migrationsource from public,shopapp;
grant select on voucher.migrationsource to shopread;
grant select,insert on voucher.migrationsource to shopjob;

select runtime.record_migration_evidence('20260904050000',
  (select count(*) from voucher.voucher),(select count(*) from voucher.voucher),
  (select coalesce(sum(remaining_minor),0) from voucher.voucher),(select coalesce(sum(remaining_minor),0) from voucher.voucher),
  'select table_name from information_schema.tables where table_schema=''voucher'' order by table_name;',
  'select state,count(*),sum(remaining_minor) from voucher.voucher group by state;');
insert into runtime.schemaversion(version,checksum)
values('20260904050000',encode(public.digest('20260904050000_prepare_voucher_model','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from voucher.credential where number_ciphertext='' or secret_ciphertext=''
    or number_fingerprint!~'^[0-9a-f]{64}$' or secret_fingerprint!~'^[0-9a-f]{64}$' or key_version='')
  then raise exception 'IDEAL_VOUCHER_SECRET_METADATA_INVALID'; end if;
  if exists(select voucher_id from voucher.tenderhold where state='active' group by voucher_id having count(*)>1)
  then raise exception 'IDEAL_VOUCHER_ACTIVE_HOLD_DUPLICATE'; end if;
end
$assert$;

commit;
