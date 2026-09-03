begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903101000') then
    raise exception 'ORDER_FILTER_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903102000') then
    raise exception 'ORDER_FILTER_CONTRACT_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>275
    or (select count(*) from capability.operation)<>275
    or (select count(*) from runtime.event)<>103 then
    raise exception 'ORDER_FILTER_CONTRACT_REGISTRY_INVALID';
  end if;
end
$precondition$;

update runtime.contractcatalog
set checksum='f9761d283f648d0635e157a54147ce70581f72fc141db27ec2b091deaa52f521',
  operation_count=275,published_at=clock_timestamp()
where artifact='commerce' and version='4.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260903102000',275,275,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id in(''order.orders.read'',''order.aftersales.read'') order by id;',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260903102000','f9761d283f648d0635e157a54147ce70581f72fc141db27ec2b091deaa52f521');

do $assert$
begin
  if not exists(
    select 1 from runtime.operation
    where id='order.orders.read' and owner='order' and method='GET'
      and path='/api/v1/orders' and contract_version='4.0.0'
  ) or not exists(
    select 1 from runtime.operation
    where id='order.aftersales.read' and owner='order' and method='GET'
      and path='/api/v1/orders/aftersales' and contract_version='4.0.0'
  ) then
    raise exception 'ORDER_FILTER_OPERATIONS_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='4.0.0' and status='active'
      and checksum='f9761d283f648d0635e157a54147ce70581f72fc141db27ec2b091deaa52f521'
      and operation_count=275 and event_count=103
  ) then
    raise exception 'ORDER_FILTER_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260903102000'
      and checksum='f9761d283f648d0635e157a54147ce70581f72fc141db27ec2b091deaa52f521'
  ) then
    raise exception 'ORDER_FILTER_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
