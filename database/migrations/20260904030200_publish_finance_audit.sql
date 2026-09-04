begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030100') then raise exception 'FINANCE_AUDIT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030200') then raise exception 'FINANCE_AUDIT_ALREADY_APPLIED'; end if;
  if not exists(select 1 from capability.capability where id='audit.records.read' and status='active') then raise exception 'AUDIT_RECORD_CAPABILITY_MISSING'; end if;
  if not exists(select 1 from access.permission where code='audit.read' and status='active') then raise exception 'AUDIT_READ_PERMISSION_MISSING'; end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.audit.read','finance','GET','/api/v1/finance/audit','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('finance.audit.read','operation','读取财务业务证据链',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('finance.audit.read','finance.audit.read','audit.read','console','{console}');

insert into capability.dependency(capability_id,depends_on_id) values
  ('finance.audit.read','finance.overview.read'),
  ('finance.audit.read','audit.records.read');

create index runtime_outbox_scope_aggregate_time on runtime.outbox(scope_id,aggregate_id,occurred_at desc,id desc);

create function runtime.event_evidence(p_scopes text[],p_resources text[])
returns table(id text,type text,event_version integer,aggregate_type text,aggregate_id text,state text,occurred_at timestamptz,trace_id text)
language sql stable security definer
set search_path=runtime,access,pg_temp
set row_security=off
as $function$
  select event.id,event.event_type,event.event_version,event.aggregate_type,event.aggregate_id,
    case when event.failed_at is not null then 'failed' when event.published_at is not null then 'published' else 'pending' end,
    event.occurred_at,event.trace_id
  from runtime.outbox event
  where event.scope_id=any(p_scopes) and access.scope_allowed(event.scope_id)
    and (event.aggregate_id=any(p_resources) or event.id=any(p_resources))
  order by event.occurred_at desc,event.id desc limit 200
$function$;
revoke all on function runtime.event_evidence(text[],text[]) from public;
grant execute on function runtime.event_evidence(text[],text[]) to shopapp,shopjob;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values('platform:finance.audit.read','organization-platform-root','finance.audit.read','enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','financeauditpublish');

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':financeauditpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','financeauditpublish',clock_timestamp() from capability.entitlement entitlement
where entitlement.capability_id='finance.audit.read';

update access.roletemplate set allows=array_append(allows,'audit.read'),version=version+1,updated_at=clock_timestamp()
where code in('financeoperator','financereviewer','administrator') and not(allows@>array['audit.read']);

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';
update runtime.contractcatalog set checksum='b108f2f4afaf219f3008a9e53465da4d278188b076368300fd843ca3f405d52f',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260904030200',
  (select count(*) from runtime.operation),(select count(*) from runtime.operation),0,0,
  'select id,owner,method,path from runtime.operation where id=''finance.audit.read'';',
  'select capability_id,depends_on_id from capability.dependency where capability_id=''finance.audit.read'' order by depends_on_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904030200',encode(public.digest('20260904030200_publish_finance_audit','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from runtime.operation)<>369 or (select count(*) from capability.operation)<>369 then raise exception 'FINANCE_AUDIT_OPERATION_COUNT_INVALID'; end if;
  if not exists(select 1 from capability.operation where operation_id='finance.audit.read' and capability_id='finance.audit.read'
    and permission_code='audit.read' and audience='console' and targets='{console}') then raise exception 'FINANCE_AUDIT_BINDING_MISSING'; end if;
  if (select count(*) from capability.dependency where capability_id='finance.audit.read'
    and depends_on_id in('finance.overview.read','audit.records.read'))<>2 then raise exception 'FINANCE_AUDIT_DEPENDENCIES_MISSING'; end if;
  if not exists(select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='runtime' and procedure.proname='event_evidence') then raise exception 'RUNTIME_EVENT_EVIDENCE_PORT_MISSING'; end if;
  if (select count(*) from access.roletemplate where code in('financeoperator','financereviewer','administrator')
    and allows@>array['audit.read'])<>3 then raise exception 'FINANCE_AUDIT_ROLE_TEMPLATE_MISSING'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='b108f2f4afaf219f3008a9e53465da4d278188b076368300fd843ca3f405d52f' and operation_count=369 and event_count=145 and status='active') then
    raise exception 'FINANCE_AUDIT_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
