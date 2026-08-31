begin;

alter table channel.connection add column created_at timestamptz not null default clock_timestamp();
alter table channel.connection add column updated_at timestamptz not null default clock_timestamp();

create table channel.webhookinbox(
  id text primary key,
  connection_id text not null references channel.connection(id),
  provider text not null,
  scope_id text not null,
  external_id text not null,
  event_type text not null,
  external_reference text,
  normalized jsonb not null check(jsonb_typeof(normalized)='object'),
  raw_ciphertext text not null,
  raw_key_version text not null,
  raw_hash char(64) not null,
  signature_hash char(64) not null,
  state text not null check(state in('received','processing','applied','ignored','failed')),
  error_code text,
  received_at timestamptz not null,
  processed_at timestamptz,
  trace_id text not null,
  attempts integer not null default 0 check(attempts>=0),
  unique(connection_id,external_id)
);

create index channel_webhookinbox_work on channel.webhookinbox(state,received_at,id);
create index channel_webhookinbox_reference on channel.webhookinbox(provider,external_reference,received_at desc);

create or replace function channel.webhook_context(p_connection text)
returns table(provider text,scope_id text,status text) language sql stable security definer
set search_path=channel,pg_temp as $function$
  select connection.provider,connection.scope_id,connection.status from channel.connection connection
  where connection.id=p_connection and connection.status in('enabled','degraded')
$function$;

create or replace function channel.accept_webhook(p_connection text,p_external text,p_event text,p_reference text,p_normalized jsonb,
  p_ciphertext text,p_keyversion text,p_rawhash text,p_signaturehash text,p_received timestamptz,p_trace text)
returns table(id text,state text,replayed boolean) language plpgsql volatile security definer
set search_path=channel,runtime,public,pg_temp as $function$
declare target channel.connection%rowtype; inboxid text; inserted_count integer;
begin
  select * into target from channel.connection where channel.connection.id=p_connection and status in('enabled','degraded') for share;
  if target.id is null then raise exception 'CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE'; end if;
  inboxid := 'webhook:'||encode(public.digest(p_connection||':'||p_external,'sha256'),'hex');
  insert into channel.webhookinbox(id,connection_id,provider,scope_id,external_id,event_type,external_reference,normalized,
    raw_ciphertext,raw_key_version,raw_hash,signature_hash,state,received_at,trace_id)
  values(inboxid,p_connection,target.provider,target.scope_id,p_external,p_event,p_reference,p_normalized,p_ciphertext,p_keyversion,
    p_rawhash,p_signaturehash,'received',p_received,p_trace) on conflict(connection_id,external_id) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=1 then
    insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values('job:channelwebhook:'||inboxid,'channelwebhook','channel',target.scope_id,jsonb_build_object('webhook',inboxid),
      'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing;
  end if;
  return query select webhook.id,webhook.state,inserted_count=0 from channel.webhookinbox webhook
    where webhook.connection_id=p_connection and webhook.external_id=p_external;
end $function$;

revoke all on function channel.webhook_context(text) from public;
revoke all on function channel.accept_webhook(text,text,text,text,jsonb,text,text,text,text,timestamptz,text) from public;
grant execute on function channel.webhook_context(text) to shopapp,shopjob;
grant execute on function channel.accept_webhook(text,text,text,text,jsonb,text,text,text,text,timestamptz,text) to shopapp;

alter table channel.webhookinbox enable row level security;
create policy appscope on channel.webhookinbox for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on channel.webhookinbox for all to shopjob using(true) with check(true);
grant select,insert,update,delete on channel.webhookinbox to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('channel.connections.read','channel','GET','/api/v1/channels/connections','1.0.0'),
  ('channel.webhooks.receive','channel','POST','/api/v1/channels/webhooks/{connectionid}','1.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:fdba75650aafcd9ca8726a0b','channel.connection.read','high','active');
insert into capability.capability(id,kind,name,version,status) values
  ('channel.connections.read','operation','channel.connections.read',1,'active'),
  ('channel.webhooks.receive','operation','channel.webhooks.receive',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('channel.connections.read','channel.connections.read','channel.connection.read','operator'),
  ('channel.webhooks.receive','channel.webhooks.receive',null,'provider');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
  values('platform:channel.connections.read','organization-platform-root','channel.connections.read','enabled',null,
    '1970-01-01T00:00:00Z',null,0);

insert into runtime.event(type,version,owner,schema_ref) values
  ('channel.webhook.applied',1,'channel','contract://events/channel.webhook.applied/v1'),
  ('channel.refund.changed',1,'channel','contract://events/channel.refund.changed/v1');

insert into runtime.schemaversion(version,checksum) values('20260821044000','92c853b3c5476231f83391c939d6ab4083972cbc7bc5da0dbd16869e5224f9e7');

do $assert$ begin
  if (select count(*) from runtime.operation)<>189 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821044000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
