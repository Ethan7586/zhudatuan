begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260907010000') then raise exception 'STORE_WORKFLOW_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260907011000') then raise exception 'STORE_WORKFLOW_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table approval.templates drop constraint templates_subject_kind_check;
alter table approval.templates add constraint templates_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction','inventoryadjustment'));
alter table approval.template_versions drop constraint template_versions_subject_kind_check;
alter table approval.template_versions add constraint template_versions_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction','inventoryadjustment'));
alter table approval.instances drop constraint instances_subject_kind_check;
alter table approval.instances add constraint instances_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction','inventoryadjustment'));
alter table approval.proofs drop constraint proofs_subject_kind_check;
alter table approval.proofs add constraint proofs_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction','inventoryadjustment'));

create table inventory.adjustmentrequest(
  id text primary key check(id~'^inventoryadjustment:'),
  tenant_id text not null,
  scope_id text not null,
  stockitem_id text not null references inventory.stockitem(id),
  sku_id text not null,
  location_id text not null,
  quantity_delta bigint not null check(quantity_delta<>0 and abs(quantity_delta)<=1000000000),
  reason text not null check(length(reason) between 1 and 1000),
  state text not null check(state in('pending','approved','rejected','cancelled','applied')),
  approval_instance_id text not null references approval.instances(id),
  requested_by text not null references access.membership(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null check(version>=0),
  unique(approval_instance_id),
  check(updated_at>=created_at)
);
create index inventory_adjustment_scope_page on inventory.adjustmentrequest(scope_id,created_at desc,id)
  include(stockitem_id,sku_id,location_id,state,approval_instance_id,requested_by,version);
create unique index inventory_adjustment_pending_stock on inventory.adjustmentrequest(scope_id,stockitem_id)
  where state='pending';

create table identity.storehandover(
  id text primary key check(id~'^storehandover:'),
  tenant_id text not null,
  scope_id text not null,
  principal_id text not null references identity.principal(id),
  membership_id text not null references access.membership(id),
  session_id text not null,
  note text not null check(length(note) between 1 and 500),
  handed_over_at timestamptz not null,
  version bigint not null check(version>0),
  unique(session_id),
  foreign key(session_id,principal_id,membership_id) references identity.session(id,principal_id,membership_id)
);
create index identity_handover_scope_page on identity.storehandover(scope_id,handed_over_at desc,id)
  include(membership_id,session_id,version);

create table fulfillment.storeaction(
  id text primary key check(id~'^storeaction:'),
  tenant_id text not null,
  scope_id text not null,
  fulfillment_id text not null references fulfillment.fulfillmentorder(id),
  action text not null check(action in('accept','progress','ready','complete')),
  state text not null check(state in('accepted','processing','ready','completed')),
  note text check(note is null or length(note)<=1000),
  actor_id text not null references access.membership(id),
  idempotency_key text not null,
  occurred_at timestamptz not null,
  version bigint not null check(version>0),
  unique(fulfillment_id,idempotency_key)
);
create index fulfillment_storeaction_timeline on fulfillment.storeaction(fulfillment_id,occurred_at,id)
  include(scope_id,action,state,actor_id,version);

alter table inventory.adjustmentrequest enable row level security;
alter table inventory.adjustmentrequest force row level security;
create policy appscope on inventory.adjustmentrequest for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on inventory.adjustmentrequest for all to shopjob using(true) with check(true);
create policy moduleowner on inventory.adjustmentrequest for all to shopinventoryowner using(true) with check(true);
create policy moduleread on inventory.adjustmentrequest for select to shopinventoryowner using(true);
create policy modulereader on inventory.adjustmentrequest for select to shopinventoryreader using(true);
create policy modulewriter on inventory.adjustmentrequest for all to shopinventorywriter using(true) with check(true);
create policy migrationaccess on inventory.adjustmentrequest for all to shopmigration using(true) with check(true);
revoke all on inventory.adjustmentrequest from public;
grant select,insert,update on inventory.adjustmentrequest to shopapp,shopjob,shopinventorywriter;
grant select on inventory.adjustmentrequest to shopinventoryreader;
alter table inventory.adjustmentrequest owner to shopinventoryowner;

alter table identity.storehandover enable row level security;
alter table identity.storehandover force row level security;
create policy appscope on identity.storehandover for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy moduleowner on identity.storehandover for all to shopidentityowner using(true) with check(true);
create policy moduleread on identity.storehandover for select to shopidentityowner using(true);
create policy modulereader on identity.storehandover for select to shopidentityreader using(true);
create policy modulewriter on identity.storehandover for all to shopidentitywriter using(true) with check(true);
create policy migrationaccess on identity.storehandover for all to shopmigration using(true) with check(true);
revoke all on identity.storehandover from public;
grant select,insert on identity.storehandover to shopapp,shopidentitywriter;
grant select on identity.storehandover to shopidentityreader;
alter table identity.storehandover owner to shopidentityowner;

alter table fulfillment.storeaction enable row level security;
alter table fulfillment.storeaction force row level security;
create policy appscope on fulfillment.storeaction for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on fulfillment.storeaction for all to shopjob using(true) with check(true);
create policy moduleowner on fulfillment.storeaction for all to shopfulfillmentowner using(true) with check(true);
create policy moduleread on fulfillment.storeaction for select to shopfulfillmentowner using(true);
create policy modulereader on fulfillment.storeaction for select to shopfulfillmentreader using(true);
create policy modulewriter on fulfillment.storeaction for all to shopfulfillmentwriter using(true) with check(true);
create policy migrationaccess on fulfillment.storeaction for all to shopmigration using(true) with check(true);
revoke all on fulfillment.storeaction from public;
grant select,insert on fulfillment.storeaction to shopapp,shopjob,shopfulfillmentwriter;
grant select on fulfillment.storeaction to shopfulfillmentreader;
alter table fulfillment.storeaction owner to shopfulfillmentowner;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.handovers.read','identity','GET','/api/v1/identity/handovers','5.0.0'),
  ('identity.handovers.create','identity','POST','/api/v1/identity/handovers','5.0.0'),
  ('inventory.adjustments.read','inventory','GET','/api/v1/inventory/adjustments','5.0.0'),
  ('inventory.adjustments.create','inventory','POST','/api/v1/inventory/adjustments','5.0.0'),
  ('fulfillment.workitems.read','fulfillment','GET','/api/v1/fulfillments/workitems','5.0.0'),
  ('fulfillment.workitems.transition','fulfillment','PUT','/api/v1/fulfillments/{fulfillmentid}/transition','5.0.0'),
  ('fulfillment.returns.read','fulfillment','GET','/api/v1/fulfillments/returns','5.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:cd84a0aaf90370eb1e57d6b8','fulfillment.work.manage','high','active','处理门店或供应商履约'),
  ('permission:ec0714fa937a9a833c08abd3','identity.handover.create','high','active','提交门店交班'),
  ('permission:6faacc238d947e031337e6c8','identity.handover.read','low','active','查看门店交班记录'),
  ('permission:b469aca74954a20a93cdf054','inventory.adjust.read','high','active','查看库存调整申请'),
  ('permission:18d253078419a3ea3395618d','inventory.adjust.request','critical','active','提交库存调整申请')
on conflict(code) do update set risk=excluded.risk,status='active',name_zh=excluded.name_zh;

insert into capability.capability(id,kind,name,version,status) values
  ('identity.handovers.read','operation','identity.handovers.read',3,'active'),
  ('identity.handovers.create','operation','identity.handovers.create',3,'active'),
  ('inventory.adjustments.read','operation','inventory.adjustments.read',3,'active'),
  ('inventory.adjustments.create','operation','inventory.adjustments.create',3,'active'),
  ('fulfillment.workitems.read','operation','fulfillment.workitems.read',3,'active'),
  ('fulfillment.workitems.transition','operation','fulfillment.workitems.transition',3,'active'),
  ('fulfillment.returns.read','operation','fulfillment.returns.read',3,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=greatest(capability.capability.version,excluded.version),status='active';

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('identity.handovers.read','identity.handovers.read','identity.handover.read','console','{console,store}'),
  ('identity.handovers.create','identity.handovers.create','identity.handover.create','console','{console,store}'),
  ('inventory.adjustments.read','inventory.adjustments.read','inventory.adjust.read','console','{console,store}'),
  ('inventory.adjustments.create','inventory.adjustments.create','inventory.adjust.request','console','{console,store}'),
  ('fulfillment.workitems.read','fulfillment.workitems.read','fulfillment.read','console','{console,store,supplier}'),
  ('fulfillment.workitems.transition','fulfillment.workitems.transition','fulfillment.work.manage','console','{console,store,supplier}'),
  ('fulfillment.returns.read','fulfillment.returns.read','fulfillment.read','console','{console,store,supplier}')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,
  audience=excluded.audience,targets=excluded.targets;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||id,'organization-platform-root',id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration:store','storeworkflow'
from capability.capability where id in(
  'identity.handovers.read','identity.handovers.create','inventory.adjustments.read','inventory.adjustments.create',
  'fulfillment.workitems.read','fulfillment.workitems.transition','fulfillment.returns.read')
on conflict(scope_id,capability_id) do update set state='enabled',expires_at=null,updated_at=clock_timestamp(),
  updated_by='migration:store',reason='storeworkflow';

alter table access.roletemplate drop constraint roletemplate_code_check;
alter table access.roletemplate add constraint roletemplate_code_check check(code in(
  'malloperator','catalogoperator','ordersupport','financeoperator','financereviewer','storeoperator','administrator','custom'));
insert into access.roletemplate(code,name,description,allows,denies,state,version,created_at,updated_at) values(
  'storeoperator','门店操作员','适合门店接单、备货发货、退货验收、核销、库存申请、客服协作和安全交班',
  array['fulfillment.read','fulfillment.work.manage','fulfillment.ship','fulfillment.return.manage','order.read',
    'verification.issue','verification.verify','inventory.read','inventory.adjust.read','inventory.adjust.request',
    'support.case.read','support.case.manage','support.message.read','support.message.send',
    'identity.handover.read','identity.handover.create'],array[]::text[],'active',1,clock_timestamp(),clock_timestamp())
on conflict(code) do update set name=excluded.name,description=excluded.description,allows=excluded.allows,
  denies=excluded.denies,state='active',version=greatest(access.roletemplate.version,excluded.version),updated_at=clock_timestamp();

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code in(
  'fulfillment.work.manage','identity.handover.create','identity.handover.read','inventory.adjust.read','inventory.adjust.request')
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

select runtime.record_migration_evidence('20260907011000',
  (select count(*) from runtime.operation where id in('identity.handovers.read','identity.handovers.create','inventory.adjustments.read','inventory.adjustments.create','fulfillment.workitems.read','fulfillment.workitems.transition','fulfillment.returns.read')),
  (select count(*) from capability.operation where operation_id in('identity.handovers.read','identity.handovers.create','inventory.adjustments.read','inventory.adjustments.create','fulfillment.workitems.read','fulfillment.workitems.transition','fulfillment.returns.read')),0,0,
  'select id,owner,method,path from runtime.operation where id in(''identity.handovers.read'',''identity.handovers.create'',''inventory.adjustments.read'',''inventory.adjustments.create'',''fulfillment.workitems.read'',''fulfillment.workitems.transition'',''fulfillment.returns.read'') order by id;',
  'select code,name,allows,denies from access.roletemplate where code=''storeoperator'';');
insert into runtime.schemaversion(version,checksum)
values('20260907011000',encode(public.digest('20260907011000_complete_store_workflow','sha256'),'hex'));
update runtime.schemahead set migration_head='20260907011000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:store',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if (select count(*) from runtime.operation where id in(
    'identity.handovers.read','identity.handovers.create','inventory.adjustments.read','inventory.adjustments.create',
    'fulfillment.workitems.read','fulfillment.workitems.transition','fulfillment.returns.read'))<>7 then raise exception 'STORE_WORKFLOW_OPERATION_MISSING'; end if;
  if (select count(*) from capability.operation where operation_id in(
    'identity.handovers.read','identity.handovers.create','inventory.adjustments.read','inventory.adjustments.create',
    'fulfillment.workitems.read','fulfillment.workitems.transition','fulfillment.returns.read'))<>7 then raise exception 'STORE_WORKFLOW_CAPABILITY_MISSING'; end if;
  if not exists(select 1 from access.roletemplate where code='storeoperator' and state='active') then raise exception 'STORE_OPERATOR_TEMPLATE_MISSING'; end if;
  if (select relowner::regrole::text from pg_class where oid='identity.storehandover'::regclass)<>'shopidentityowner'
    or (select relowner::regrole::text from pg_class where oid='inventory.adjustmentrequest'::regclass)<>'shopinventoryowner'
    or (select relowner::regrole::text from pg_class where oid='fulfillment.storeaction'::regclass)<>'shopfulfillmentowner'
    then raise exception 'STORE_WORKFLOW_OWNER_INVALID'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260907011000'
    and migration_count=(select count(*) from runtime.schemaversion)) then raise exception 'STORE_WORKFLOW_HEAD_INVALID'; end if;
end
$assert$;

commit;
