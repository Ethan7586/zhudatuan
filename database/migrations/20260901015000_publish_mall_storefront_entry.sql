begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260901014000') then
    raise exception 'MALL_STOREFRONT_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901015000') then
    raise exception 'MALL_STOREFRONT_CONTRACT_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from runtime.operation
    where id='experience.applications.detail.read'
      and owner='experience'
      and method='GET'
      and path='/api/v1/experiences/applications/{applicationid}'
      and contract_version='3.0.0') then
    raise exception 'MALL_STOREFRONT_DETAIL_OPERATION_MISSING';
  end if;
end
$precondition$;

update runtime.contractcatalog
set checksum='0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260901015000',1,1,0,0,
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';',
  'select id,owner,method,path,contract_version from runtime.operation where id=''experience.applications.detail.read'';');

insert into runtime.schemaversion(version,checksum)
values('20260901015000','0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7');

do $assert$
begin
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce'
      and version='3.0.0'
      and checksum='0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)
      and status='active') then
    raise exception 'MALL_STOREFRONT_CONTRACT_PUBLICATION_INVALID';
  end if;
  if (select count(*) from runtime.operation)<>271 or (select count(*) from capability.operation)<>271 then raise exception 'MALL_STOREFRONT_CONTRACT_OPERATION_COUNT_INVALID'; end if;
  if not exists(select 1 from runtime.mvpauthority where id='mvp:operations' and expected_count=271 and observed_count=271) then raise exception 'MALL_STOREFRONT_CONTRACT_MVP_AUTHORITY_INVALID'; end if;
end
$assert$;

commit;
