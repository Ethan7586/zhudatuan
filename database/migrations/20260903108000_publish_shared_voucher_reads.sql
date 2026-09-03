begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903107000') then
    raise exception 'SHARED_VOUCHER_READS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903108000') then
    raise exception 'SHARED_VOUCHER_READS_ALREADY_APPLIED';
  end if;
  if (select count(*) from capability.operation where operation_id in(
    'voucher.bindings.read','voucher.redemptions.read'
  ))<>2 then
    raise exception 'SHARED_VOUCHER_READS_CONTRACT_INCOMPLETE';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and checksum='f16857a88b6e47eee536d8bb268a1bcd1edf82fb160b5a90a6faef4212b22d4a'
      and operation_count=274 and event_count=103 and status='active'
  ) then
    raise exception 'SHARED_VOUCHER_READS_PREVIOUS_CONTRACT_INVALID';
  end if;
end
$precondition$;

update capability.operation
set audience='public'
where operation_id in('voucher.bindings.read','voucher.redemptions.read');

update runtime.contractcatalog
set checksum='4aa32bd8ab3432b2a47891fb0cddf8f52fd2e9de2b5ba5d9ffaf5943da222fa1',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260903108000',2,2,0,0,
  'select operation_id,audience,permission_code from capability.operation where operation_id in(''voucher.bindings.read'',''voucher.redemptions.read'') order by operation_id;',
  'select scope_id,capability_id,state from capability.entitlement where capability_id in(''voucher.bindings.read'',''voucher.redemptions.read'') order by scope_id,capability_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260903108000','4aa32bd8ab3432b2a47891fb0cddf8f52fd2e9de2b5ba5d9ffaf5943da222fa1');

do $assert$
begin
  if exists(
    select 1 from capability.operation
    where operation_id in('voucher.bindings.read','voucher.redemptions.read') and audience<>'public'
  ) then
    raise exception 'SHARED_VOUCHER_READS_AUDIENCE_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and checksum='4aa32bd8ab3432b2a47891fb0cddf8f52fd2e9de2b5ba5d9ffaf5943da222fa1'
      and operation_count=274 and event_count=103 and status='active'
  ) then
    raise exception 'SHARED_VOUCHER_READS_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
