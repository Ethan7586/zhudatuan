begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829104000') then raise exception 'AUDIT_CHAIN_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829105000')
    or exists(select 1 from information_schema.columns where table_schema='audit' and table_name='record' and column_name='signature_version') then
    raise exception 'AUDIT_CHAIN_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table audit_reconcile on commit drop as
select count(*)::bigint rows,0::numeric minor from(
  select id from audit.record union all select id from audit.accessrecord
) records;
create temporary table audit_chain on commit drop as
select kind,id,lag(record_hash) over(partition by scope_id order by occurred_at,id) previous_hash from(
  select 'command' kind,id,scope_id,record_hash,recorded_at occurred_at from audit.record
  union all select 'access',id,scope_id,record_hash,accessed_at from audit.accessrecord
) records;

alter table audit.record disable trigger immutable;
alter table audit.accessrecord disable trigger immutable;
update audit.record target set previous_hash=chain.previous_hash from audit_chain chain
where chain.kind='command' and chain.id=target.id and target.previous_hash is distinct from chain.previous_hash;
update audit.accessrecord target set previous_hash=chain.previous_hash from audit_chain chain
where chain.kind='access' and chain.id=target.id and target.previous_hash is distinct from chain.previous_hash;
alter table audit.record enable trigger immutable;
alter table audit.accessrecord enable trigger immutable;
alter table audit.record add column signature_version integer not null default 1;
alter table audit.accessrecord add column signature_version integer not null default 1;
alter table audit.record alter column signature_version set default 2;
alter table audit.accessrecord alter column signature_version set default 2;
alter table audit.record add constraint audit_record_signature_version check(signature_version between 1 and 16) not valid;
alter table audit.accessrecord add constraint audit_access_signature_version check(signature_version between 1 and 16) not valid;
alter table audit.record validate constraint audit_record_signature_version;
alter table audit.accessrecord validate constraint audit_access_signature_version;

create table audit.archiveitem(
  archive_id text not null references audit.archiveref(id),
  record_kind text not null check(record_kind in('command','access')),
  record_id text not null,
  scope_id text not null,
  record_hash char(64) not null check(record_hash~'^[0-9a-f]{64}$'),
  archived_at timestamptz not null,
  primary key(record_kind,record_id),
  unique(archive_id,record_kind,record_id)
);
create index audit_archiveitem_archive on audit.archiveitem(archive_id,record_kind,record_id);
alter table audit.archiveitem enable row level security;
create policy appselect on audit.archiveitem for select to shopapp using(audit.scope_allowed(scope_id));
create policy joball on audit.archiveitem for all to shopjob using(true) with check(true);
grant select on audit.archiveitem to shopapp;
grant select,insert on audit.archiveitem to shopjob;

create or replace function audit.reject_mutation() returns trigger language plpgsql security definer
set search_path=audit,pg_temp as $function$
begin
  raise exception 'AUDIT_IMMUTABLE';
end
$function$;
create trigger immutable before update or delete on audit.archiveitem for each row execute function audit.reject_mutation();

create or replace function audit.enforce_chain() returns trigger language plpgsql security definer set search_path=audit,pg_temp as $function$
declare expected char(64);
begin
  perform pg_advisory_xact_lock(hashtextextended('audit:'||new.scope_id,0));
  select record_hash into expected from(
    select record_hash,recorded_at occurred_at,id from audit.record where scope_id=new.scope_id
    union all select record_hash,accessed_at,id from audit.accessrecord where scope_id=new.scope_id
    union all select last_record_hash,through_at,id from audit.archiveref where scope_id=new.scope_id
  ) chain order by occurred_at desc,id desc limit 1;
  if new.previous_hash is distinct from expected then raise exception 'AUDIT_CHAIN_PREVIOUS_HASH_INVALID'; end if;
  return new;
end $function$;
create trigger audit_record_chain before insert on audit.record for each row execute function audit.enforce_chain();
create trigger audit_access_chain before insert on audit.accessrecord for each row execute function audit.enforce_chain();
create index audit_record_chain_lookup on audit.record(scope_id,recorded_at desc,id desc,record_hash);
create index audit_access_chain_lookup on audit.accessrecord(scope_id,accessed_at desc,id desc,record_hash);

select runtime.record_migration_evidence('20260829105000',(select rows from audit_reconcile),
  (select count(*) from(select id from audit.record union all select id from audit.accessrecord) records),0,0,
  'create index concurrently if not exists audit_record_chain_lookup_live on audit.record(scope_id,recorded_at desc,id desc,record_hash);',
  'select scope_id,count(*) from audit.record where signature_version<1 group by scope_id; select record_kind,record_id,count(*) from audit.archiveitem group by record_kind,record_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260829105000',encode(public.digest('20260829105000_audit_hash_chain','sha256'),'hex'));

commit;
