begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904063000') then raise exception 'IDEAL_VOUCHER_RETIRE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904064000') then raise exception 'IDEAL_VOUCHER_RETIRE_ALREADY_APPLIED'; end if;
  if not exists(select 1 from runtime.migrationevidence where migration='20260904052000'
    and source_rows=target_rows and source_minor=target_minor)
  then raise exception 'IDEAL_VOUCHER_RETIRE_EVIDENCE_MISSING'; end if;
end
$precondition$;

create table voucher.retirement(
  id text primary key check(id~'^voucherretirement:'),
  tenant_id text not null,
  scope_id text not null,
  source_family text not null unique,
  state text not null check(state in('observing','deletable','deleted')),
  source_rows bigint not null check(source_rows>=0),
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  observation_until timestamptz not null,
  approved_by text not null,
  approved_at timestamptz not null,
  version bigint not null check(version>0),
  check(observation_until>approved_at)
);
insert into voucher.retirement(
  id,tenant_id,scope_id,source_family,state,source_rows,source_hash,observation_until,approved_by,approved_at,version)
select 'voucherretirement:legacy','organization-platform-root','organization-platform-root','cardlibraryprogramreservebatchbinding',
  'observing',(select count(*) from voucher.migrationsource),
  encode(public.digest(coalesce(string_agg(source_table||chr(31)||source_id||chr(31)||source_hash,chr(30)
    order by source_table,source_id),''),'sha256'),'hex'),
  clock_timestamp()+interval '7 days','migration:voucher',clock_timestamp(),1
from voucher.migrationsource;
alter table voucher.retirement enable row level security;
alter table voucher.retirement force row level security;
create policy migrationaccess on voucher.retirement for all to shopmigration using(true) with check(true);
create policy voucherretirementread on voucher.retirement for select to shopread,shopjob using(true);
revoke all on voucher.retirement from public,shopapp;
grant select on voucher.retirement to shopread,shopjob;

drop policy if exists appscope on voucher.legacyprogram;
drop policy if exists jobscope on voucher.legacyprogram;
drop policy if exists appscope on voucher.legacyprogramversion;
drop policy if exists jobscope on voucher.legacyprogramversion;
drop policy if exists appscope on voucher.legacycardpool;
drop policy if exists jobscope on voucher.legacycardpool;
drop policy if exists appscope on voucher.legacycredential;
drop policy if exists jobscope on voucher.legacycredential;
drop policy if exists appscope on voucher.legacyallocation;
drop policy if exists jobscope on voucher.legacyallocation;
drop policy if exists appscope on voucher.legacystockrequest;
drop policy if exists jobscope on voucher.legacystockrequest;
drop policy if exists appscope on voucher.legacyapproval;
drop policy if exists jobscope on voucher.legacyapproval;
drop policy if exists appscope on voucher.legacyissuebatch;
drop policy if exists jobscope on voucher.legacyissuebatch;
drop policy if exists appscope on voucher.legacyvoucher;
drop policy if exists jobscope on voucher.legacyvoucher;
drop policy if exists appscope on voucher.legacytimeline;
drop policy if exists jobscope on voucher.legacytimeline;
drop policy if exists appscope on voucher.legacyreserve;
drop policy if exists jobscope on voucher.legacyreserve;
drop policy if exists appscope on voucher.legacyredemption;
drop policy if exists jobscope on voucher.legacyredemption;
drop policy if exists appscope on voucher.legacyrefund;
drop policy if exists jobscope on voucher.legacyrefund;
drop policy if exists appscope on voucher.legacyhold;
drop policy if exists jobscope on voucher.legacyhold;
drop policy if exists appscope on voucher.legacyactionbatch;
drop policy if exists jobscope on voucher.legacyactionbatch;
drop policy if exists appscope on voucher.legacyactionitem;
drop policy if exists jobscope on voucher.legacyactionitem;
drop policy if exists appscope on voucher.legacyimportjob;
drop policy if exists jobscope on voucher.legacyimportjob;
drop policy if exists appscope on voucher.legacyimportrow;
drop policy if exists jobscope on voucher.legacyimportrow;
drop policy if exists appscope on voucher.legacyimporterror;
drop policy if exists jobscope on voucher.legacyimporterror;
drop policy if exists allocatedscope on voucher.legacycardpool;
drop policy if exists allocatedscope on voucher.legacycredential;

revoke all on voucher.legacyprogram,voucher.legacyprogramversion,voucher.legacycardpool,voucher.legacycredential,
  voucher.legacyallocation,voucher.legacystockrequest,voucher.legacyapproval,voucher.legacyissuebatch,
  voucher.legacyvoucher,voucher.legacytimeline,voucher.legacyreserve,voucher.legacyredemption,voucher.legacyrefund,
  voucher.legacyhold,voucher.legacyactionbatch,voucher.legacyactionitem,voucher.legacyimportjob,
  voucher.legacyimportrow,voucher.legacyimporterror from public,shopapp,shopjob,shopread;

select runtime.record_migration_evidence('20260904064000',
  (select count(*) from voucher.migrationsource),(select source_rows from voucher.retirement where id='voucherretirement:legacy'),0,0,
  'select source_table,count(*) from voucher.migrationsource group by source_table order by source_table;',
  'select id,source_family,state,source_rows,source_hash,observation_until from voucher.retirement order by id;');
insert into runtime.schemaversion(version,checksum)
values('20260904064000',encode(public.digest('20260904064000_retire_legacy_voucher','sha256'),'hex'));

commit;
