begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260907011000') then raise exception 'SUPPLIER_WORKFLOW_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260907012000') then raise exception 'SUPPLIER_WORKFLOW_ALREADY_APPLIED'; end if;
end
$precondition$;

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:cd84a0aaf90370eb1e57d6b8','fulfillment.work.manage','high','active','处理门店或供应商履约'),
  ('permission:8c72db31708dac97f6430118','catalog.price.manage','high','active','维护当前范围商品报价')
on conflict(code) do update set risk=excluded.risk,status='active',name_zh=excluded.name_zh;

update capability.operation set targets='{console,supplier}' where operation_id in(
  'runtime.uploads.create','finance.statements.read','finance.statements.export','finance.reconciliations.read',
  'invoice.requests.read','channel.connections.read','channel.connections.test');
update capability.operation set permission_code='fulfillment.work.manage',targets='{console,store,supplier}'
where operation_id='fulfillment.workitems.transition';
update capability.operation set permission_code='catalog.price.manage',targets='{console,supplier}'
where operation_id='catalog.listings.price.set';
update capability.operation set targets='{console}' where operation_id in(
  'catalog.products.archive','catalog.listings.publish','catalog.listings.pool.set','catalog.listings.unpublish',
  'catalog.listings.batch','pricing.rules.create','pricing.rules.publish');
update capability.operation set targets='{console,store}' where operation_id='identity.handovers.read';

delete from access.rolepermission where permission_id in(select id from access.permission where code='fulfillment.store.manage');
delete from access.permission legacy where legacy.code='fulfillment.store.manage'
  and not exists(select 1 from capability.operation operation where operation.permission_code=legacy.code);

alter table access.roletemplate drop constraint roletemplate_code_check;
alter table access.roletemplate add constraint roletemplate_code_check check(code in(
  'malloperator','catalogoperator','ordersupport','financeoperator','financereviewer','storeoperator','supplieroperator','administrator','custom'));

insert into access.roletemplate(code,name,description,allows,denies,state,version,created_at,updated_at) values(
  'supplieroperator','供应商操作员','适合供应商商品提交、报价库存、接单发货、退货质检、账单对账、发票、连接健康和客服协同',
  array[
    'member.profile.read','catalog.product.read','catalog.product.manage','catalog.listing.read','catalog.price.manage','catalog.import.manage','catalog.import.read',
    'runtime.import.manage','inventory.read','inventory.import.manage','inventory.import.read',
    'fulfillment.read','fulfillment.work.manage','fulfillment.ship','fulfillment.return.manage',
    'finance.statement.read','finance.reconciliation.read','invoice.request.read',
    'channel.connection.read','channel.connection.manage',
    'support.case.read','support.message.read','support.message.send','support.readstate.manage'
  ],
  array[
    'catalog.listing.manage','finance.reconciliation.manage','invoice.request.decide','approval.task.decide','member.manage'
  ],'active',1,clock_timestamp(),clock_timestamp())
on conflict(code) do update set name=excluded.name,description=excluded.description,allows=excluded.allows,
  denies=excluded.denies,state='active',version=greatest(access.roletemplate.version,excluded.version),updated_at=clock_timestamp();

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code='fulfillment.work.manage'
on conflict(role_id,permission_id) do update set effect='allow';

update access.role set version=version+1 where kind='owner' and status='active';
update access.membership membership set access_version=access_version+1 where membership.status='active' and exists(
  select 1 from access.membershiprole assignment join access.role role on role.id=assignment.role_id
  where assignment.membership_id=membership.id and role.kind='owner' and role.status='active'
    and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()));

update capability.capabilityset set version=version+1,updated_at=clock_timestamp()
where scope_id='organization-platform-root';
update runtime.contractcatalog set status='retired' where artifact='commerce' and status='active' and version<>'5.0.0';
update runtime.contractcatalog catalog set checksum=fingerprint.checksum,
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),
  status='active',published_at=clock_timestamp()
