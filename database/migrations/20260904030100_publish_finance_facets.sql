begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030000') then raise exception 'FINANCE_FACET_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030100') then raise exception 'FINANCE_FACET_ALREADY_APPLIED'; end if;
  if not exists(select 1 from capability.capability where id='finance.overview.read' and status='active') then raise exception 'FINANCE_OVERVIEW_CAPABILITY_MISSING'; end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.facets.read','finance','GET','/api/v1/finance/facets','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('finance.facets.read','operation','读取财务筛选项',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('finance.facets.read','finance.facets.read','finance.overview.read','console','{console}');

insert into capability.dependency(capability_id,depends_on_id) values
  ('finance.facets.read','finance.overview.read');

create index finance_reconciliation_scope_page on finance.reconciliation(scope_id,id) include(period,provider,state,updated_at);
create index finance_reconciliation_scope_period on finance.reconciliation(scope_id,period,id);
create index finance_reconciliation_scope_provider on finance.reconciliation(scope_id,provider,id);
create index finance_reconciliation_scope_state on finance.reconciliation(scope_id,state,id);
create index finance_reconciliationitem_reason on finance.reconciliationitem(reason_code,reconciliation_id) where reason_code is not null;
create index finance_statement_scope_range on finance.statement(scope_id,period_start,period_end,id) include(generated_at);
create index channel_connection_scope_state_provider on channel.connection(scope_id,status,provider);

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values('platform:finance.facets.read','organization-platform-root','finance.facets.read','enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','financefacetpublish');

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':financefacetpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','financefacetpublish',clock_timestamp() from capability.entitlement entitlement
where entitlement.capability_id='finance.facets.read';

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';
update runtime.contractcatalog set checksum='d912492b9fa2b7778eb3166112f51467630b7a722153b3af303123d4a4de6b4b',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260904030100',
  (select count(*) from runtime.operation),(select count(*) from runtime.operation),0,0,
  'select id,owner,method,path from runtime.operation where id=''finance.facets.read'';',
  'select capability_id,depends_on_id from capability.dependency where capability_id=''finance.facets.read'';');
insert into runtime.schemaversion(version,checksum)
values('20260904030100',encode(public.digest('20260904030100_publish_finance_facets','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from runtime.operation)<>368 or (select count(*) from capability.operation)<>368 then raise exception 'FINANCE_FACET_OPERATION_COUNT_INVALID'; end if;
  if not exists(select 1 from capability.operation where operation_id='finance.facets.read' and capability_id='finance.facets.read'
    and permission_code='finance.overview.read' and audience='console' and targets='{console}') then raise exception 'FINANCE_FACET_BINDING_MISSING'; end if;
  if not exists(select 1 from capability.dependency where capability_id='finance.facets.read' and depends_on_id='finance.overview.read') then raise exception 'FINANCE_FACET_DEPENDENCY_MISSING'; end if;
  if (select count(*) from pg_indexes where indexname in('finance_reconciliation_scope_page','finance_reconciliation_scope_period',
    'finance_reconciliation_scope_provider','finance_reconciliation_scope_state','finance_reconciliationitem_reason',
    'finance_statement_scope_range','channel_connection_scope_state_provider'))<>7 then raise exception 'FINANCE_FACET_INDEXES_MISSING'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='d912492b9fa2b7778eb3166112f51467630b7a722153b3af303123d4a4de6b4b' and operation_count=368 and event_count=145 and status='active') then
    raise exception 'FINANCE_FACET_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
