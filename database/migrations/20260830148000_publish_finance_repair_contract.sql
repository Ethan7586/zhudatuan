begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830147000') then raise exception 'FINANCE_REPAIR_CONTRACT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830148000') then raise exception 'FINANCE_REPAIR_CONTRACT_ALREADY_APPLIED'; end if;
end $precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.policies.read','finance','GET','/api/v1/finance/policies','3.0.0'),
  ('finance.policies.preview','finance','POST','/api/v1/finance/policies/previews','3.0.0'),
  ('finance.reconciliationrepairs.read','finance','GET','/api/v1/finance/reconciliationrepairs','3.0.0'),
  ('finance.reconciliationrepairs.preview','finance','POST','/api/v1/finance/reconciliationrepairs/previews','3.0.0'),
  ('finance.reconciliationrepairs.submit','finance','POST','/api/v1/finance/reconciliationrepairs','3.0.0'),
  ('finance.reconciliationrepairs.decide','finance','POST','/api/v1/finance/reconciliationrepairs/{repairid}/decisions','3.0.0'),
  ('finance.reconciliationrepairs.reverse','finance','POST','/api/v1/finance/reconciliationrepairs/{repairid}/reversals','3.0.0');

insert into access.permission(id,code,risk,status)
select 'permission:'||substr(encode(public.digest(code,'sha256'),'hex'),1,24),code,risk,'active' from(values
  ('finance.policy.read','high'),('finance.policy.preview','high'),('finance.repair.read','high'),
  ('finance.repair.preview','high'),('finance.repair.submit','critical'),('finance.repair.decide','critical'),
  ('finance.repair.reverse','critical')) permission(code,risk);

insert into capability.capability(id,kind,name,version,status)
select id,'operation',id,3,'active' from runtime.operation where id in(
  'finance.policies.read','finance.policies.preview','finance.reconciliationrepairs.read','finance.reconciliationrepairs.preview',
  'finance.reconciliationrepairs.submit','finance.reconciliationrepairs.decide','finance.reconciliationrepairs.reverse');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('finance.policies.read','finance.policies.read','finance.policy.read','console'),
  ('finance.policies.preview','finance.policies.preview','finance.policy.preview','console'),
  ('finance.reconciliationrepairs.read','finance.reconciliationrepairs.read','finance.repair.read','console'),
  ('finance.reconciliationrepairs.preview','finance.reconciliationrepairs.preview','finance.repair.preview','console'),
  ('finance.reconciliationrepairs.submit','finance.reconciliationrepairs.submit','finance.repair.submit','console'),
  ('finance.reconciliationrepairs.decide','finance.reconciliationrepairs.decide','finance.repair.decide','console'),
  ('finance.reconciliationrepairs.reverse','finance.reconciliationrepairs.reverse','finance.repair.reverse','console');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in(
  'finance.policies.read','finance.policies.preview','finance.reconciliationrepairs.read','finance.reconciliationrepairs.preview',
  'finance.reconciliationrepairs.submit','finance.reconciliationrepairs.decide','finance.reconciliationrepairs.reverse');
delete from access.rolepermission mapping using access.permission permission
where mapping.role_id='role-platform-owner-v2' and mapping.permission_id=permission.id
  and permission.code in('finance.policy.read','finance.policy.preview','finance.repair.read','finance.repair.preview',
    'finance.repair.submit','finance.repair.decide','finance.repair.reverse') and mapping.effect='deny';
insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission where permission.code in(
  'finance.policy.read','finance.policy.preview','finance.repair.read','finance.repair.preview','finance.repair.submit',
  'finance.repair.decide','finance.repair.reverse') on conflict do nothing;

update runtime.contractcatalog set checksum=encode(public.digest('commerce:3.0.0:financerepair','sha256'),'hex'),
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';
insert into runtime.schemaversion(version,checksum)
values('20260830148000',encode(public.digest('20260830148000_publish_finance_repair_contract','sha256'),'hex'));

do $assert$ begin
  if (select count(*) from runtime.operation where id like 'finance.reconciliationrepairs.%' or id in('finance.policies.read','finance.policies.preview'))<>7 then
    raise exception 'FINANCE_REPAIR_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from capability.entitlement where capability_id in('finance.policies.read','finance.policies.preview',
    'finance.reconciliationrepairs.read','finance.reconciliationrepairs.preview','finance.reconciliationrepairs.submit',
    'finance.reconciliationrepairs.decide','finance.reconciliationrepairs.reverse') and state='enabled')<>7 then
    raise exception 'FINANCE_REPAIR_ENTITLEMENT_COUNT_INVALID';
  end if;
end $assert$;

commit;
