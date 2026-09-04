begin;

insert into runtime.operation(id,owner,method,path,contract_version)
values('member.invitations.read','member','GET','/api/v1/member/invitations','1.0.0');

insert into capability.capability(id,kind,name,version,status)
values('member.invitations.read','operation','member.invitations.read',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('member.invitations.read','member.invitations.read','identity.invitation.manage','operator');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:member.invitations.read','organization-platform-root','member.invitations.read','enabled',null,
  '1970-01-01T00:00:00Z',null,0);

update runtime.schemaversion
set checksum='f0c4fb9e6c9368dc2fb33f74c423e3ebf26d1882ae0f9b50e169fa61334ad2fa'
where version='20260821032000'
  and checksum='a6344216b73cf8cab275a2fa7e405fb56244adead411a15e4ad465ef36a015fa';

insert into runtime.schemaversion(version,checksum)
values('20260902139000','88da0a2cc8f0b8c11bdf81996e0e0786bea199d762c174ca12dbd4c6c7924c69');

commit;
