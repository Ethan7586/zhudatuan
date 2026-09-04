begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030900') then raise exception 'CHANNEL_WEBHOOK_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031000') then raise exception 'CHANNEL_WEBHOOK_ALREADY_APPLIED'; end if;
  if exists(select 1 from runtime.jobs where kind='channelwebhook' and state='running') then raise exception 'CHANNEL_WEBHOOK_DRAIN_REQUIRED'; end if;
  if exists(select 1 from channel.provideroperation where external_reference is not null group by provider,external_reference having count(*)>1)
    then raise exception 'CHANNEL_PROVIDER_REFERENCE_RECONCILIATION_REQUIRED'; end if;
end
$precondition$;

create temporary table channel_webhook_before on commit drop as
select count(*) rows_count from channel.webhookinbox;

create table channel.webhookreceipt(
  id text primary key check(id~'^webhookreceipt:[a-f0-9]{64}$'),
  connection_id text not null references channel.connection(id),
  provider text not null,
  scope_id text not null,
  external_id text not null check(length(external_id) between 1 and 255),
  raw_ciphertext text not null,
  raw_key_version text not null check(length(raw_key_version) between 1 and 255),
  raw_hash char(64) not null check(raw_hash~'^[a-f0-9]{64}$'),
  signature_hash char(64) not null check(signature_hash~'^[a-f0-9]{64}$'),
  state text not null check(state in('received','processing','verified','failed')),
  attempts integer not null default 0 check(attempts>=0),
  failure_class text,
  error_code text,
  failure_retryable boolean,
  received_at timestamptz not null,
  verified_at timestamptz,
  failed_at timestamptz,
  trace_id text not null,
  retention_until timestamptz not null,
  version bigint not null default 0 check(version>=0),
  unique(connection_id,external_id),
  check(retention_until>received_at),
  check((state='verified')=(verified_at is not null)),
  check((state='failed' and failure_class in('validation','authentication','authorization','conflict','ratelimit','timeout','unavailable','provider','unknown')
    and error_code~'^[A-Z][A-Z0-9_]{2,127}$' and failure_retryable is not null and failed_at is not null)
    or (state<>'failed' and failure_class is null and error_code is null and failure_retryable is null and failed_at is null))
);

create index channel_webhookreceipt_work on channel.webhookreceipt(state,received_at,id) where state in('received','processing');
create index channel_webhookreceipt_retention on channel.webhookreceipt(retention_until,id) where state in('verified','failed');

insert into channel.webhookreceipt(id,connection_id,provider,scope_id,external_id,raw_ciphertext,raw_key_version,raw_hash,
  signature_hash,state,attempts,failure_class,error_code,failure_retryable,received_at,verified_at,failed_at,trace_id,retention_until,version)
select 'webhookreceipt:'||encode(public.digest(connection_id||':'||external_id,'sha256'),'hex'),connection_id,provider,scope_id,
  external_id,raw_ciphertext,raw_key_version,raw_hash,signature_hash,
  case when state in('received','processing') then 'received' when state='failed' then 'failed' else 'verified' end,attempts,
  case when state='ignored' then 'unavailable' else failure_class end,
  case when state='ignored' then 'CHANNEL_WEBHOOK_MAPPING_MISSING' else error_code end,
  case when state='ignored' then false else failure_retryable end,received_at,
  case when state in('applied','ignored') then coalesce(processed_at,received_at) end,
  case when state in('failed','ignored') then coalesce(processed_at,received_at) end,trace_id,
  greatest(received_at,clock_timestamp())+interval '90 days',version
from channel.webhookinbox;

alter table channel.webhookinbox add column receipt_id text;
update channel.webhookinbox inbox set
  receipt_id='webhookreceipt:'||encode(public.digest(connection_id||':'||external_id,'sha256'),'hex'),
  normalized=jsonb_build_object('eventType',event_type,'reference',external_reference,
    'kind',coalesce(nullif(normalized->>'kind',''),nullif(normalized->>'resourceType',''),'unknown'),
    'state',coalesce(nullif(normalized->>'state',''),'unknown')),
  state=case when state='ignored' then 'failed' else state end,
  failure_class=case when state='ignored' then 'unavailable' else failure_class end,
  error_code=case when state='ignored' then 'CHANNEL_WEBHOOK_MAPPING_MISSING' else error_code end,
  failure_retryable=case when state='ignored' then false else failure_retryable end,
  version=version+1
where state not in('received','processing');

insert into runtime.deadletters(id,tenant_id,scope_id,source_kind,source_id,owner,payload,error_code,attempts,state,
  version,failed_at,retention_until)
