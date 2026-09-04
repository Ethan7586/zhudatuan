begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032700') then raise exception 'AUDIT_ARCHIVE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032800')
    or exists(select 1 from information_schema.columns where table_schema='audit' and table_name='archiveref' and column_name='plaintext_sha256') then
    raise exception 'AUDIT_ARCHIVE_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table audit.archiveref
  add column plaintext_sha256 char(64),
  add column index_sha256 char(64),
  add column locked_until timestamptz,
  add column bundle_version integer not null default 1,
  add constraint audit_archive_bundle check(
    (bundle_version=1 and plaintext_sha256 is null and index_sha256 is null and locked_until is null)
    or(bundle_version=2 and plaintext_sha256~'^[0-9a-f]{64}$' and index_sha256~'^[0-9a-f]{64}$' and locked_until>=expires_at)
  );
alter table audit.archiveref alter column bundle_version set default 2;

create table audit.archivedisposal(
  archive_id text primary key references audit.archiveref(id),
  scope_id text not null,
  object_ref text not null,
  object_sha256 char(64) not null check(object_sha256~'^[0-9a-f]{64}$'),
  reason text not null check(reason='legal-retention-expired'),
  trace_id text not null,
  removed_at timestamptz not null
);
create index audit_archive_disposal_scope on audit.archivedisposal(scope_id,removed_at desc,archive_id);
create index audit_archive_expiry on audit.archiveref(expires_at,id);

alter table audit.archivedisposal enable row level security;
create policy appselect on audit.archivedisposal for select to shopapp using(audit.scope_allowed(scope_id));
create policy jobselect on audit.archivedisposal for select to shopjob using(true);
create policy jobinsert on audit.archivedisposal for insert to shopjob with check(true);
grant select on audit.archivedisposal to shopapp,shopjob;
grant insert on audit.archivedisposal to shopjob;
revoke update,delete,truncate on audit.archivedisposal from shopapp,shopjob;
create trigger immutable before update or delete on audit.archivedisposal for each row execute function audit.reject_mutation();

select runtime.record_migration_evidence('20260904032800',(select count(*) from audit.archiveref),(select count(*) from audit.archiveref),0,0,
  'create index concurrently if not exists audit_archive_expiry_live on audit.archiveref(expires_at,id);',
  'select archive_id,count(*) from audit.archivedisposal group by archive_id having count(*)>1; select id from audit.archiveref where bundle_version=2 and locked_until<expires_at;');
insert into runtime.schemaversion(version,checksum)
values('20260904032800',encode(public.digest('20260904032800_seal_audit_archives','sha256'),'hex'));

commit;
