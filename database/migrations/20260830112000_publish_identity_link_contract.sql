begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830111000') then
    raise exception 'IDENTITY_LINK_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830112000') then
    raise exception 'IDENTITY_LINK_CONTRACT_ALREADY_APPLIED';
  end if;
end $precondition$;

insert into runtime.event(type,version,owner,schema_ref)
values('identity.link.required',1,'identity','contract://events/identity.link.required/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;
update runtime.contractcatalog
set checksum='a143ec06991a889acbc3261b819e58932e318cf040f9e651c60a4d97b0067302',event_count=78,
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830112000',1,
  (select count(*) from runtime.event where type='identity.link.required' and version=1 and owner='identity'),0,0,
  'create index concurrently if not exists runtime_event_identity_link_live on runtime.event(type,version) where type=''identity.link.required'';',
  'select type,version,owner,schema_ref from runtime.event where type=''identity.link.required'';');
insert into runtime.schemaversion(version,checksum)
values('20260830112000','a143ec06991a889acbc3261b819e58932e318cf040f9e651c60a4d97b0067302');

do $assert$ begin
  if (select count(*) from runtime.event)<>78 then raise exception 'IDENTITY_LINK_EVENT_COUNT_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='a143ec06991a889acbc3261b819e58932e318cf040f9e651c60a4d97b0067302' and event_count=78) then
    raise exception 'IDENTITY_LINK_CONTRACT_CHECKSUM_INVALID';
  end if;
end $assert$;

commit;
