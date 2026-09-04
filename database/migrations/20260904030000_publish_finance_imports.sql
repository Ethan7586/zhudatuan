begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029900') then raise exception 'FINANCE_IMPORT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030000') then raise exception 'FINANCE_IMPORT_ALREADY_APPLIED'; end if;
  if not exists(select 1 from capability.capability where id='runtime.importing' and status='active') then raise exception 'RUNTIME_IMPORTING_CAPABILITY_MISSING'; end if;
end
$precondition$;

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:finance.statement.import','finance.statement.import','high','active','导入支付或供应商账单');

insert into access.rolepermission(role_id,permission_id,effect)
select source.role_id,target.id,'allow' from access.rolepermission source
join access.permission existing on existing.id=source.permission_id and existing.code='finance.reconciliation.manage'
cross join access.permission target
where source.effect='allow' and target.code='finance.statement.import'
on conflict(role_id,permission_id,effect) do nothing;

update access.roletemplate set allows=array(
  select distinct value from unnest(allows||array['finance.statement.import']) value order by value
),version=version+1,updated_at=clock_timestamp()
where code in('financeoperator','administrator') and not(allows@>array['finance.statement.import']);

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.statementimports.create','finance','POST','/api/v1/finance/statement-imports','5.0.0'),
  ('finance.statementimports.read','finance','GET','/api/v1/finance/statement-imports/{importid}','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('finance.statementimports.create','operation','创建财务账单导入',1,'active'),
  ('finance.statementimports.read','operation','查看财务账单导入',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('finance.statementimports.create','finance.statementimports.create','finance.statement.import','console','{console}'),
  ('finance.statementimports.read','finance.statementimports.read','finance.statement.read','console','{console}');

insert into capability.dependency(capability_id,depends_on_id) values
  ('finance.statementimports.create','runtime.importing'),
  ('finance.statementimports.read','runtime.importing');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||id,'organization-platform-root',id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','financeimportpublish'
from capability.capability where id in('finance.statementimports.create','finance.statementimports.read');

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':financeimportpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','financeimportpublish',clock_timestamp() from capability.entitlement entitlement
where entitlement.capability_id in('finance.statementimports.create','finance.statementimports.read');

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';
update runtime.contractcatalog set checksum='de42836093df2689aacc05ccf61ae4609b76dfe737b20e9f9dbb42749bb1946a',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260904030000',
  (select count(*) from runtime.operation),(select count(*) from runtime.operation),0,0,
  'select id,owner,method,path from runtime.operation where id like ''finance.statementimports.%'' order by id;',
  'select role_id,effect from access.rolepermission where permission_id=''permission:finance.statement.import'' order by role_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904030000',encode(public.digest('20260904030000_publish_finance_imports','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from runtime.operation)<>367 or (select count(*) from capability.operation)<>367 then raise exception 'FINANCE_IMPORT_OPERATION_COUNT_INVALID'; end if;
  if not exists(select 1 from access.permission where code='finance.statement.import' and risk='high' and status='active') then raise exception 'FINANCE_IMPORT_PERMISSION_MISSING'; end if;
  if (select count(*) from capability.dependency where capability_id in('finance.statementimports.create','finance.statementimports.read') and depends_on_id='runtime.importing')<>2 then
    raise exception 'FINANCE_IMPORT_RUNTIME_DEPENDENCY_MISSING';
  end if;
  if not exists(select 1 from access.roletemplate where code='financeoperator' and allows@>array['finance.statement.import']) then raise exception 'FINANCE_OPERATOR_IMPORT_PERMISSION_MISSING'; end if;
  if exists(select 1 from access.roletemplate where code='financereviewer' and allows@>array['finance.statement.import']) then raise exception 'FINANCE_REVIEWER_IMPORT_SEPARATION_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='de42836093df2689aacc05ccf61ae4609b76dfe737b20e9f9dbb42749bb1946a' and operation_count=367 and event_count=145 and status='active') then
    raise exception 'FINANCE_IMPORT_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
