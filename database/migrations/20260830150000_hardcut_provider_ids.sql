begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830149000') then raise exception 'PROVIDER_HARDCUT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830150000') then raise exception 'PROVIDER_HARDCUT_ALREADY_APPLIED'; end if;
  if exists(
    select 1 from extension.installation installation
    where installation.extension_id in('private','directcharge','tmallmarket')
      and not exists(
        select 1 from extension.manifest replacement
        join extension.contractversion contract on contract.extension_id=replacement.id
          and contract.contract_version=replacement.contract_version and contract.status='verified'
        where replacement.id=case installation.extension_id
          when 'private' then 'supplier' when 'directcharge' then 'charge' when 'tmallmarket' then 'tmall' end
          and replacement.version=installation.extension_version
      )
  ) then raise exception 'PROVIDER_HARDCUT_SIGNED_REPLACEMENT_MISSING'; end if;
end $precondition$;

create temporary table provider_hardcut_reconcile(
  source_rows bigint not null,
  target_rows bigint not null
) on commit drop;
insert into provider_hardcut_reconcile values(0,0);

alter table extension.installation drop constraint installation_check;
alter table extension.installation drop constraint installation_extension_id_extension_version_fkey;

do $hardcut$ declare target record; source_count bigint; changed bigint; begin
  for target in
    select columninfo.table_schema,columninfo.table_name
    from information_schema.columns columninfo join information_schema.tables tableinfo
      on tableinfo.table_schema=columninfo.table_schema and tableinfo.table_name=columninfo.table_name
    where columninfo.column_name='provider' and columninfo.data_type in('text','character varying')
      and tableinfo.table_type='BASE TABLE' and columninfo.table_schema not in('pg_catalog','information_schema')
  loop
    execute format('select count(*) from %I.%I where provider in(''private'',''directcharge'',''tmallmarket'')',target.table_schema,target.table_name) into strict source_count;
    update provider_hardcut_reconcile set source_rows=source_rows+source_count;
    execute format('update %I.%I set provider=case provider when ''private'' then ''supplier'' when ''directcharge'' then ''charge'' when ''tmallmarket'' then ''tmall'' end where provider in(''private'',''directcharge'',''tmallmarket'')',target.table_schema,target.table_name);
    get diagnostics changed=row_count;
    update provider_hardcut_reconcile set target_rows=target_rows+changed;
  end loop;
end $hardcut$;

update provider_hardcut_reconcile set source_rows=source_rows+
  (select count(*) from extension.installation where extension_id in('private','directcharge','tmallmarket'))+
  (select count(*) from extension.registry where extension_id in('private','directcharge','tmallmarket'));

with replacements as (
  select installation.id,
    case installation.extension_id when 'private' then 'supplier' when 'directcharge' then 'charge' when 'tmallmarket' then 'tmall' end extension_id,
    replacement.manifest||jsonb_build_object('signature',replacement.signature) manifest
  from extension.installation installation
  join extension.manifest replacement on replacement.id=case installation.extension_id
    when 'private' then 'supplier' when 'directcharge' then 'charge' when 'tmallmarket' then 'tmall' end
    and replacement.version=installation.extension_version
  where installation.extension_id in('private','directcharge','tmallmarket')
), changed as (
  update extension.installation installation set extension_id=replacements.extension_id,manifest=replacements.manifest
  from replacements where installation.id=replacements.id returning 1
)
update provider_hardcut_reconcile set target_rows=target_rows+(select count(*) from changed);

with changed as (
  update extension.registry set extension_id=case extension_id
    when 'private' then 'supplier' when 'directcharge' then 'charge' when 'tmallmarket' then 'tmall' end
  where extension_id in('private','directcharge','tmallmarket') returning 1
)
update provider_hardcut_reconcile set target_rows=target_rows+(select count(*) from changed);

delete from extension.contractversion where extension_id in('private','directcharge','tmallmarket');
delete from extension.manifest where id in('private','directcharge','tmallmarket');

alter table extension.installation add constraint installation_extension_id_extension_version_fkey
  foreign key(extension_id,extension_version) references extension.manifest(id,version);
