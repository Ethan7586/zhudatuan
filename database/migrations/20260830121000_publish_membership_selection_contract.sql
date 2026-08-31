begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830120000') then
    raise exception 'MEMBERSHIP_SELECTION_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830121000') then
    raise exception 'MEMBERSHIP_SELECTION_CONTRACT_ALREADY_APPLIED';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='3ae4d1682baad5308e286b0be0aabb0cccd1c61b62d858f26943b46d67713361',
    operation_count=237,event_count=78,published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830121000',1,
  (select count(*) from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='3ae4d1682baad5308e286b0be0aabb0cccd1c61b62d858f26943b46d67713361'
    and operation_count=237 and event_count=78),0,0,
  'create index concurrently if not exists runtime_contractcatalog_active_live on runtime.contractcatalog(artifact,version,status);',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'';');
insert into runtime.schemaversion(version,checksum)
values('20260830121000','3ae4d1682baad5308e286b0be0aabb0cccd1c61b62d858f26943b46d67713361');

do $assert$ begin
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='3ae4d1682baad5308e286b0be0aabb0cccd1c61b62d858f26943b46d67713361'
    and operation_count=237 and event_count=78) then
    raise exception 'MEMBERSHIP_SELECTION_CONTRACT_INVALID';
  end if;
end $assert$;

commit;
