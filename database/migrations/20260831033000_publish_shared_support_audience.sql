begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831032000') then
    raise exception 'SHARED_SUPPORT_AUDIENCE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831033000') then
    raise exception 'SHARED_SUPPORT_AUDIENCE_ALREADY_APPLIED';
  end if;
  if (select count(*) from capability.operation where operation_id in(
    'support.cases.read','support.messages.read','support.messages.send','support.attachments.create'
  ))<>4 then
    raise exception 'SHARED_SUPPORT_OPERATION_CATALOG_INCOMPLETE';
  end if;
end $precondition$;

update capability.operation set audience='public'
where operation_id in(
  'support.cases.read','support.messages.read','support.messages.send','support.attachments.create'
);

select runtime.record_migration_evidence('20260831033000',4,4,0,0,
  'select operation_id,audience,permission_code from capability.operation where operation_id in(''support.cases.read'',''support.messages.read'',''support.messages.send'',''support.attachments.create'') order by operation_id;',
  'select membership.id,available.operation_id from access.membership membership join lateral capability.membership_operations(membership.id) available on available.operation_id like ''support.%'' where membership.client=''storefront'' order by membership.id,available.operation_id;');
insert into runtime.schemaversion(version,checksum)
values('20260831033000','5966b2bc05de9e5c4d461d49493d2c7f4e2db8f25fb0fda7829890b53b61215c');

do $assert$ begin
  if exists(
    select 1 from capability.operation
    where operation_id in(
      'support.cases.read','support.messages.read','support.messages.send','support.attachments.create'
    ) and audience<>'public'
  ) then
    raise exception 'SHARED_SUPPORT_AUDIENCE_INVALID';
  end if;
  if exists(
    select 1 from access.membership membership
    where membership.client='storefront' and membership.status='active'
      and exists(
        select 1 from access.effective_permissions(membership.id) permission
        where permission.permission_code='support.case.read' and permission.effect='allow'
      )
      and not exists(
        select 1 from capability.membership_operations(membership.id) available
        where available.operation_id='support.cases.read'
      )
  ) then
    raise exception 'STOREFRONT_SUPPORT_READ_CAPABILITY_MISSING';
  end if;
end $assert$;

commit;