alter table extension.installation add constraint extension_installation_connection check(
  extension_id='supplier' or (base_url is not null and secret_ref is not null and health_operation is not null)
) not valid;
alter table extension.installation validate constraint extension_installation_connection;

alter function channel.private_enabled(text) rename to supplier_enabled;
alter function channel.pull_private_catalog(text,text) rename to pull_supplier_catalog;
alter function channel.pull_private_stock(text,jsonb) rename to pull_supplier_stock;
alter function channel.submit_private_order(text,text,text,jsonb) rename to submit_supplier_order;
alter function channel.cancel_private_order(text,text,text,text) rename to cancel_supplier_order;
alter function channel.pull_private_tracking(text,text) rename to pull_supplier_tracking;
alter function channel.submit_private_refund(text,text,jsonb) rename to submit_supplier_refund;
alter function channel.build_private_statement(text,jsonb) rename to build_supplier_statement;

create or replace function channel.supplier_enabled(p_scope text)
returns boolean language sql stable security definer set search_path=channel,pg_temp as $function$
  select exists(select 1 from channel.connection where provider='supplier' and scope_id=p_scope and status='enabled')
$function$;

create or replace function channel.pull_supplier_catalog(p_scope text,p_cursor text)
returns jsonb language sql stable security definer set search_path=channel,catalog,pg_temp as $function$
  with batch as (select external_id,source_version,source_payload from catalog.sourcelisting
    where provider='supplier' and scope_id=p_scope and status<>'retired' and (p_cursor is null or external_id>p_cursor)
    order by external_id limit 500)
  select jsonb_build_object('records',coalesce(jsonb_agg(jsonb_build_object('externalId',external_id,'version',source_version,'payload',source_payload) order by external_id),'[]'::jsonb),
    'errors','[]'::jsonb,'complete',(select count(*)<500 from batch))||(case when count(*)=500 then jsonb_build_object('nextCursor',max(external_id)) else '{}'::jsonb end) from batch
$function$;

create or replace function channel.pull_supplier_stock(p_scope text,p_keys jsonb)
returns jsonb language sql stable security definer set search_path=channel,catalog,inventory,pg_temp as $function$
  select jsonb_build_object('records',coalesce(jsonb_agg(jsonb_build_object('externalId',listing.external_id,'onhand',stock.onhand,'safety',stock.safety,'version',stock.version,'status',stock.status)),'[]'::jsonb))
  from jsonb_array_elements(p_keys) key join catalog.sourcelisting listing on listing.provider='supplier' and listing.scope_id=p_scope and listing.external_id=key->>'externalId'
  join inventory.stockitem stock on stock.sku_id=listing.sku_id and stock.scope_id=p_scope
$function$;