select 'deadletter:webhook:'||encode(public.digest(inbox.connection_id||':'||inbox.external_id,'sha256'),'hex'),
  inbox.scope_id,inbox.scope_id,'provider',receipt.id,'channel',jsonb_build_object('receipt',receipt.id,'provider',inbox.provider,
    'rawHash',inbox.raw_hash,'signatureHash',inbox.signature_hash),'CHANNEL_WEBHOOK_MAPPING_MISSING',greatest(inbox.attempts,1),
  'open',1,coalesce(inbox.processed_at,inbox.received_at),greatest(inbox.received_at,clock_timestamp())+interval '90 days'
from channel.webhookinbox inbox join channel.webhookreceipt receipt on receipt.connection_id=inbox.connection_id and receipt.external_id=inbox.external_id
where inbox.state='failed' and inbox.error_code='CHANNEL_WEBHOOK_MAPPING_MISSING'
on conflict(source_kind,source_id) do nothing;

delete from channel.webhookinbox where state in('received','processing');

alter table channel.webhookinbox alter column receipt_id set not null;
alter table channel.webhookinbox add constraint channel_webhookinbox_receipt foreign key(receipt_id) references channel.webhookreceipt(id);
alter table channel.webhookinbox add constraint channel_webhookinbox_receipt_unique unique(receipt_id);
drop trigger channel_webhookinbox_evidence on channel.webhookinbox;
drop function channel.guard_webhook_evidence();
alter table channel.webhookinbox drop constraint webhookinbox_state_check;
alter table channel.webhookinbox add constraint channel_webhookinbox_state check(state in('processing','applied','failed'));
alter table channel.webhookinbox add constraint channel_webhookinbox_normalized check(
  jsonb_typeof(normalized)='object' and pg_column_size(normalized)<=4096
  and normalized-array['eventType','reference','kind','state']='{}'::jsonb);
alter table channel.webhookinbox drop column raw_ciphertext;
alter table channel.webhookinbox drop column raw_key_version;

create function channel.guard_webhook_receipt() returns trigger language plpgsql set search_path=pg_catalog,channel as $function$
begin
  if new.version<>old.version+1 then raise exception 'CHANNEL_WEBHOOK_RECEIPT_VERSION_INVALID'; end if;
  if (new.id,new.connection_id,new.provider,new.scope_id,new.external_id,new.raw_ciphertext,new.raw_key_version,new.raw_hash,
    new.signature_hash,new.received_at,new.trace_id,new.retention_until) is distinct from
    (old.id,old.connection_id,old.provider,old.scope_id,old.external_id,old.raw_ciphertext,old.raw_key_version,old.raw_hash,
      old.signature_hash,old.received_at,old.trace_id,old.retention_until) then raise exception 'CHANNEL_WEBHOOK_RECEIPT_EVIDENCE_IMMUTABLE'; end if;
  if not(old.state='received' and new.state='processing' or old.state='processing' and new.state in('processing','verified','failed'))
    then raise exception 'CHANNEL_WEBHOOK_RECEIPT_TRANSITION_INVALID'; end if;
  return new;
end
$function$;

create trigger channel_webhookreceipt_guard before update on channel.webhookreceipt
for each row execute function channel.guard_webhook_receipt();

create function channel.guard_webhook_evidence() returns trigger language plpgsql set search_path=pg_catalog,channel as $function$
begin
  if new.version<>old.version+1 then raise exception 'CHANNEL_WEBHOOK_VERSION_INVALID'; end if;
  if (new.id,new.receipt_id,new.connection_id,new.provider,new.scope_id,new.external_id,new.event_type,new.external_reference,
    new.normalized,new.raw_hash,new.signature_hash,new.received_at,new.watermark,new.trace_id,new.attempts) is distinct from
    (old.id,old.receipt_id,old.connection_id,old.provider,old.scope_id,old.external_id,old.event_type,old.external_reference,
      old.normalized,old.raw_hash,old.signature_hash,old.received_at,old.watermark,old.trace_id,old.attempts)
    then raise exception 'CHANNEL_WEBHOOK_EVIDENCE_IMMUTABLE'; end if;
  if not(old.state='processing' and new.state in('applied','failed')) then raise exception 'CHANNEL_WEBHOOK_TRANSITION_INVALID'; end if;
  return new;
end
$function$;

create trigger channel_webhookinbox_evidence before update on channel.webhookinbox
for each row execute function channel.guard_webhook_evidence();

alter table channel.provideroperation drop constraint channel_provideroperation_external;
alter table channel.provideroperation add constraint channel_provideroperation_external unique(provider,external_reference);

insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
  idempotency_key,retention_until,version,authorization_snapshot,created_by,updated_by,created_at,updated_at)
select 'job:channelwebhook:'||receipt.id,receipt.scope_id,receipt.scope_id,'channelwebhook','channel','channel',
  jsonb_build_object('receipt',receipt.id),'queued',10,clock_timestamp(),'{}',0,'job:channelwebhook:'||receipt.id,
  clock_timestamp()+interval '90 days',1,jsonb_build_object('kind','system','actor','system:channelmigration','scope',receipt.scope_id,
    'operation','channel.webhooks.receive','source','migration','capturedAt',clock_timestamp()),
  'system:channelmigration','system:channelmigration',clock_timestamp(),clock_timestamp()
