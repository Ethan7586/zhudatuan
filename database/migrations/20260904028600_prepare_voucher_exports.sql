begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028500') then raise exception 'VOUCHER_EXPORT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028600') then raise exception 'VOUCHER_EXPORT_ALREADY_APPLIED'; end if;
end $precondition$;

-- Module-owned projections, not another Runtime task truth. IDs are opaque export
-- references; no cross-module table reads or foreign keys are needed by Voucher.
create table voucher.exportsnapshot(
  id text primary key,
  scope_id text not null,
  kind text not null check(kind in('credential','issueorder','action')),
  source_filter jsonb not null check(jsonb_typeof(source_filter)='object'),
  created_by text not null,
  captured_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>captured_at),
  result_count bigint not null check(result_count>=0),
  unique(id,scope_id)
);
create table voucher.exportsnapshotitem(
  snapshot_id text not null,
  scope_id text not null,
  ordinal bigint not null check(ordinal>0),
  cells jsonb not null check(jsonb_typeof(cells)='array'),
  credential_id text,
  pool_id text,
  number_ciphertext text,
  secret_ciphertext text,
  primary key(snapshot_id,ordinal),
  foreign key(snapshot_id,scope_id) references voucher.exportsnapshot(id,scope_id) on delete cascade,
  check((credential_id is null and pool_id is null and number_ciphertext is null and secret_ciphertext is null)
    or (credential_id is not null and pool_id is not null and number_ciphertext is not null and secret_ciphertext is not null))
);
create index voucher_export_expiry on voucher.exportsnapshot(expires_at,id);

create trigger voucherexportimmutable before update on voucher.exportsnapshot for each row execute function voucher.guard_snapshot_item();
create trigger voucherexportitemimmutable before update on voucher.exportsnapshotitem for each row execute function voucher.guard_snapshot_item();
create function voucher.guard_export_item() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
declare snapshot voucher.exportsnapshot;
begin
  select * into snapshot from voucher.exportsnapshot where id=new.snapshot_id and scope_id=new.scope_id;
  if not found or new.ordinal>snapshot.result_count or snapshot.expires_at<=clock_timestamp() then
    raise exception 'VOUCHER_EXPORT_SNAPSHOT_INVALID';
  end if;
  if snapshot.kind='credential' then
    if new.credential_id is null or jsonb_array_length(new.cells)<>6 or new.cells->>0 is distinct from new.credential_id
      or new.cells->>1 is distinct from new.pool_id then raise exception 'VOUCHER_EXPORT_SNAPSHOT_INVALID'; end if;
  elsif new.credential_id is not null or jsonb_array_length(new.cells)<>(case when snapshot.kind='issueorder' then 8 else 7 end) then
    raise exception 'VOUCHER_EXPORT_SNAPSHOT_INVALID';
  end if;
  if exists(select 1 from jsonb_array_elements(new.cells) cell where jsonb_typeof(cell) not in('string','number','boolean','null')) then
    raise exception 'VOUCHER_EXPORT_SNAPSHOT_INVALID';
  end if;
  return new;
end
$function$;
create trigger voucherexportitemshape before insert on voucher.exportsnapshotitem for each row execute function voucher.guard_export_item();

alter table voucher.exportsnapshot enable row level security;
alter table voucher.exportsnapshot force row level security;
create policy voucherapp on voucher.exportsnapshot for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.exportsnapshot for select to shopjob using(true);
create policy voucherexpiry on voucher.exportsnapshot for delete to shopjob using(expires_at<=clock_timestamp());
revoke all on voucher.exportsnapshot from public;
grant select,insert on voucher.exportsnapshot to shopapp;
grant select,delete on voucher.exportsnapshot to shopjob;
alter table voucher.exportsnapshotitem enable row level security;
alter table voucher.exportsnapshotitem force row level security;
create policy voucherapp on voucher.exportsnapshotitem for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.exportsnapshotitem for select to shopjob using(true);
create policy voucherexpiry on voucher.exportsnapshotitem for delete to shopjob using(exists(
  select 1 from voucher.exportsnapshot snapshot where snapshot.id=snapshot_id and snapshot.scope_id=exportsnapshotitem.scope_id and snapshot.expires_at<=clock_timestamp()));
revoke all on voucher.exportsnapshotitem from public;
grant select,insert on voucher.exportsnapshotitem to shopapp;
grant select,delete on voucher.exportsnapshotitem to shopjob;

select runtime.record_migration_evidence('20260904028600',0,0,0,0,
  'select kind,count(*),sum(result_count) from voucher.exportsnapshot group by kind;',
  'select snapshot.id from voucher.exportsnapshot snapshot left join voucher.exportsnapshotitem item on item.snapshot_id=snapshot.id and item.scope_id=snapshot.scope_id group by snapshot.id having count(item.ordinal)<>snapshot.result_count;');
insert into runtime.schemaversion(version,checksum)
values('20260904028600',encode(public.digest('20260904028600_prepare_voucher_exports','sha256'),'hex'));

do $assert$ begin
  if to_regclass('voucher.exportsnapshot') is null or to_regclass('voucher.exportsnapshotitem') is null
    or has_table_privilege('shopjob','voucher.exportsnapshotitem','insert')
    or has_table_privilege('shopapp','voucher.exportsnapshotitem','update') then
    raise exception 'VOUCHER_EXPORT_SNAPSHOT_BOUNDARY_INVALID';
  end if;
end $assert$;

commit;
