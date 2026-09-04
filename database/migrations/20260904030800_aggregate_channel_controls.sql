begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030700') then raise exception 'CHANNEL_AGGREGATE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030800') then raise exception 'CHANNEL_AGGREGATE_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table channel_aggregate_before on commit drop as
select (select count(*) from channel.distributor)+(select count(*) from channel.tenantbinding)+
  (select count(*) from channel.provideroperation) rows_count;

alter table channel.distributor add column version bigint not null default 0;
alter table channel.distributor add constraint channel_distributor_version check(version>=0);
alter table channel.tenantbinding add column version bigint not null default 0;
alter table channel.tenantbinding add constraint channel_tenantbinding_version check(version>=0);
alter table channel.tenantbinding add constraint channel_tenantbinding_period check(expires_at is null or expires_at>effective_at);

alter table channel.provideroperation add column response_summary jsonb not null default '{}'::jsonb;
update channel.provideroperation set response_summary=jsonb_strip_nulls(jsonb_build_object(
  'state',case when jsonb_typeof(response)='object' and jsonb_typeof(response->'state')='string' then response->>'state' end,
  'externalReference',case when jsonb_typeof(response)='object' and jsonb_typeof(response->'externalReference')='string' then response->>'externalReference'
    when jsonb_typeof(response)='object' and jsonb_typeof(response->'reference')='string' then response->>'reference' end,
  'code',case when jsonb_typeof(response)='object' and coalesce(response->>'code',response->>'error')~'^[A-Z][A-Z0-9_]{2,127}$'
    then coalesce(response->>'code',response->>'error') end,
  'accepted',case when jsonb_typeof(response)='object' and jsonb_typeof(response->'accepted')='boolean' then response->'accepted' end,
  'itemCount',case when jsonb_typeof(response)='object' and jsonb_typeof(response->'itemCount')='number' then response->'itemCount' end));
alter table channel.provideroperation add column response_hash char(64);
update channel.provideroperation set response_hash=encode(public.digest(concat_ws(chr(31),coalesce(response_summary->>'state',''),
  coalesce(response_summary->>'externalReference',''),coalesce(response_summary->>'code',''),coalesce(response_summary->>'accepted',''),
  coalesce(response_summary->>'itemCount','')),'sha256'),'hex');
alter table channel.provideroperation alter column response_hash set not null;
alter table channel.provideroperation add column version bigint not null default 0;
alter table channel.provideroperation drop column response;
alter table channel.provideroperation add constraint channel_provideroperation_summary check(
  jsonb_typeof(response_summary)='object' and pg_column_size(response_summary)<=4096
  and response_summary-array['state','externalReference','code','accepted','itemCount']='{}'::jsonb);
alter table channel.provideroperation add constraint channel_provideroperation_hashes check(
  request_hash~'^[a-f0-9]{64}$' and response_hash~'^[a-f0-9]{64}$');
alter table channel.provideroperation add constraint channel_provideroperation_version check(version>=0);
alter table channel.provideroperation drop constraint provideroperation_provider_kind_idempotency_key_key;
alter table channel.provideroperation drop constraint provideroperation_provider_kind_external_reference_key;
alter table channel.provideroperation add constraint channel_provideroperation_idempotency unique(provider,scope_id,kind,idempotency_key);
alter table channel.provideroperation add constraint channel_provideroperation_external unique(provider,scope_id,kind,external_reference);

select runtime.record_migration_evidence('20260904030800',before.rows_count,after.rows_count,0,0,
  'select id,status,version from channel.distributor order by id;',
  'select id,provider,scope_id,kind,state,request_hash,response_summary,response_hash,version from channel.provideroperation order by id;')
from channel_aggregate_before before cross join (
  select (select count(*) from channel.distributor)+(select count(*) from channel.tenantbinding)+
    (select count(*) from channel.provideroperation) rows_count
) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030800',encode(public.digest('20260904030800_aggregate_channel_controls','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from channel.provideroperation where response_summary-array['state','externalReference','code','accepted','itemCount']<>'{}'::jsonb)
    then raise exception 'CHANNEL_PROVIDER_RESPONSE_UNSAFE'; end if;
  if exists(select 1 from channel.provideroperation where response_hash<>encode(public.digest(concat_ws(chr(31),coalesce(response_summary->>'state',''),
    coalesce(response_summary->>'externalReference',''),coalesce(response_summary->>'code',''),coalesce(response_summary->>'accepted',''),
    coalesce(response_summary->>'itemCount','')),'sha256'),'hex'))
    then raise exception 'CHANNEL_PROVIDER_RESPONSE_HASH_INVALID'; end if;
end
$assert$;

commit;
