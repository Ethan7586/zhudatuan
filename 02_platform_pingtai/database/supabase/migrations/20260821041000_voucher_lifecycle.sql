begin;

alter table voucher.voucher drop constraint voucher_state_check;
alter table voucher.voucher add constraint voucher_state_check
  check(state in('created','active','bound','reserved','disabled','redeemed','expired','void'));
alter table voucher.cardpool add column mode text not null default 'generated' check(mode in('generated','imported'));
create table voucher.programversion(
  program_id text not null references voucher.program(id),
  version bigint not null check(version>=0),
  value_minor bigint not null check(value_minor>0),
  default_valid_days integer not null check(default_valid_days between 1 and 3650),
  approval_required boolean not null,
  status text not null check(status in('draft','active','paused','retired')),
  changed_by text not null,
  changed_at timestamptz not null,
  primary key(program_id,version)
);
insert into voucher.programversion(program_id,version,value_minor,default_valid_days,approval_required,status,changed_by,changed_at)
select id,version,value_minor,default_valid_days,approval_required,status,'migration',clock_timestamp() from voucher.program;
alter table voucher.reserverequest add column program_version bigint;
update voucher.reserverequest request set program_version=program.version from voucher.program program where program.id=request.program_id;
alter table voucher.reserverequest alter column program_version set not null;
alter table voucher.reserverequest add foreign key(program_id,program_version) references voucher.programversion(program_id,version);
create table voucher.importjob(
  id text primary key,
  cardpool_id text not null unique references voucher.cardpool(id),
  scope_id text not null,
  object_ref text not null,
  sha256 char(64) not null check(sha256~'^[a-f0-9]{64}$'),
  state text not null check(state in('uploaded','validating','running','completed','failed')),
  total_count integer not null check(total_count>=0),
  success_count integer not null check(success_count>=0),
  failure_count integer not null check(failure_count>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table voucher.importerror(
  job_id text not null references voucher.importjob(id) on delete cascade,
  row_number integer not null check(row_number>1),
  reason_code text not null,
  detail text not null,
  primary key(job_id,row_number)
);
create table voucher.card(
  id text primary key,
  cardpool_id text not null references voucher.cardpool(id),
  code_ciphertext text not null,
  code_fingerprint char(64) not null unique check(code_fingerprint~'^[a-f0-9]{64}$'),
  code_key_version text not null,
  state text not null check(state in('available','allocated','void')),
  allocated_batch_id text references voucher.issuebatch(id),
  version bigint not null default 0,
  check((state='allocated')=(allocated_batch_id is not null))
);
create table voucher.allocation(
  id text primary key,
  cardpool_id text not null references voucher.cardpool(id),
  scope_id text not null,
  quantity integer not null check(quantity>0),
  used_count integer not null default 0 check(used_count>=0 and used_count<=quantity),
  version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(cardpool_id,scope_id)
);
alter table voucher.issuebatch add column reserve_request_id text references voucher.reserverequest(id);
alter table voucher.issuebatch add column program_version bigint;
update voucher.issuebatch batch set program_version=program.version from voucher.program program where program.id=batch.program_id;
alter table voucher.issuebatch alter column program_version set not null;
alter table voucher.issuebatch add foreign key(program_id,program_version) references voucher.programversion(program_id,version);
create unique index voucher_issuebatch_reserve on voucher.issuebatch(reserve_request_id) where reserve_request_id is not null;
alter table voucher.voucher add column card_id text unique references voucher.card(id);
alter table voucher.voucher add column program_version bigint;
update voucher.voucher target set program_version=batch.program_version from voucher.issuebatch batch where batch.id=target.batch_id;
alter table voucher.voucher alter column program_version set not null;
alter table voucher.voucher add foreign key(program_id,program_version) references voucher.programversion(program_id,version);
create table voucher.statusbatch(
  id text primary key,
  scope_id text not null,
  action text not null check(action in('activate','disable','extend','void')),
  expires_at timestamptz,
  reason text not null,
  actor_id text not null,
  state text not null check(state in('queued','running','completed','failed')),
  requested_count integer not null check(requested_count>0),
  succeeded_count integer not null default 0 check(succeeded_count>=0),
  failed_count integer not null default 0 check(failed_count>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check((action='extend')=(expires_at is not null))
);
create table voucher.statusitem(
  batch_id text not null references voucher.statusbatch(id),
  voucher_id text not null,
  state text not null check(state in('queued','succeeded','failed')),
  previous_state text,
  next_state text,
  error_code text,
  updated_at timestamptz not null,
  primary key(batch_id,voucher_id),
  check((state='failed')=(error_code is not null))
);

alter table voucher.importjob enable row level security;
alter table voucher.importerror enable row level security;
alter table voucher.card enable row level security;
alter table voucher.allocation enable row level security;
alter table voucher.programversion enable row level security;
alter table voucher.statusbatch enable row level security;
alter table voucher.statusitem enable row level security;
create policy appscope on voucher.importjob for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on voucher.importjob for all to shopjob using(true) with check(true);
create policy appscope on voucher.importerror for all to shopapp
  using(exists(select 1 from voucher.importjob job where job.id=job_id and access.scope_allowed(job.scope_id)))
  with check(exists(select 1 from voucher.importjob job where job.id=job_id and access.scope_allowed(job.scope_id)));
create policy jobscope on voucher.importerror for all to shopjob using(true) with check(true);
create policy appscope on voucher.card for all to shopapp
  using(exists(select 1 from voucher.cardpool pool where pool.id=cardpool_id and access.scope_allowed(pool.scope_id)))
  with check(exists(select 1 from voucher.cardpool pool where pool.id=cardpool_id and access.scope_allowed(pool.scope_id)));
create policy jobscope on voucher.card for all to shopjob using(true) with check(true);
create policy appscope on voucher.allocation for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on voucher.allocation for all to shopjob using(true) with check(true);
create policy appscope on voucher.programversion for all to shopapp
  using(exists(select 1 from voucher.program program where program.id=program_id and access.scope_allowed(program.scope_id)))
  with check(exists(select 1 from voucher.program program where program.id=program_id and access.scope_allowed(program.scope_id)));
create policy jobscope on voucher.programversion for all to shopjob using(true) with check(true);
create policy appscope on voucher.statusbatch for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on voucher.statusbatch for all to shopjob using(true) with check(true);
create policy appscope on voucher.statusitem for all to shopapp
  using(exists(select 1 from voucher.statusbatch batch where batch.id=batch_id and access.scope_allowed(batch.scope_id)))
  with check(exists(select 1 from voucher.statusbatch batch where batch.id=batch_id and access.scope_allowed(batch.scope_id)));
create policy jobscope on voucher.statusitem for all to shopjob using(true) with check(true);
create policy allocatedscope on voucher.cardpool for select to shopapp
  using(exists(select 1 from voucher.allocation allocation where allocation.cardpool_id=voucher.cardpool.id and access.scope_allowed(allocation.scope_id)));
create policy allocatedscope on voucher.card for select to shopapp
  using(exists(select 1 from voucher.allocation allocation where allocation.cardpool_id=voucher.card.cardpool_id and access.scope_allowed(allocation.scope_id)));
grant select,insert,update,delete on voucher.importjob,voucher.importerror,voucher.card,voucher.allocation,voucher.programversion,
  voucher.statusbatch,voucher.statusitem to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('voucher.cardlibraries.read','voucher','GET','/api/v1/vouchers/cardlibraries','1.0.0'),
  ('voucher.programs.read','voucher','GET','/api/v1/vouchers/programs','1.0.0'),
  ('voucher.reserves.read','voucher','GET','/api/v1/vouchers/reserves','1.0.0'),
  ('voucher.batches.read','voucher','GET','/api/v1/vouchers/batches','1.0.0'),
  ('voucher.batches.retry','voucher','POST','/api/v1/vouchers/batches/{batchid}/retry','1.0.0'),
  ('voucher.statusbatches.read','voucher','GET','/api/v1/vouchers/statusbatches','1.0.0'),
  ('voucher.history.read','voucher','GET','/api/v1/vouchers/history','1.0.0'),
  ('voucher.bindings.manage','voucher','PUT','/api/v1/vouchers/{voucherid}/binding','1.0.0');

insert into access.permission(id,code,risk,status) values
  ('permission:bcca538117c3f41a06e5efd4','voucher.batch.read','high','active'),
  ('permission:385f8c9c595f5f107491d3b9','voucher.binding.manage','high','active'),
  ('permission:75463c6cd4e43e66f46468ff','voucher.cardlibrary.read','low','active'),
  ('permission:c082aed100574339586113d0','voucher.history.read','high','active'),
  ('permission:3fbc8b1aaf3838575dd80e17','voucher.program.read','low','active'),
  ('permission:22d08872566a63ba3e1db761','voucher.reserve.read','high','active');

insert into capability.capability(id,kind,name,version,status) values
  ('voucher.cardlibraries.read','operation','voucher.cardlibraries.read',1,'active'),
  ('voucher.programs.read','operation','voucher.programs.read',1,'active'),
  ('voucher.reserves.read','operation','voucher.reserves.read',1,'active'),
  ('voucher.batches.read','operation','voucher.batches.read',1,'active'),
  ('voucher.batches.retry','operation','voucher.batches.retry',1,'active'),
  ('voucher.statusbatches.read','operation','voucher.statusbatches.read',1,'active'),
  ('voucher.history.read','operation','voucher.history.read',1,'active'),
  ('voucher.bindings.manage','operation','voucher.bindings.manage',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('voucher.cardlibraries.read','voucher.cardlibraries.read','voucher.cardlibrary.read','operator'),
  ('voucher.programs.read','voucher.programs.read','voucher.program.read','operator'),
  ('voucher.reserves.read','voucher.reserves.read','voucher.reserve.read','operator'),
  ('voucher.batches.read','voucher.batches.read','voucher.batch.read','operator'),
  ('voucher.batches.retry','voucher.batches.retry','voucher.issue','operator'),
  ('voucher.statusbatches.read','voucher.statusbatches.read','voucher.history.read','operator'),
  ('voucher.history.read','voucher.history.read','voucher.history.read','operator'),
  ('voucher.bindings.manage','voucher.bindings.manage','voucher.binding.manage','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in('voucher.cardlibraries.read','voucher.programs.read','voucher.reserves.read','voucher.batches.read','voucher.batches.retry','voucher.statusbatches.read','voucher.history.read','voucher.bindings.manage');

insert into runtime.event(type,version,owner,schema_ref) values
  ('voucher.issue.failed',1,'voucher','contract://events/voucher.issue.failed/v1'),
  ('voucher.import.failed',1,'voucher','contract://events/voucher.import.failed/v1'),
  ('voucher.status.failed',1,'voucher','contract://events/voucher.status.failed/v1');

create index voucher_cardpool_scope_read on voucher.cardpool(scope_id,id);
create index voucher_card_available on voucher.card(cardpool_id,state,id);
create index voucher_allocation_scope on voucher.allocation(scope_id,cardpool_id);
create index voucher_program_scope_read on voucher.program(scope_id,id);
create index voucher_statusbatch_scope_read on voucher.statusbatch(scope_id,created_at desc,id desc);
create index voucher_statusitem_work on voucher.statusitem(batch_id,state,voucher_id);
create index voucher_reserverequest_scope_read on voucher.reserverequest(scope_id,created_at desc,id desc);
create index voucher_issuebatch_read on voucher.issuebatch(created_at desc,id desc);
create index voucher_statusevent_read on voucher.statusevent(occurred_at desc,voucher_id desc,sequence desc);

insert into runtime.schemaversion(version,checksum)
values('20260821041000','3bbfe0770bba1cc4e9097026c008408951a5dc66d38f2380511beeb5aecfd087');

do $assert$
begin
  if (select count(*) from runtime.operation)<>164 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='voucher' and table_name='issuebatch' and column_name='reserve_request_id')
    then raise exception 'VOUCHER_APPROVAL_LINK_MISSING'; end if;
  if not exists(select 1 from information_schema.tables where table_schema='voucher' and table_name='allocation')
    then raise exception 'VOUCHER_ALLOCATION_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821041000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
