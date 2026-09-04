begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029300') then raise exception 'IMPORT_LEASE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029400') then raise exception 'IMPORT_LEASE_ALREADY_APPLIED'; end if;
  -- An expiry cannot be invented for work already owned by an unknown worker.
  if exists(select 1 from runtime.import_chunks where state='running') then raise exception 'RUNTIME_IMPORT_CHUNK_DRAIN_REQUIRED'; end if;
end
$precondition$;

alter table runtime.import_chunks add column lease_expires_at timestamptz;
alter table runtime.import_chunks add constraint runtime_import_chunk_lease check(
  (state='running')=(lease_expires_at is not null) and
  (state<>'running' or fencing_token is not null and lease_expires_at>updated_at));

create function runtime.guard_import_chunk()
returns trigger language plpgsql set search_path=pg_catalog,runtime,pg_temp as $$
begin
  if tg_op='DELETE' then
    if not exists(select 1 from runtime.imports where id=old.import_id
      and state in('rejected','succeeded','failed','cancelled') and retention_until<=clock_timestamp()) then
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
  else
    raise exception 'RUNTIME_IMPORT_CHUNK_STATE_INVALID';
  end if;
  if new.version<>old.version+1 or new.updated_at<old.updated_at then raise exception 'RUNTIME_IMPORT_CHUNK_VERSION_INVALID'; end if;
  return new;
end
$$;

create trigger runtime_import_chunk_guard before update or delete on runtime.import_chunks
for each row execute function runtime.guard_import_chunk();
revoke all on function runtime.guard_import_chunk() from public;

select runtime.record_migration_evidence('20260904029400',0,0,0,0,
  'select state,count(*),min(lease_expires_at) from runtime.import_chunks group by state;',
  'select import_id,sequence,fencing_token,lease_expires_at from runtime.import_chunks where state=''running'' order by lease_expires_at;');
insert into runtime.schemaversion(version,checksum)
values('20260904029400',encode(public.digest('20260904029400_enforce_import_leases','sha256'),'hex'));

commit;
