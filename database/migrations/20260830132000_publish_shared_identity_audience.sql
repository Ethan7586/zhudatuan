begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830131000') then
    raise exception 'SHARED_IDENTITY_AUDIENCE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830132000') then
    raise exception 'SHARED_IDENTITY_AUDIENCE_ALREADY_APPLIED';
  end if;
end $precondition$;

update capability.operation set audience='public'
where operation_id in(
  'identity.tickets.exchange','identity.session.read','identity.session.delete','identity.sessions.read',
  'identity.sessions.revoke','identity.challenges.create','identity.password.change','identity.password.verify',
  'identity.password.reset','identity.mobile.manage','identity.stepup.start','identity.stepup.complete'
);

update runtime.contractcatalog
set checksum='9d43840b45fdd820bd238571ffce8a4d4143b1ad690fa7349f8c0dc24a8d674a',
    operation_count=239,event_count=79,published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830132000',
  (select count(*) from capability.operation where operation_id like 'identity.%' and audience='public'),
  (select count(*) from capability.operation where operation_id like 'identity.%' and audience='public'),0,0,
  'select operation_id,audience from capability.operation where operation_id like ''identity.%'' order by operation_id;',
  'select artifact,version,checksum,operation_count,event_count from runtime.contractcatalog where status=''active'';');
insert into runtime.schemaversion(version,checksum)
values('20260830132000','9d43840b45fdd820bd238571ffce8a4d4143b1ad690fa7349f8c0dc24a8d674a');

do $assert$ begin
  if (select count(*) from capability.operation where operation_id in(
    'identity.tickets.exchange','identity.session.read','identity.session.delete','identity.sessions.read',
    'identity.sessions.revoke','identity.challenges.create','identity.password.change','identity.password.verify',
    'identity.password.reset','identity.mobile.manage','identity.stepup.start','identity.stepup.complete'
  ) and audience='public')<>12 then
    raise exception 'SHARED_IDENTITY_AUDIENCE_INVALID';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='9d43840b45fdd820bd238571ffce8a4d4143b1ad690fa7349f8c0dc24a8d674a'
      and operation_count=239 and event_count=79) then
    raise exception 'SHARED_IDENTITY_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