create or replace function channel.submit_supplier_order(p_scope text,p_key text,p_reference text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=channel,pg_temp as $function$
declare operation channel.provideroperation%rowtype; request_digest text;
begin
  if not exists(select 1 from channel.connection where provider='supplier' and scope_id=p_scope and status='enabled') then raise exception 'SUPPLIER_PROVIDER_DISABLED'; end if;
  request_digest=encode(digest(p_reference||':'||p_payload::text,'sha256'),'hex');
  insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
  values('supplier-order:'||md5(p_scope||':'||p_key),'supplier',p_scope,'order',p_key,p_reference,p_reference,'succeeded',request_digest,
    jsonb_build_object('externalReference',p_reference,'state','accepted','rawReference','local:'||p_reference),clock_timestamp(),clock_timestamp())
  on conflict(provider,kind,idempotency_key) do nothing;
  select * into strict operation from channel.provideroperation where provider='supplier' and kind='order' and idempotency_key=p_key;
  if operation.request_hash<>request_digest then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
  return operation.response;
end $function$;

create or replace function channel.cancel_supplier_order(p_scope text,p_key text,p_reference text,p_reason text)
returns jsonb language plpgsql security definer set search_path=channel,pg_temp as $function$
declare response jsonb; request_digest text;
begin
  request_digest=encode(digest(p_reference||':'||p_reason,'sha256'),'hex'); response=jsonb_build_object('externalReference',p_reference,'state','cancelled');
  insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
  values('supplier-cancel:'||md5(p_scope||':'||p_key),'supplier',p_scope,'cancel',p_key,p_reference,p_reference,'succeeded',request_digest,response,clock_timestamp(),clock_timestamp())
  on conflict(provider,kind,idempotency_key) do update set updated_at=channel.provideroperation.updated_at
  where channel.provideroperation.request_hash=excluded.request_hash;
  if not found then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if; return response;
end $function$;

create or replace function channel.pull_supplier_tracking(p_scope text,p_reference text)
returns jsonb language sql stable security definer set search_path=channel,ordering,fulfillment,pg_temp as $function$
  select jsonb_build_object('externalReference',p_reference,'milestones',coalesce(jsonb_agg(jsonb_build_object('kind',milestone.kind,'state',milestone.state,'occurredAt',milestone.occurred_at) order by milestone.occurred_at) filter(where milestone.id is not null),'[]'::jsonb))
  from fulfillment.fulfillmentorder target left join fulfillment.milestone milestone on milestone.fulfillment_id=target.id
  where target.external_reference=p_reference and exists(select 1 from ordering.orderrecord source where source.id=target.order_id and source.scope_id=p_scope)
$function$;

create or replace function channel.submit_supplier_refund(p_scope text,p_key text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=channel,pg_temp as $function$
declare response jsonb; request_digest text; reference text;
begin
  reference=p_request->>'reference'; if reference is null then raise exception 'SUPPLIER_REFUND_REFERENCE_REQUIRED'; end if;
  request_digest=encode(digest(p_request::text,'sha256'),'hex'); response=jsonb_build_object('externalReference','refund:'||reference,'state','submitted');
  insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
  values('supplier-refund:'||md5(p_scope||':'||p_key),'supplier',p_scope,'refund',p_key,reference,'refund:'||reference,'submitted',request_digest,response,clock_timestamp(),clock_timestamp())
  on conflict(provider,kind,idempotency_key) do update set updated_at=channel.provideroperation.updated_at where channel.provideroperation.request_hash=excluded.request_hash;
  if not found then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if; return response;
end $function$;

create or replace function channel.build_supplier_statement(p_scope text,p_period jsonb)
returns jsonb language sql stable security definer set search_path=channel,pg_temp as $function$
  select jsonb_build_object('objectRef',statement.object_ref,'sha256',statement.sha256) from channel.statement statement
  where statement.provider='supplier' and statement.period_start=(p_period->>'start')::date and statement.period_end=(p_period->>'end')::date
$function$;

do $assert$ declare target record; remaining bigint; begin
  for target in
    select columninfo.table_schema,columninfo.table_name
    from information_schema.columns columninfo join information_schema.tables tableinfo
      on tableinfo.table_schema=columninfo.table_schema and tableinfo.table_name=columninfo.table_name
    where columninfo.column_name='provider' and columninfo.data_type in('text','character varying')
      and tableinfo.table_type='BASE TABLE' and columninfo.table_schema not in('pg_catalog','information_schema')
  loop
    execute format('select count(*) from %I.%I where provider in(''private'',''directcharge'',''tmallmarket'')',target.table_schema,target.table_name) into strict remaining;
    if remaining<>0 then raise exception 'LEGACY_PROVIDER_ID_REMAINS: %.%',target.table_schema,target.table_name; end if;
  end loop;
  if exists(select 1 from extension.installation where extension_id in('private','directcharge','tmallmarket'))
    or exists(select 1 from extension.registry where extension_id in('private','directcharge','tmallmarket'))
    or exists(select 1 from extension.manifest where id in('private','directcharge','tmallmarket'))
    or exists(select 1 from extension.contractversion where extension_id in('private','directcharge','tmallmarket'))
  then raise exception 'LEGACY_EXTENSION_ID_REMAINS'; end if;
end $assert$;

select runtime.record_migration_evidence('20260830150000',source_rows,target_rows,0,0,
  'create index concurrently if not exists channel_connection_provider_scope_live on channel.connection(provider,scope_id,status);',
  'select table_schema,table_name,column_name from information_schema.columns where column_name in(''provider'',''extension_id'');')
from provider_hardcut_reconcile;

insert into runtime.schemaversion(version,checksum)
values('20260830150000',encode(public.digest('20260830150000_hardcut_provider_ids','sha256'),'hex'));

commit;
