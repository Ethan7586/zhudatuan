begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:storefront-member-directory:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'STOREFRONT_MEMBER_DIRECTORY_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907010000'
        and checksum='89fb0fcf3fd865a1e3076be775690536375b6e4a11bab251df3e9c262e1d1ac3')
    or exists(select 1 from runtime.schemaversion where version>'20260907010000') then
    raise exception 'STOREFRONT_MEMBER_DIRECTORY_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from access.permission where code='member.read' and status='active') then
    raise exception 'STOREFRONT_MEMBER_DIRECTORY_PERMISSION_MISSING';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('member.storefront.members.read','member','GET','/api/v1/member/storefront-members','1.0.0');

insert into capability.capability(id,kind,name,version,status)
values('member.storefront.members.read','operation','member.storefront.members.read',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('member.storefront.members.read','member.storefront.members.read','member.read','operator');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:member.storefront.members.read','organization-platform-root','member.storefront.members.read',
  'enabled',null,'1970-01-01T00:00:00Z',null,0);

insert into runtime.schemaversion(version,checksum)
values('20260907110000','db19bf4098a3758b6831fdfee624c2260daf70c7757c34c729d0bb4025cad554');

do $assert$
begin
  if not exists(select 1 from runtime.operation
      where id='member.storefront.members.read' and owner='member' and method='GET'
        and path='/api/v1/member/storefront-members' and contract_version='1.0.0')
    or not exists(select 1 from capability.capability
      where id='member.storefront.members.read' and kind='operation' and status='active')
    or not exists(select 1 from capability.operation
      where operation_id='member.storefront.members.read' and capability_id='member.storefront.members.read'
        and permission_code='member.read' and audience='operator')
    or not exists(select 1 from capability.entitlement
      where id='platform:member.storefront.members.read' and scope_id='organization-platform-root'
        and capability_id='member.storefront.members.read' and state='enabled')
    or not exists(select 1 from runtime.schemaversion
      where version='20260907110000'
        and checksum='db19bf4098a3758b6831fdfee624c2260daf70c7757c34c729d0bb4025cad554') then
    raise exception 'STOREFRONT_MEMBER_DIRECTORY_INCOMPLETE';
  end if;
end
$assert$;

commit;
