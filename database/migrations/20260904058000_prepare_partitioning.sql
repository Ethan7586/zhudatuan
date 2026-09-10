begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904057000') then raise exception 'IDEAL_PARTITION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904058000') then raise exception 'IDEAL_PARTITION_ALREADY_APPLIED'; end if;
end
$precondition$;

create table runtime.partitionpolicy(
  relation_name text primary key check(relation_name~'^[a-z]+\.[a-z]+$'),
  timestamp_column text not null check(timestamp_column~'^[a-z_]+$'),
  interval_kind text not null check(interval_kind in('day','month')),
  future_partitions integer not null check(future_partitions between 2 and 36),
  retention_days integer not null check(retention_days between 30 and 3650),
  archive_schema text not null check(archive_schema='audit'),
  archive_required boolean not null,
  state text not null check(state in('prepared','active')),
  version bigint not null check(version>0),
  updated_by text not null,
  updated_at timestamptz not null
);
insert into runtime.partitionpolicy(
  relation_name,timestamp_column,interval_kind,future_partitions,retention_days,archive_schema,archive_required,state,version,updated_by,updated_at)
values
  ('runtime.outbox','occurred_at','month',6,365,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('runtime.inbox','received_at','month',6,365,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('audit.record','recorded_at','month',12,2555,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('ordering.stateevent','occurred_at','month',6,730,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('inventory.movement','occurred_at','month',6,730,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('finance.entry','created_at','month',12,3650,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('notification.dispatch','created_at','month',6,365,'audit',true,'prepared',1,'migration:partition',clock_timestamp()),
  ('channel.webhookinbox','received_at','month',6,365,'audit',true,'prepared',1,'migration:partition',clock_timestamp());
alter table runtime.partitionpolicy enable row level security;
alter table runtime.partitionpolicy force row level security;
create policy migrationaccess on runtime.partitionpolicy for all to shopmigration using(true) with check(true);
create policy partitionpolicyread on runtime.partitionpolicy for select to shopread,shopapp,shopjob using(true);
revoke all on runtime.partitionpolicy from public;
grant select on runtime.partitionpolicy to shopread,shopapp,shopjob;

select runtime.record_migration_evidence('20260904058000',8,8,0,0,
  'select relation_name,timestamp_column,interval_kind,future_partitions,retention_days,archive_schema,archive_required,state from runtime.partitionpolicy order by relation_name;',
  'select id,scope_id,record_count,object_size,expires_at from audit.archiveref order by archived_at desc;');
insert into runtime.schemaversion(version,checksum)
values('20260904058000',encode(public.digest('20260904058000_prepare_partitioning','sha256'),'hex'));

do $assert$
declare policyrow record;
begin
  for policyrow in select * from runtime.partitionpolicy loop
    if to_regclass(policyrow.relation_name) is null then raise exception 'IDEAL_PARTITION_RELATION_MISSING:%',policyrow.relation_name; end if;
    if not exists(select 1 from information_schema.columns where
      table_schema=split_part(policyrow.relation_name,'.',1) and table_name=split_part(policyrow.relation_name,'.',2)
      and column_name=policyrow.timestamp_column and data_type='timestamp with time zone')
    then raise exception 'IDEAL_PARTITION_COLUMN_INVALID:%',policyrow.relation_name; end if;
  end loop;
end
$assert$;

commit;
