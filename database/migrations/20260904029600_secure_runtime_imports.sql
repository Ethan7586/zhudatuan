begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029500') then raise exception 'RUNTIME_IMPORT_SECURITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029600') then raise exception 'RUNTIME_IMPORT_SECURITY_ALREADY_APPLIED'; end if;
  if exists(select 1 from runtime.imports where state not in('rejected','succeeded','failed','cancelled')) then
    raise exception 'RUNTIME_IMPORT_DRAIN_REQUIRED';
  end if;
end
$precondition$;

alter table runtime.imports add column authorization_snapshot jsonb;
update runtime.imports set authorization_snapshot=jsonb_build_object(
  'retired',true,'actor',created_by,'scope',scope_id,'capturedAt',created_at,'operation','runtime.imports.create');
alter table runtime.imports alter column authorization_snapshot set not null;
alter table runtime.imports add constraint runtime_import_authorization check(
  jsonb_typeof(authorization_snapshot)='object' and authorization_snapshot ? 'actor'
  and authorization_snapshot ? 'scope' and authorization_snapshot ? 'capturedAt' and authorization_snapshot ? 'operation');

create function runtime.guard_import_identity()
returns trigger language plpgsql set search_path=pg_catalog,runtime,pg_temp as $function$
begin
  if (new.id,new.tenant_id,new.scope_id,new.owner,new.kind,new.object_key,new.file_hash,new.file_name,new.media_type,new.size_bytes,
      new.authorization_snapshot,new.idempotency_key,new.created_by,new.created_at,new.retention_until)
    is distinct from
     (old.id,old.tenant_id,old.scope_id,old.owner,old.kind,old.object_key,old.file_hash,old.file_name,old.media_type,old.size_bytes,
      old.authorization_snapshot,old.idempotency_key,old.created_by,old.created_at,old.retention_until) then
    raise exception 'RUNTIME_IMPORT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end
$function$;

create trigger runtime_import_identity_guard before update on runtime.imports
for each row execute function runtime.guard_import_identity();
revoke all on function runtime.guard_import_identity() from public;

select runtime.record_migration_evidence('20260904029600',
  (select count(*) from runtime.imports),(select count(*) from runtime.imports where authorization_snapshot ? 'actor'),0,0,
  'select state,count(*) from runtime.imports group by state;',
  'select owner,kind,count(*) from runtime.imports group by owner,kind order by owner,kind;');
insert into runtime.schemaversion(version,checksum)
values('20260904029600',encode(public.digest('20260904029600_secure_runtime_imports','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from runtime.imports where authorization_snapshot is null) then raise exception 'RUNTIME_IMPORT_AUTHORIZATION_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='runtime.imports'::regclass and tgname='runtime_import_identity_guard' and not tgisinternal) then
    raise exception 'RUNTIME_IMPORT_IDENTITY_GUARD_MISSING';
  end if;
end
$assert$;

commit;