from (select encode(public.digest(
  coalesce((select string_agg(id||chr(31)||owner||chr(31)||method||chr(31)||path||chr(31)||contract_version,chr(30) order by id) from runtime.operation),'')
  ||chr(29)||coalesce((select string_agg(type||chr(31)||version::text||chr(31)||owner||chr(31)||schema_ref,chr(30) order by type,version)
    from runtime.event where retired_at is null),''),'sha256'),'hex') checksum) fingerprint
where catalog.artifact='commerce' and catalog.version='5.0.0';

select runtime.record_migration_evidence('20260907012000',
  (select count(*) from runtime.operation where id in(
    'runtime.uploads.create','fulfillment.workitems.transition','finance.statements.read','finance.statements.export',
    'finance.reconciliations.read','invoice.requests.read','channel.connections.read','channel.connections.test')),
  (select count(*) from capability.operation where operation_id in(
    'runtime.uploads.create','fulfillment.workitems.transition','finance.statements.read','finance.statements.export',
    'finance.reconciliations.read','invoice.requests.read','channel.connections.read','channel.connections.test')),0,0,
  'select operation_id,permission_code,targets from capability.operation where operation_id in(''runtime.uploads.create'',''fulfillment.workitems.transition'',''finance.statements.read'',''finance.statements.export'',''finance.reconciliations.read'',''invoice.requests.read'',''channel.connections.read'',''channel.connections.test'') order by operation_id;',
  'select code,name,allows,denies from access.roletemplate where code=''supplieroperator'';');

insert into runtime.schemaversion(version,checksum)
values('20260907012000',encode(public.digest('20260907012000_complete_supplier_workflow','sha256'),'hex'));
update runtime.schemahead set migration_head='20260907012000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:supplier',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if not exists(select 1 from access.roletemplate where code='supplieroperator' and state='active'
    and allows @> array['catalog.product.manage','catalog.price.manage','inventory.import.manage','fulfillment.work.manage','fulfillment.ship','fulfillment.return.manage']
    and denies @> array['catalog.listing.manage','finance.reconciliation.manage','approval.task.decide','member.manage'])
    then raise exception 'SUPPLIER_OPERATOR_TEMPLATE_INVALID'; end if;
  if exists(select 1 from access.permission where code='fulfillment.store.manage') then raise exception 'LEGACY_FULFILLMENT_PERMISSION_RETAINED'; end if;
  if exists(select 1 from capability.operation where operation_id in(
    'runtime.uploads.create','finance.statements.read','finance.statements.export','finance.reconciliations.read',
    'invoice.requests.read','channel.connections.read','channel.connections.test') and not(targets @> array['supplier']))
    then raise exception 'SUPPLIER_OPERATION_TARGET_MISSING'; end if;
  if not exists(select 1 from capability.operation where operation_id='fulfillment.workitems.transition'
    and permission_code='fulfillment.work.manage' and targets='{console,store,supplier}')
    then raise exception 'SUPPLIER_FULFILLMENT_TARGET_INVALID'; end if;
  if not exists(select 1 from capability.operation where operation_id='catalog.listings.price.set'
    and permission_code='catalog.price.manage' and targets='{console,supplier}')
    then raise exception 'SUPPLIER_PRICE_PERMISSION_INVALID'; end if;
  if exists(select 1 from capability.operation where operation_id in(
    'catalog.products.archive','catalog.listings.publish','catalog.listings.pool.set','catalog.listings.unpublish',
    'catalog.listings.batch','pricing.rules.create','pricing.rules.publish') and targets @> array['supplier'])
    then raise exception 'SUPPLIER_PLATFORM_WRITE_EXPOSED'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260907012000'
    and migration_count=(select count(*) from runtime.schemaversion)) then raise exception 'SUPPLIER_WORKFLOW_HEAD_INVALID'; end if;
end
$assert$;

commit;
