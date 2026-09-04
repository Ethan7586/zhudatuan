begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903112000') then raise exception 'FEDERATION_CENTER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260903113000') then raise exception 'FEDERATION_CENTER_ALREADY_APPLIED'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='d21463e1526a44a08445f3a629bb41b2bb0bf0a03c6802a3d0137e592a12dead' and operation_count=275 and event_count=103 and status='active') then
    raise exception 'FEDERATION_CENTER_PREVIOUS_CONTRACT_INVALID';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.providers.center.read','identity','GET','/api/v1/identity/providers/center','5.0.0');
insert into capability.capability(id,kind,name,version,status)
values('identity.providers.center.read','operation','identity.providers.center.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.providers.center.read','identity.providers.center.read','identity.provider.manage','console');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select scope_id||':identity.providers.center.read',scope_id,'identity.providers.center.read',state,quota,effective_at,expires_at,0
from capability.entitlement where capability_id='identity.providers.read';

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority set checksum=encode(public.digest('packages/contract/definitions/operations.yml:276','sha256'),'hex'),
  expected_count=276,observed_count=276,published_at=clock_timestamp() where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;

update runtime.contractcatalog set checksum='9fe623baf3766a8165fae54ff209324619f9fd39a17dfdbfdb927665deb9b42d',
  operation_count=276,event_count=103,published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260903113000',1,1,0,0,
  'select id,owner,method,path from runtime.operation where id=''identity.providers.center.read'';',
  'select operation_id,capability_id,permission_code,audience from capability.operation where operation_id=''identity.providers.center.read'';');
insert into runtime.schemaversion(version,checksum) values('20260903113000','9fe623baf3766a8165fae54ff209324619f9fd39a17dfdbfdb927665deb9b42d');

do $assert$
begin
  if not exists(select 1 from capability.operation where operation_id='identity.providers.center.read' and permission_code='identity.provider.manage' and audience='console') then raise exception 'FEDERATION_CENTER_BINDING_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0' and checksum='9fe623baf3766a8165fae54ff209324619f9fd39a17dfdbfdb927665deb9b42d' and operation_count=276 and event_count=103 and status='active') then raise exception 'FEDERATION_CENTER_CONTRACT_INVALID'; end if;
end
$assert$;

commit;
