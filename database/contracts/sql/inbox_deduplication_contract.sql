begin;
do $contract$ declare first boolean; repeated boolean; other boolean; begin
  first:=runtime.accept_inbox('provider.contract','contract:event','contract.received','identity.session.created',1,'contract:trace','{}'::jsonb);
  repeated:=runtime.accept_inbox('provider.contract','contract:event','contract.received','identity.session.created',1,'contract:trace','{}'::jsonb);
  other:=runtime.accept_inbox('provider.contract.other','contract:event','contract.received','identity.session.created',1,'contract:trace','{}'::jsonb);
  if not first or repeated or not other then raise exception 'INBOX_PROVIDER_EVENT_OPERATION_DEDUPLICATION_INVALID'; end if;
end $contract$;
rollback;
