begin;

alter table member.invite add column label text;
alter table member.invite add column created_at timestamptz;
alter table member.invite add column registration_policy_id text;
alter table member.invite add column terms_hash char(64);
alter table member.invite add column version bigint not null default 0;

update member.invite invite set
  label=left(invite.id,80),
  created_at=invite.effective_at,
  registration_policy_id=(select policy.id from identity.registrationpolicy policy
    order by (policy.effective_at<=invite.effective_at) desc,policy.effective_at desc,policy.version desc limit 1),
  terms_hash=(select policy.terms_hash from identity.registrationpolicy policy
    order by (policy.effective_at<=invite.effective_at) desc,policy.effective_at desc,policy.version desc limit 1);

alter table member.invite alter column label set not null;
alter table member.invite alter column created_at set not null;
alter table member.invite alter column registration_policy_id set not null;
alter table member.invite alter column terms_hash set not null;
alter table member.invite add constraint member_invite_label check(length(label) between 2 and 80);
alter table member.invite add constraint member_invite_version check(version>=0);
alter table member.invite add constraint member_invite_policy foreign key(registration_policy_id) references identity.registrationpolicy(id);

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.invitations.create','identity','POST','/api/v1/identity/invitations','1.0.0'),
  ('identity.invitations.revoke','identity','DELETE','/api/v1/identity/invitations/{invitationid}','1.0.0');

insert into access.permission(id,code,risk,status)
values('permission:ffe9127797a46a5498977e75','identity.invitation.manage','high','active');

insert into access.rolepermission(role_id,permission_id,effect)
select distinct existing.role_id,invitation.id,'allow'
from access.rolepermission existing
join access.permission source on source.id=existing.permission_id and source.code in('member.invite','member.read')
cross join access.permission invitation
where existing.effect='allow' and invitation.code='identity.invitation.manage'
on conflict do nothing;

insert into capability.capability(id,kind,name,version,status) values
  ('identity.invitations.create','operation','identity.invitations.create',1,'active'),
  ('identity.invitations.revoke','operation','identity.invitations.revoke',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('identity.invitations.create','identity.invitations.create','identity.invitation.manage','operator'),
  ('identity.invitations.revoke','identity.invitations.revoke','identity.invitation.manage','operator');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in('identity.invitations.create','identity.invitations.revoke');

update runtime.schemaversion
set checksum='54218568eeebb84b63cdbf9aa06605404a4faccc173e44bffc7f6662b965041f'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821065000','5a4de76005f084501968deacb3bb3c779b50c1c85eff033cc45141a26ee0ef73');

do $assert$ begin
  if (select count(*) from runtime.operation)<>210 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from member.invite where label is null or registration_policy_id is null or terms_hash is null)
    then raise exception 'INVITATION_POLICY_BINDING_MISSING'; end if;
  if (select count(*) from capability.operation where operation_id in('identity.invitations.create','identity.invitations.revoke'))<>2
    then raise exception 'INVITATION_OPERATION_CONTRACT_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='54218568eeebb84b63cdbf9aa06605404a4faccc173e44bffc7f6662b965041f')
  then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
