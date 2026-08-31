begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830104000') then
    raise exception 'CONTRACT_V3_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830105000') then
    raise exception 'CONTRACT_V3_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table runtime.operation drop constraint runtime_operation_contract_v2;

delete from capability.entitlement where capability_id in('identity.members.create','identity.wechat.session','identity.wechat.bind');
delete from capability.dependency where capability_id in('identity.members.create','identity.wechat.session','identity.wechat.bind')
  or depends_on_id in('identity.members.create','identity.wechat.session','identity.wechat.bind');
delete from capability.operation where operation_id in('identity.members.create','identity.wechat.session','identity.wechat.bind');
delete from capability.capability where id in('identity.members.create','identity.wechat.session','identity.wechat.bind');
delete from runtime.operation where id in('identity.members.create','identity.wechat.session','identity.wechat.bind');

update runtime.operation set method='GET',path='/api/v1/identity/invitations',contract_version='3.0.0'
where id='identity.invitations.read';
insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.sessions.complete','identity','POST','/api/v1/identity/sessions/complete','3.0.0'),
  ('identity.invitations.resolve','identity','POST','/api/v1/identity/invitations/resolve','3.0.0'),
  ('identity.enrollments.read','identity','GET','/api/v1/identity/enrollments/{id}','3.0.0'),
  ('identity.enrollments.complete','identity','POST','/api/v1/identity/enrollments/{id}/complete','3.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;
update runtime.operation set method='POST',path='/api/v1/identity/sessions',contract_version='3.0.0'
where id='identity.sessions.create';
update runtime.operation set path='/api/v1/identity/invitations/{id}',contract_version='3.0.0'
where id='identity.invitations.revoke';
update runtime.operation set contract_version='3.0.0' where contract_version<>'3.0.0';

insert into capability.capability(id,kind,name,version,status) values
  ('identity.sessions.complete','operation','identity.sessions.complete',3,'active'),
  ('identity.invitations.resolve','operation','identity.invitations.resolve',3,'active'),
  ('identity.enrollments.read','operation','identity.enrollments.read',3,'active'),
  ('identity.enrollments.complete','operation','identity.enrollments.complete',3,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;
update capability.capability set version=3 where kind='operation';

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('identity.sessions.complete','identity.sessions.complete',null,'public'),
  ('identity.invitations.resolve','identity.invitations.resolve',null,'public'),
  ('identity.enrollments.read','identity.enrollments.read',null,'public'),
  ('identity.enrollments.complete','identity.enrollments.complete',null,'public')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,audience=excluded.audience;
update capability.operation set permission_code=null,audience='public' where operation_id='identity.sessions.create';
update capability.operation set permission_code='identity.invitation.read',audience='console' where operation_id='identity.invitations.read';

insert into runtime.event(type,version,owner,schema_ref) values
  ('identity.invitation.issued',1,'identity','contract://events/identity.invitation.issued/v1'),
  ('identity.invitation.reserved',1,'identity','contract://events/identity.invitation.reserved/v1'),
  ('identity.invitation.redeemed',1,'identity','contract://events/identity.invitation.redeemed/v1'),
  ('identity.invitation.revoked',1,'identity','contract://events/identity.invitation.revoked/v1'),
  ('identity.invitation.expired',1,'identity','contract://events/identity.invitation.expired/v1'),
  ('identity.invitation.failed',1,'identity','contract://events/identity.invitation.failed/v1'),
  ('identity.enrollment.completed',1,'identity','contract://events/identity.enrollment.completed/v1'),
  ('access.membership.invited',1,'access','contract://events/access.membership.invited/v1'),
  ('access.membership.activated',1,'access','contract://events/access.membership.activated/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

alter table runtime.operation add constraint runtime_operation_contract_v3 check(contract_version='3.0.0') not valid;
alter table runtime.operation validate constraint runtime_operation_contract_v3;
update runtime.contractcatalog set status='retired' where artifact='commerce' and status='active';
insert into runtime.contractcatalog(artifact,version,checksum,operation_count,event_count,status,published_at)
values('commerce','3.0.0','da6a692837b03e7b15416e82788e3b0764e277644e7e57c6b900cba0c048a57d',
  (select count(*) from runtime.operation),(select count(*) from runtime.event),'active',clock_timestamp());

select runtime.record_migration_evidence('20260830105000',
  (select count(*) from runtime.operation)+(select count(*) from runtime.event),
  (select count(*) from runtime.operation)+(select count(*) from runtime.event),0,0,
  'create index concurrently if not exists runtime_operation_owner_contract_v3_live on runtime.operation(owner,contract_version,id);',
  'select artifact,version,status,checksum from runtime.contractcatalog order by published_at;');
insert into runtime.schemaversion(version,checksum)
values('20260830105000',encode(public.digest('20260830105000_publish_contract_v3','sha256'),'hex'));

do $assert$ begin
  if (select count(*) from runtime.operation)<>237 or (select count(*) from capability.operation)<>237 then
    raise exception 'CONTRACT_V3_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from runtime.event)<>77 then raise exception 'CONTRACT_V3_EVENT_COUNT_INVALID'; end if;
  if exists(select 1 from runtime.operation where contract_version<>'3.0.0') then raise exception 'CONTRACT_V3_VERSION_DRIFT'; end if;
  if exists(select 1 from runtime.operation where id in('identity.members.create','identity.wechat.session','identity.wechat.bind')) then
    raise exception 'LEGACY_IDENTITY_OPERATION_REMAINS';
  end if;
end $assert$;

commit;