from channel.webhookreceipt receipt where receipt.state='received'
on conflict(id) do nothing;

drop function channel.accept_webhook(text,text,text,text,jsonb,text,text,text,text,timestamptz,text);
create function channel.accept_webhook(p_connection text,p_external text,p_ciphertext text,p_keyversion text,p_rawhash text,
  p_signaturehash text,p_received timestamptz,p_trace text)
returns table(id text,state text,replayed boolean) language plpgsql volatile security definer
set search_path=channel,public,pg_temp as $function$
declare target channel.connection%rowtype; receiptid text; inserted_count integer; accepted channel.webhookreceipt%rowtype;
begin
  if length(p_external) not between 1 and 255 or length(p_keyversion) not between 1 and 255 or p_rawhash!~'^[a-f0-9]{64}$'
    or p_signaturehash!~'^[a-f0-9]{64}$' or p_received not between clock_timestamp()-interval '5 minutes' and clock_timestamp()+interval '5 seconds'
    or p_ciphertext='' or length(p_trace) not between 1 and 255 then raise exception 'CHANNEL_WEBHOOK_RECEIPT_INVALID'; end if;
  select * into target from channel.connection where channel.connection.id=p_connection and status='enabled' for share;
  if target.id is null then raise exception 'CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE'; end if;
  receiptid := 'webhookreceipt:'||encode(public.digest(p_connection||':'||p_external,'sha256'),'hex');
  insert into channel.webhookreceipt(id,connection_id,provider,scope_id,external_id,raw_ciphertext,raw_key_version,raw_hash,
    signature_hash,state,received_at,trace_id,retention_until)
  values(receiptid,p_connection,target.provider,target.scope_id,p_external,p_ciphertext,p_keyversion,p_rawhash,p_signaturehash,
    'received',p_received,p_trace,greatest(p_received,clock_timestamp())+interval '90 days')
  on conflict(connection_id,external_id) do nothing;
  get diagnostics inserted_count=row_count;
  select * into accepted from channel.webhookreceipt receipt where receipt.connection_id=p_connection and receipt.external_id=p_external;
  if accepted.raw_hash<>p_rawhash or accepted.signature_hash<>p_signaturehash then raise exception 'CHANNEL_WEBHOOK_REPLAY_EVIDENCE_CONFLICT'; end if;
  return query select accepted.id,accepted.state,inserted_count=0;
end
$function$;

revoke all on function channel.accept_webhook(text,text,text,text,text,text,timestamptz,text) from public;
grant execute on function channel.accept_webhook(text,text,text,text,text,text,timestamptz,text) to shopapp;

alter table channel.webhookreceipt enable row level security;
alter table channel.webhookreceipt force row level security;
create policy appscope on channel.webhookreceipt for select to shopapp using(access.scope_allowed(scope_id));
create policy jobscope on channel.webhookreceipt for all to shopjob using(true) with check(true);
create policy providerscope on channel.webhookreceipt for all to shopprovider using(true) with check(true);
revoke all on table channel.webhookreceipt from public;
grant select on channel.webhookreceipt to shopapp;
grant select,insert,update,delete on channel.webhookreceipt to shopjob;
grant select,insert,update,delete on channel.webhookreceipt to shopprovider;

select runtime.record_migration_evidence('20260904031000',before.rows_count,after.rows_count,0,0,
  'select id,state,version from channel.webhookinbox order by id;',
  'select id,state,failure_class,error_code,version from channel.webhookreceipt order by id;')
from channel_webhook_before before cross join (
  select (select count(*) from channel.webhookreceipt)+(select count(*) from channel.webhookinbox) rows_count
) after;

insert into runtime.schemaversion(version,checksum)
values('20260904031000',encode(public.digest('20260904031000_verify_channel_webhook','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from channel.webhookreceipt where (state='failed')<>(failure_class is not null)) then raise exception 'CHANNEL_WEBHOOK_RECEIPT_FAILURE_INVALID'; end if;
  if exists(select 1 from channel.webhookinbox where state not in('processing','applied','failed') or receipt_id is null) then raise exception 'CHANNEL_WEBHOOK_INBOX_INVALID'; end if;
  if (select count(*) from pg_trigger where tgrelid in('channel.webhookreceipt'::regclass,'channel.webhookinbox'::regclass)
    and tgname in('channel_webhookreceipt_guard','channel_webhookinbox_evidence') and not tgisinternal)<>2 then raise exception 'CHANNEL_WEBHOOK_GUARD_MISSING'; end if;
  if to_regprocedure('channel.accept_webhook(text,text,text,text,text,text,timestamp with time zone,text)') is null then raise exception 'CHANNEL_WEBHOOK_ACCEPT_FUNCTION_MISSING'; end if;
end
$assert$;

commit;
