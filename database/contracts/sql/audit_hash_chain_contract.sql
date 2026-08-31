begin;
insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
  previous_hash,record_hash,recorded_at,signature_version)
values('audit:contract-chain-1','contract:audit','contract:actor','system','contract.created','contract','contract:1',null,null,'{}',
  'contract:trace',null,repeat('a',64),clock_timestamp(),2);
insert into audit.accessrecord(id,scope_id,actor_id,actor_type,resource_type,resource_id,fields,purpose,trace_id,previous_hash,
  record_hash,accessed_at,signature_version)
values('access:contract-chain-2','contract:audit','contract:actor','system','contract','contract:1','{}','contract.read','contract:trace',
  repeat('a',64),repeat('b',64),clock_timestamp()+interval '1 microsecond',2);
do $contract$ begin
  begin
    insert into audit.accessrecord(id,scope_id,actor_id,actor_type,resource_type,resource_id,fields,purpose,trace_id,previous_hash,
      record_hash,accessed_at,signature_version)
    values('access:contract-chain-3','contract:audit','contract:actor','system','contract','contract:1','{}','contract.read','contract:trace',
      repeat('0',64),repeat('c',64),clock_timestamp()+interval '2 microseconds',2);
    raise exception 'AUDIT_BROKEN_CHAIN_ACCEPTED';
  exception when others then if sqlerrm='AUDIT_BROKEN_CHAIN_ACCEPTED' then raise; end if; end;
end $contract$;
do $immutability$ begin
  if to_regclass('audit.archiveitem') is null then raise exception 'AUDIT_ARCHIVE_ITEM_MISSING'; end if;
  begin
    delete from audit.record where id='audit:contract-chain-1';
    raise exception 'AUDIT_PHYSICAL_DELETE_ACCEPTED';
  exception when others then if sqlerrm='AUDIT_PHYSICAL_DELETE_ACCEPTED' then raise; end if; end;
  begin
    update audit.accessrecord set purpose='changed' where id='access:contract-chain-2';
    raise exception 'AUDIT_MUTATION_ACCEPTED';
  exception when others then if sqlerrm='AUDIT_MUTATION_ACCEPTED' then raise; end if; end;
end $immutability$;
rollback;
