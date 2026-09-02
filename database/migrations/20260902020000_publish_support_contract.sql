begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902019000') then
    raise exception 'SUPPORT_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902020000') then
    raise exception 'SUPPORT_CONTRACT_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>272 then
    raise exception 'SUPPORT_CONTRACT_PREVIOUS_OPERATION_COUNT_INVALID';
  end if;
end
$precondition$;

alter table runtime.operation drop constraint runtime_operation_contract_v3;
update runtime.operation set contract_version='4.0.0';
insert into runtime.operation(id,owner,method,path,contract_version) values
  ('support.events.read','support','GET','/api/v1/support/events','4.0.0'),
  ('support.readstates.manage','support','PUT','/api/v1/support/conversations/{conversationid}/readstate','4.0.0');

insert into runtime.event(type,version,owner,schema_ref) values
  ('support.ticket.updated',1,'support','contract://events/support.ticket.updated/v1'),
  ('support.ticket.closed',1,'support','contract://events/support.ticket.closed/v1'),
  ('support.ticket.reopened',1,'support','contract://events/support.ticket.reopened/v1'),
  ('support.readstate.updated',1,'support','contract://events/support.readstate.updated/v1'),
  ('support.attachment.ready',1,'support','contract://events/support.attachment.ready/v1'),
  ('support.attachment.rejected',1,'support','contract://events/support.attachment.rejected/v1');

alter table runtime.errorcontract disable row level security;
update runtime.errorcontract set contract_version='4.0.0';
insert into runtime.errorcontract(code,status,retryable,audit,client,contract_version) values
  ('IDENTITY_ALREADY_EXISTS',409,false,true,'message','4.0.0'),
  ('EMPLOYEE_NUMBER_CONFLICT',409,false,true,'message','4.0.0'),
  ('INVITATION_KIND_DENIED',403,false,true,'message','4.0.0'),
  ('SUPPORT_TICKET_NOT_WRITABLE',409,false,false,'message','4.0.0'),
  ('SUPPORT_AGENT_INVALID',409,false,true,'message','4.0.0'),
  ('SUPPORT_CLIENT_MESSAGE_CONFLICT',409,false,true,'message','4.0.0'),
  ('SUPPORT_ATTACHMENT_NOT_READY',409,false,false,'message','4.0.0'),
  ('SUPPORT_ATTACHMENT_REJECTED',422,false,true,'message','4.0.0'),
  ('SUPPORT_EVENT_CURSOR_EXPIRED',410,false,false,'message','4.0.0'),
  ('SUPPORT_STREAM_UNAVAILABLE',503,true,false,'retry','4.0.0');
alter table runtime.errorcontract enable row level security;

insert into access.permission(id,code,risk,status) values
  ('permission:3a535d9b83a3642906b53ed5','support.event.read','elevated','active'),
  ('permission:6dd9b7b9b5a10cdb877cf23a','support.readstate.manage','low','active');

insert into capability.capability(id,kind,name,version,status) values
  ('support.events.read','operation','support.events.read',3,'active'),
  ('support.readstates.manage','operation','support.readstates.manage',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('support.events.read','support.events.read','support.event.read','public'),
  ('support.readstates.manage','support.readstates.manage','support.readstate.manage','public');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:support.events.read','organization-platform-root','support.events.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:support.readstates.manage','organization-platform-root','support.readstates.manage','enabled',null,'1970-01-01T00:00:00Z',null,0);

insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission
where permission.code in('support.event.read','support.readstate.manage') on conflict do nothing;

alter table runtime.operation add constraint runtime_operation_contract_v4 check(contract_version='4.0.0') not valid;
alter table runtime.operation validate constraint runtime_operation_contract_v4;

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:274','sha256'),'hex'),
  expected_count=274,observed_count=274,published_at=clock_timestamp()
where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;

update runtime.contractcatalog set status='retired' where artifact='commerce' and status='active';
insert into runtime.contractcatalog(artifact,version,checksum,operation_count,event_count,status,published_at)
values('commerce','4.0.0','6a59888cfc18032dc6df9d173404c90791f80f733f46599fcde1a03952671661',
  (select count(*) from runtime.operation),(select count(*) from runtime.event),'active',clock_timestamp());

select runtime.record_migration_evidence(
  '20260902020000',274,274,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where owner=''support'' order by id;',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' order by published_at desc;'
);
insert into runtime.schemaversion(version,checksum)
values('20260902020000','6a59888cfc18032dc6df9d173404c90791f80f733f46599fcde1a03952671661');

do $assert$
begin
  if (select count(*) from runtime.operation)<>274 or (select count(*) from capability.operation)<>274 then
    raise exception 'SUPPORT_CONTRACT_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from runtime.operation where owner='support')<>20 then
    raise exception 'SUPPORT_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from runtime.event where owner='support')<>9 then
    raise exception 'SUPPORT_EVENT_COUNT_INVALID';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'4.0.0') then
    raise exception 'LEGACY_CONTRACT_VERSION_REMAINS';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='4.0.0' and status='active' and operation_count=274) then
    raise exception 'SUPPORT_CONTRACT_CATALOG_INVALID';
  end if;
end
$assert$;

commit;
