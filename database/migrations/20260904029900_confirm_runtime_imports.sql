begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029800') then raise exception 'RUNTIME_IMPORT_CONFIRM_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029900') then raise exception 'RUNTIME_IMPORT_CONFIRM_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table runtime.imports drop constraint imports_state_check;
alter table runtime.imports add constraint imports_state_check
  check(state in('uploaded','scanning','rejected','preflight','ready','running','succeeded','failed','cancelled','expired'));

create or replace function runtime.guard_import_identity()
returns trigger language plpgsql set search_path=pg_catalog,runtime,pg_temp as $function$
begin
  if (new.id,new.tenant_id,new.scope_id,new.owner,new.kind,new.object_key,new.file_hash,new.file_name,new.media_type,new.size_bytes,
      new.authorization_snapshot,new.idempotency_key,new.created_by,new.created_at)
    is distinct from
     (old.id,old.tenant_id,old.scope_id,old.owner,old.kind,old.object_key,old.file_hash,old.file_name,old.media_type,old.size_bytes,
      old.authorization_snapshot,old.idempotency_key,old.created_by,old.created_at) then
    raise exception 'RUNTIME_IMPORT_IDENTITY_IMMUTABLE';
  end if;
  if new.retention_until is distinct from old.retention_until and not(
    old.state='ready' and new.state='ready' and not(old.checkpoint ? 'confirmedAt') and new.checkpoint ? 'confirmedAt'
    and new.retention_until>=old.retention_until and new.retention_until<=clock_timestamp()+interval '91 days') then
    raise exception 'RUNTIME_IMPORT_RETENTION_INVALID';
  end if;
  return new;
end
$function$;

create or replace function runtime.guard_import_chunk()
returns trigger language plpgsql set search_path=pg_catalog,runtime,pg_temp as $function$
begin
  if tg_op='DELETE' then
    if not exists(select 1 from runtime.imports where id=old.import_id
      and state in('rejected','succeeded','failed','cancelled','expired') and retention_until<=clock_timestamp()) then
      raise exception 'RUNTIME_IMPORT_CHUNK_IMMUTABLE';
    end if;
    return old;
  end if;
  if (new.id,new.tenant_id,new.scope_id,new.import_id,new.sequence,new.row_start,new.row_end,new.payload_hash,new.payload,new.created_at)
    is distinct from (old.id,old.tenant_id,old.scope_id,old.import_id,old.sequence,old.row_start,old.row_end,old.payload_hash,old.payload,old.created_at) then
    raise exception 'RUNTIME_IMPORT_CHUNK_IMMUTABLE';
  end if;
  if old.state in('pending','failed') and new.state='running' then
    if (new.checkpoint,new.error_count) is distinct from (old.checkpoint,old.error_count)
      or new.fencing_token<>coalesce(old.fencing_token,0)+1 or new.lease_expires_at<=clock_timestamp() then
      raise exception 'RUNTIME_IMPORT_LEASE_INVALID';
    end if;
  elsif old.state='running' and new.state='running' then
    if (new.checkpoint,new.error_count) is distinct from (old.checkpoint,old.error_count)
      or old.lease_expires_at>clock_timestamp() or new.fencing_token<>old.fencing_token+1 or new.lease_expires_at<=clock_timestamp() then
      raise exception 'RUNTIME_IMPORT_LEASE_INVALID';
    end if;
  elsif old.state='running' and new.state in('failed','succeeded') then
    if new.fencing_token<>old.fencing_token or new.lease_expires_at is not null then raise exception 'RUNTIME_IMPORT_LEASE_INVALID'; end if;
  elsif old.state in('failed','succeeded') and new.state='pending' then
    if new.fencing_token is not null or new.lease_expires_at is not null or new.checkpoint<>'{}'::jsonb or new.error_count<>0
      or not exists(select 1 from runtime.imports where id=old.import_id and state in('failed','rejected')) then
      raise exception 'RUNTIME_IMPORT_RETRY_INVALID';
    end if;
  else
    raise exception 'RUNTIME_IMPORT_CHUNK_STATE_INVALID';
  end if;
  if new.version<>old.version+1 or new.updated_at<old.updated_at then raise exception 'RUNTIME_IMPORT_CHUNK_VERSION_INVALID'; end if;
  return new;
end
$function$;

create table finance.statementimportline(
  import_id text not null references runtime.imports(id) on delete cascade,
  scope_id text not null,
  sequence bigint not null check(sequence>=1),
  external_reference text not null,
  kind text not null check(kind in('payment','refund')),
  amount_minor bigint not null check(amount_minor>0),
  tax_minor bigint not null check(tax_minor>=0),
  currency char(3) not null,
  occurred_at timestamptz,
  raw_hash char(64) not null check(raw_hash~'^[0-9a-f]{64}$'),
  primary key(import_id,sequence),
  unique(import_id,external_reference,kind)
);
alter table finance.statementimportline enable row level security;
create policy jobscope on finance.statementimportline for all to shopjob using(true) with check(true);
grant select,insert,update,delete on finance.statementimportline to shopjob;
create index finance_statementimport_scope on finance.statementimportline(scope_id,import_id,sequence);

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('runtime.uploads.create','runtime','POST','/api/v1/runtime/uploads','5.0.0'),
  ('runtime.imports.confirm','runtime','POST','/api/v1/runtime/imports/{importid}/confirm','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('runtime.uploads.create','operation','创建安全上传会话',1,'active'),
  ('runtime.imports.confirm','operation','确认执行导入',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('runtime.uploads.create','runtime.uploads.create','runtime.import.manage','console','{console}'),
  ('runtime.imports.confirm','runtime.imports.confirm','runtime.import.manage','console','{console}');

insert into capability.dependency(capability_id,depends_on_id) values
  ('runtime.uploads.create','runtime.importing'),
  ('runtime.imports.confirm','runtime.importing');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||id,'organization-platform-root',id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','runtimeimportconfirm'
from capability.capability where id in('runtime.uploads.create','runtime.imports.confirm');

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':runtimeimportconfirm','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','runtimeimportconfirm',clock_timestamp() from capability.entitlement entitlement
where entitlement.capability_id in('runtime.uploads.create','runtime.imports.confirm');

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';
update runtime.contractcatalog set checksum='9608fbefefcc09601019943aec92f485c3ead9a3d183587a43355722b4469b19',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260904029900',
  (select count(*) from runtime.imports where state='ready' and not(checkpoint ? 'confirmedAt')),
  (select count(*) from finance.statementimportline),0,0,
  'select owner,kind,state,count(*) from runtime.imports group by owner,kind,state order by owner,kind,state;',
  'select scope_id,count(*) from finance.statementimportline group by scope_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904029900',encode(public.digest('20260904029900_confirm_runtime_imports','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from runtime.operation)<>365 or (select count(*) from capability.operation)<>365 then raise exception 'RUNTIME_IMPORT_CONFIRM_OPERATION_COUNT_INVALID'; end if;
  if to_regclass('finance.statementimportline') is null then raise exception 'FINANCE_STATEMENT_IMPORT_STAGE_MISSING'; end if;
  if not exists(select 1 from pg_policies where schemaname='finance' and tablename='statementimportline' and policyname='jobscope') then
    raise exception 'FINANCE_STATEMENT_IMPORT_POLICY_MISSING';
  end if;
end
$assert$;

commit;
