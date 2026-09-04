begin;

-- Contract definitions and the referral data foundation landed together in
-- this working head. Publish their missing runtime rows before the identity
-- reset migration so runtime/catalog counts remain atomic and canonical.
insert into runtime.operation(id,owner,method,path,contract_version) values
  ('referral.settings.read','referral','GET','/api/v1/referral/settings','1.0.0'),
  ('referral.settings.manage','referral','PUT','/api/v1/referral/settings','1.0.0'),
  ('referral.products.read','referral','GET','/api/v1/referral/products','1.0.0'),
  ('referral.products.manage','referral','PUT','/api/v1/referral/products','1.0.0'),
  ('referral.members.read','referral','GET','/api/v1/referral/members','1.0.0'),
  ('referral.members.apply','referral','POST','/api/v1/referral/members/apply','1.0.0'),
  ('referral.members.approve','referral','POST','/api/v1/referral/members/approve','1.0.0'),
  ('referral.members.disqualify','referral','POST','/api/v1/referral/members/disqualify','1.0.0'),
  ('referral.bindings.read','referral','GET','/api/v1/referral/bindings','1.0.0'),
  ('referral.bindings.create','referral','POST','/api/v1/referral/bindings','1.0.0'),
  ('referral.commissions.read','referral','GET','/api/v1/referral/commissions','1.0.0'),
  ('referral.earnings.read','referral','GET','/api/v1/referral/earnings','1.0.0'),
  ('referral.links.read','referral','GET','/api/v1/referral/links','1.0.0'),
  ('referral.withdrawals.read','referral','GET','/api/v1/referral/withdrawals','1.0.0'),
  ('referral.withdrawals.create','referral','POST','/api/v1/referral/withdrawals','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into runtime.event(type,version,owner,schema_ref) values
  ('finance.withdrawal.paid',1,'finance','contract://events/finance.withdrawal.paid/v1'),
  ('order.received',1,'order','contract://events/order.received/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

insert into access.permission(id,code,risk,status) values
  ('permission:63dc91d6342a500f88854673','referral.bindings.read','elevated','active'),
  ('permission:5f712366b22c67d0689763ee','referral.commissions.read','high','active'),
  ('permission:2f1cbce85c90a001b7af9731','referral.members.approve','high','active'),
  ('permission:8e502eb068b2f95f7f4c4233','referral.members.disqualify','high','active'),
  ('permission:b337207f1db68b42137cdf64','referral.members.read','elevated','active'),
  ('permission:2133ee489cb2b066893e3960','referral.products.manage','critical','active'),
  ('permission:a0e71c699c319968cb7837c2','referral.products.read','low','active'),
  ('permission:30d5082a4a8d33add7d87bb3','referral.self.manage','high','active'),
  ('permission:8b8c0852ba8e8c181bb0479a','referral.self.read','low','active'),
  ('permission:fbb6e034ce1f802429d83b1d','referral.settings.manage','critical','active'),
  ('permission:838739d41001918adb66dce4','referral.settings.read','elevated','active'),
  ('permission:bdc40874b67d1ed0750ec3cd','referral.withdrawals.create','critical','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;

insert into capability.capability(id,kind,name,version,status) values
  ('referral.settings.read','operation','referral.settings.read',1,'active'),
  ('referral.settings.manage','operation','referral.settings.manage',1,'active'),
  ('referral.products.read','operation','referral.products.read',1,'active'),
  ('referral.products.manage','operation','referral.products.manage',1,'active'),
  ('referral.members.read','operation','referral.members.read',1,'active'),
  ('referral.members.apply','operation','referral.members.apply',1,'active'),
  ('referral.members.approve','operation','referral.members.approve',1,'active'),
  ('referral.members.disqualify','operation','referral.members.disqualify',1,'active'),
  ('referral.bindings.read','operation','referral.bindings.read',1,'active'),
  ('referral.bindings.create','operation','referral.bindings.create',1,'active'),
  ('referral.commissions.read','operation','referral.commissions.read',1,'active'),
  ('referral.earnings.read','operation','referral.earnings.read',1,'active'),
  ('referral.links.read','operation','referral.links.read',1,'active'),
  ('referral.withdrawals.read','operation','referral.withdrawals.read',1,'active'),
  ('referral.withdrawals.create','operation','referral.withdrawals.create',1,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('referral.settings.read','referral.settings.read','referral.settings.read','operator'),
  ('referral.settings.manage','referral.settings.manage','referral.settings.manage','operator'),
  ('referral.products.read','referral.products.read','referral.products.read','operator'),
  ('referral.products.manage','referral.products.manage','referral.products.manage','operator'),
  ('referral.members.read','referral.members.read','referral.members.read','operator'),
  ('referral.members.apply','referral.members.apply','referral.self.manage','member'),
  ('referral.members.approve','referral.members.approve','referral.members.approve','operator'),
  ('referral.members.disqualify','referral.members.disqualify','referral.members.disqualify','operator'),
  ('referral.bindings.read','referral.bindings.read','referral.bindings.read','operator'),
  ('referral.bindings.create','referral.bindings.create','referral.self.manage','member'),
  ('referral.commissions.read','referral.commissions.read','referral.commissions.read','operator'),
  ('referral.earnings.read','referral.earnings.read','referral.self.read','member'),
  ('referral.links.read','referral.links.read','referral.self.read','member'),
  ('referral.withdrawals.read','referral.withdrawals.read','referral.self.read','member'),
  ('referral.withdrawals.create','referral.withdrawals.create','referral.withdrawals.create','member')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission
where permission.code in('referral.self.read','referral.self.manage','referral.withdrawals.create')
on conflict do nothing;

-- Referral is a capability layered onto existing memberships. Provision two
-- tenant roles so operations can review people without changing money, while
-- finance owns rates and the existing four-eye withdrawal decision.
insert into access.role(id,scope_id,name,status,version)
select 'role-referral-operations-v1:'||tenant.id,tenant.id,'分销运营','active',0
from organization.organization tenant where tenant.kind='tenant' and tenant.status='active'
on conflict(scope_id,name) do nothing;
insert into access.role(id,scope_id,name,status,version)
select 'role-referral-finance-v1:'||tenant.id,tenant.id,'分销财务','active',0
from organization.organization tenant where tenant.kind='tenant' and tenant.status='active'
on conflict(scope_id,name) do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow'
from access.role role cross join access.permission permission
where role.id like 'role-referral-operations-v1:%'
  and permission.code in(
    'referral.settings.read','referral.products.read','referral.members.read',
    'referral.members.approve','referral.members.disqualify','referral.bindings.read',
    'referral.commissions.read'
  )
on conflict do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow'
from access.role role cross join access.permission permission
where role.id like 'role-referral-finance-v1:%'
  and permission.code in(
    'referral.settings.read','referral.settings.manage','referral.products.read',
    'referral.products.manage','referral.commissions.read','finance.withdrawal.read',
    'finance.withdrawal.decide','finance.withdrawal.recover'
  )
on conflict do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.code in(
  'referral.settings.read','referral.settings.manage','referral.products.read',
  'referral.products.manage','referral.members.read','referral.members.approve',
  'referral.members.disqualify','referral.bindings.read','referral.commissions.read'
)
on conflict do nothing;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,
  '1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id like 'referral.%'
on conflict(id) do update set state='enabled',expires_at=null;

update runtime.schemaversion
set checksum='2f42a2573cda2faaf1c9fa46a00a0e4dbd839004eb3589e5346b10bda4e76ee0'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260829190000','b96a0a2b0ad916efcac437c042b5e63a9dfec0e5934584caadb15a52d2894807');

do $assert$
begin
  if (select count(*) from runtime.operation where id like 'referral.%')<>15
    or (select count(*) from capability.operation where operation_id like 'referral.%')<>15
    or not exists(select 1 from runtime.event where type='finance.withdrawal.paid' and version=1)
    or not exists(select 1 from runtime.event where type='order.received' and version=1)
    or not exists(select 1 from runtime.schemaversion where version='20260821032000'
      and checksum='2f42a2573cda2faaf1c9fa46a00a0e4dbd839004eb3589e5346b10bda4e76ee0')
    or not exists(select 1 from runtime.schemaversion where version='20260829190000')
  then raise exception 'RUNTIME_CONTRACT_HEAD_RECONCILIATION_INCOMPLETE'; end if;
  if exists(
      select 1 from access.rolepermission mapping
      join access.role role on role.id=mapping.role_id
      join access.permission permission on permission.id=mapping.permission_id
      where role.id like 'role-referral-operations-v1:%'
        and permission.code in('referral.settings.manage','referral.products.manage')
    )
    or exists(
      select 1 from organization.organization tenant
      where tenant.kind='tenant' and tenant.status='active' and (
        not exists(select 1 from access.role role
          where role.id='role-referral-operations-v1:'||tenant.id and role.status='active')
        or not exists(select 1 from access.role role
          where role.id='role-referral-finance-v1:'||tenant.id and role.status='active')
      )
    )
    or not exists(
      select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2' and permission.code='referral.settings.manage' and mapping.effect='allow'
    )
  then raise exception 'REFERRAL_OPERATOR_ROLE_BOUNDARY_INVALID'; end if;
end
$assert$;

commit;
