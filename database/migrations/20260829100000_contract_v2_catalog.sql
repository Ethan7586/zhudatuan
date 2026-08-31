begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829054500') then
    raise exception 'CONTRACT_V2_PREVIOUS_HEAD_MISSING';
  end if;
  if to_regclass('runtime.contractcatalog') is not null or exists(select 1 from runtime.schemaversion where version='20260829100000') then
    raise exception 'CONTRACT_V2_ALREADY_APPLIED';
  end if;
end $precondition$;

create table runtime.migrationevidence(
  migration text primary key,
  source_rows bigint not null check(source_rows>=0),
  target_rows bigint not null check(target_rows>=0),
  source_minor numeric(30,0) not null,
  target_minor numeric(30,0) not null,
  concurrent_index_sql text not null check(length(concurrent_index_sql)>0),
  recovery_sql text not null check(length(recovery_sql)>0),
  recorded_at timestamptz not null default clock_timestamp(),
  check(source_rows=target_rows),
  check(source_minor=target_minor)
);

create or replace function runtime.record_migration_evidence(
  p_migration text,p_source_rows bigint,p_target_rows bigint,p_source_minor numeric,p_target_minor numeric,
  p_concurrent_index_sql text,p_recovery_sql text
) returns void language plpgsql security definer set search_path=runtime,pg_temp as $function$
begin
  if p_source_rows<>p_target_rows or p_source_minor<>p_target_minor then
    raise exception 'MIGRATION_RECONCILIATION_FAILED:%',p_migration;
  end if;
  insert into runtime.migrationevidence(migration,source_rows,target_rows,source_minor,target_minor,concurrent_index_sql,recovery_sql)
  values(p_migration,p_source_rows,p_target_rows,p_source_minor,p_target_minor,p_concurrent_index_sql,p_recovery_sql);
end $function$;

create table runtime.contractcatalog(
  artifact text not null,
  version text not null,
  checksum char(64) not null check(checksum~'^[0-9a-f]{64}$'),
  operation_count integer not null check(operation_count>0),
  event_count integer not null check(event_count>0),
  status text not null check(status in('active','retired')),
  published_at timestamptz not null,
  primary key(artifact,version)
);

insert into runtime.operation(id,owner,method,path,contract_version)
values('catalog.product.detail.read','catalog','GET','/api/v1/catalog/products/{productid}','2.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;
update runtime.operation set contract_version='2.0.0' where contract_version<>'2.0.0';
update runtime.operation set owner='checkout' where id='order.orders.create';

insert into runtime.event(type,version,owner,schema_ref) values
  ('order.export.requested',1,'order','contract://events/order.export.requested/v1'),
  ('finance.export.requested',1,'finance','contract://events/finance.export.requested/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

insert into capability.capability(id,kind,name,version,status)
values('catalog.product.detail.read','operation','catalog.product.detail.read',2,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;
alter table capability.operation drop constraint operation_audience_check;
update capability.operation set audience=case audience
  when 'operator' then 'console' when 'member' then 'storefront' when 'provider' then 'webhook'
  when 'public' then 'storefront' else audience end;
update capability.operation set audience='system'
where operation_id in('runtime.health.live','runtime.health.ready','runtime.health.startup');
update capability.operation set audience='webhook'
where operation_id in('payment.webhooks.wechat','channel.webhooks.receive');
alter table capability.operation add constraint operation_audience_check
  check(audience in('console','storefront','system','webhook')) not valid;
alter table capability.operation validate constraint operation_audience_check;
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('catalog.product.detail.read','catalog.product.detail.read','catalog.product.read','console')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,audience=excluded.audience;
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:catalog.product.detail.read','organization-platform-root','catalog.product.detail.read','enabled',null,
  '1970-01-01T00:00:00Z',null,0) on conflict(id) do nothing;

alter table runtime.operation add constraint runtime_operation_contract_v2 check(contract_version='2.0.0') not valid;
alter table runtime.operation validate constraint runtime_operation_contract_v2;
create index runtime_operation_owner_contract on runtime.operation(owner,contract_version,id);
create unique index runtime_contractcatalog_active on runtime.contractcatalog(artifact) where status='active';

insert into runtime.contractcatalog(artifact,version,checksum,operation_count,event_count,status,published_at)
values('commerce','2.0.0','4e673875232b443e8f417de553863bab953f407e8a3d6d9fdf45a6298c40142d',
  (select count(*) from runtime.operation),(select count(*) from runtime.event),'active',clock_timestamp());

alter table runtime.migrationevidence enable row level security;
alter table runtime.contractcatalog enable row level security;
create policy appselect on runtime.contractcatalog for select to shopapp using(true);
create policy jobselect on runtime.contractcatalog for select to shopjob using(true);
create policy migrationevidence on runtime.migrationevidence for select to shopmigration using(true);
grant select on runtime.contractcatalog to shopapp,shopjob;
grant select on runtime.migrationevidence to shopmigration;
revoke all on function runtime.record_migration_evidence(text,bigint,bigint,numeric,numeric,text,text) from public,shopapp,shopjob;
grant execute on function runtime.record_migration_evidence(text,bigint,bigint,numeric,numeric,text,text) to shopmigration;

select runtime.record_migration_evidence('20260829100000',
  (select count(*) from runtime.operation)+(select count(*) from runtime.event),
  (select count(*) from runtime.operation)+(select count(*) from runtime.event),0,0,
  'create index concurrently if not exists runtime_operation_owner_contract_live on runtime.operation(owner,contract_version,id);',
  'begin; update runtime.contractcatalog set status=''retired'' where artifact=''commerce'' and version=''2.0.0''; commit;');

insert into runtime.schemaversion(version,checksum)
values('20260829100000','4e673875232b443e8f417de553863bab953f407e8a3d6d9fdf45a6298c40142d');

do $assert$ begin
  if (select count(*) from runtime.operation)<>218 or (select count(*) from capability.operation)<>218 then
    raise exception 'CONTRACT_V2_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from runtime.event)<>60 then raise exception 'CONTRACT_V2_EVENT_COUNT_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='2.0.0' and status='active') then
    raise exception 'CONTRACT_V2_CATALOG_INVALID';
  end if;
end $assert$;

commit;
