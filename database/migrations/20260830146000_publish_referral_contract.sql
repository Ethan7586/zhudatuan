begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830145000') then raise exception 'REFERRAL_CONTRACT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830146000') then raise exception 'REFERRAL_CONTRACT_ALREADY_APPLIED'; end if;
end $precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('referral.settings.read','referral','GET','/api/v1/referral/settings','3.0.0'),
  ('referral.settings.manage','referral','PUT','/api/v1/referral/settings/{settingid}','3.0.0'),
  ('referral.products.read','referral','GET','/api/v1/referral/products','3.0.0'),
  ('referral.products.manage','referral','PUT','/api/v1/referral/products/{productid}','3.0.0'),
  ('referral.members.read','referral','GET','/api/v1/referral/members','3.0.0'),
  ('referral.members.apply','referral','POST','/api/v1/referral/members/applications','3.0.0'),
  ('referral.members.approve','referral','POST','/api/v1/referral/members/{memberid}/approvals','3.0.0'),
  ('referral.members.disqualify','referral','POST','/api/v1/referral/members/{memberid}/disqualifications','3.0.0'),
  ('referral.bindings.read','referral','GET','/api/v1/referral/bindings','3.0.0'),
  ('referral.bindings.create','referral','POST','/api/v1/referral/bindings','3.0.0'),
  ('referral.commissions.read','referral','GET','/api/v1/referral/commissions','3.0.0'),
  ('referral.earnings.read','referral','GET','/api/v1/referral/earnings','3.0.0'),
  ('referral.links.read','referral','GET','/api/v1/referral/links','3.0.0'),
  ('referral.withdrawals.read','referral','GET','/api/v1/referral/withdrawals','3.0.0'),
  ('referral.withdrawals.create','referral','POST','/api/v1/referral/withdrawals','3.0.0');

insert into access.permission(id,code,risk,status)
select 'permission:'||substr(encode(public.digest(code,'sha256'),'hex'),1,24),code,risk,'active' from(values
  ('referral.setting.read','high'),('referral.setting.manage','critical'),('referral.product.read','high'),('referral.product.manage','critical'),
  ('referral.member.read','high'),('referral.member.apply','elevated'),('referral.member.decide','critical'),
  ('referral.binding.read','low'),('referral.binding.create','elevated'),('referral.commission.read','high'),
  ('referral.earning.readself','low'),('referral.withdrawal.readself','low'),('referral.withdrawal.create','high')) permission(code,risk);

insert into capability.capability(id,kind,name,version,status)
select id,'operation',id,3,'active' from runtime.operation where owner='referral';
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('referral.settings.read','referral.settings.read','referral.setting.read','console'),
  ('referral.settings.manage','referral.settings.manage','referral.setting.manage','console'),
  ('referral.products.read','referral.products.read','referral.product.read','console'),
  ('referral.products.manage','referral.products.manage','referral.product.manage','console'),
  ('referral.members.read','referral.members.read','referral.member.read','console'),
  ('referral.members.apply','referral.members.apply','referral.member.apply','public'),
  ('referral.members.approve','referral.members.approve','referral.member.decide','console'),
  ('referral.members.disqualify','referral.members.disqualify','referral.member.decide','console'),
  ('referral.bindings.read','referral.bindings.read','referral.binding.read','public'),
  ('referral.bindings.create','referral.bindings.create','referral.binding.create','public'),
  ('referral.commissions.read','referral.commissions.read','referral.commission.read','console'),
  ('referral.earnings.read','referral.earnings.read','referral.earning.readself','public'),
  ('referral.links.read','referral.links.read','referral.binding.read','public'),
  ('referral.withdrawals.read','referral.withdrawals.read','referral.withdrawal.readself','public'),
  ('referral.withdrawals.create','referral.withdrawals.create','referral.withdrawal.create','public');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id like 'referral.%';
delete from access.rolepermission mapping using access.permission permission
where mapping.role_id in('role-platform-owner-v2','role:self') and mapping.permission_id=permission.id
  and permission.code like 'referral.%' and mapping.effect='deny';
insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission where permission.code like 'referral.%'
on conflict do nothing;
insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission where permission.code in(
  'referral.member.apply','referral.binding.read','referral.binding.create','referral.earning.readself',
  'referral.withdrawal.readself','referral.withdrawal.create') on conflict do nothing;

insert into runtime.event(type,version,owner,schema_ref) values
  ('referral.setting.changed',1,'referral','contract://events/referral.setting.changed/v1'),
  ('referral.product.changed',1,'referral','contract://events/referral.product.changed/v1'),
  ('referral.member.applied',1,'referral','contract://events/referral.member.applied/v1'),
  ('referral.member.approved',1,'referral','contract://events/referral.member.approved/v1'),
  ('referral.member.disqualified',1,'referral','contract://events/referral.member.disqualified/v1'),
  ('referral.binding.created',1,'referral','contract://events/referral.binding.created/v1'),
  ('referral.commission.created',1,'referral','contract://events/referral.commission.created/v1'),
  ('referral.commission.settled',1,'referral','contract://events/referral.commission.settled/v1'),
  ('referral.commission.reversed',1,'referral','contract://events/referral.commission.reversed/v1'),
  ('referral.withdrawal.requested',1,'referral','contract://events/referral.withdrawal.requested/v1'),
  ('referral.withdrawal.paid',1,'referral','contract://events/referral.withdrawal.paid/v1'),
  ('referral.withdrawal.failed',1,'referral','contract://events/referral.withdrawal.failed/v1');

update runtime.contractcatalog set checksum=encode(public.digest('commerce:3.0.0:referral','sha256'),'hex'),
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';
insert into runtime.schemaversion(version,checksum)
values('20260830146000',encode(public.digest('20260830146000_publish_referral_contract','sha256'),'hex'));

do $assert$ begin
  if (select count(*) from runtime.operation where owner='referral')<>15 then raise exception 'REFERRAL_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event where owner='referral')<>12 then raise exception 'REFERRAL_EVENT_COUNT_INVALID'; end if;
  if (select count(*) from capability.operation where operation_id like 'referral.%')<>15 then raise exception 'REFERRAL_CAPABILITY_COUNT_INVALID'; end if;
  if (select count(*) from capability.entitlement where capability_id like 'referral.%' and scope_id='organization-platform-root' and state='enabled')<>15 then
    raise exception 'REFERRAL_ENTITLEMENT_COUNT_INVALID';
  end if;
end $assert$;

commit;
