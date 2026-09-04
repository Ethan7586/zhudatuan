begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904011000') then raise exception 'APPROVAL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904012000') or to_regclass('approval.templates') is not null then
    raise exception 'APPROVAL_ALREADY_APPLIED';
  end if;
end
$precondition$;

create table approval.templates(
  id text primary key check(id~'^approvaltemplate:'),
  tenant_id text not null,
  scope_id text not null,
  code text not null check(code~'^[a-z][a-z0-9.]{2,63}$'),
  name text not null check(length(name) between 2 and 120),
  subject_kind text not null check(subject_kind in('voucherstock','voucherissue','financerepair','withdrawal','refund','experiencepublish','riskexception')),
  state text not null check(state in('draft','enabled','disabled')),
  active_version integer check(active_version>0),
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,code),
  check(state<>'enabled' or active_version is not null),
  check(updated_at>=created_at)
);

create unique index approval_template_enabled_subject on approval.templates(scope_id,subject_kind) where state='enabled';
create index approval_template_scope_page on approval.templates(scope_id,id) include(code,name,subject_kind,state,active_version,version,updated_at);

create table approval.template_versions(
  id text primary key check(id~'^approvaltemplateversion:'),
  tenant_id text not null,
  scope_id text not null,
  template_id text not null references approval.templates(id),
  number integer not null check(number>0),
  name text not null check(length(name) between 2 and 120),
  subject_kind text not null check(subject_kind in('voucherstock','voucherissue','financerepair','withdrawal','refund','experiencepublish','riskexception')),
  steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps)>0),
  step_count integer generated always as(jsonb_array_length(steps)) stored,
  escalations jsonb not null default '[]'::jsonb check(jsonb_typeof(escalations)='array'),
  created_by text not null,
  created_at timestamptz not null,
  unique(template_id,number),
  unique(id,template_id,number),
  check(not jsonb_path_exists(escalations,'$[*] ? (@.afterHours < 1)')),
  check(jsonb_array_length(escalations)=0 or escalations->-1->>'action'='reject')
);

alter table approval.templates add constraint approval_template_active_version
foreign key(id,active_version) references approval.template_versions(template_id,number) deferrable initially deferred;

create table approval.instances(
  id text primary key check(id~'^approvalinstance:'),
  tenant_id text not null,
  scope_id text not null,
  template_id text not null,
  template_version integer not null check(template_version>0),
  subject_kind text not null check(subject_kind in('voucherstock','voucherissue','financerepair','withdrawal','refund','experiencepublish','riskexception')),
  subject_id text not null check(length(subject_id) between 3 and 255),
  subject_version bigint not null check(subject_version>=0),
  subject_snapshot jsonb not null check(jsonb_typeof(subject_snapshot)='object'),
  action text not null check(action~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
  evidence_hash char(64) not null check(evidence_hash~'^[0-9a-f]{64}$'),
  amount_minor bigint check(amount_minor>=0),
  currency char(3) check(currency~'^[A-Z]{3}$'),
  constraints jsonb not null check(jsonb_typeof(constraints)='object'),
  requester_id text not null,
  state text not null check(state in('pending','approved','rejected','cancelled','expired')),
  current_step integer not null check(current_step>0),
  decision_reason text check(decision_reason is null or length(decision_reason) between 2 and 500),
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  decided_at timestamptz,
  expires_at timestamptz,
  foreign key(template_id,template_version) references approval.template_versions(template_id,number),
  check((state='pending')=(decided_at is null)),
  check((amount_minor is null)=(currency is null)),
  check(expires_at is null or expires_at>created_at),
  check(updated_at>=created_at)
);

create unique index approval_instance_active_subject on approval.instances(scope_id,subject_kind,subject_id,subject_version,action) where state='pending';
create index approval_instance_scope_page on approval.instances(scope_id,id) include(subject_kind,subject_id,action,state,requester_id,version,created_at);
create index approval_instance_expiry on approval.instances(expires_at,id) include(scope_id,subject_kind,subject_id,version) where state='pending' and expires_at is not null;

create table approval.tasks(
  id text primary key check(id~'^approvaltask:'),
  tenant_id text not null,
  scope_id text not null,
  instance_id text not null references approval.instances(id),
  sequence integer not null check(sequence>0),
  name text not null check(length(name) between 2 and 120),
  assignee_kind text not null check(assignee_kind in('permission','role','membership')),
  assignee text not null check(length(assignee) between 2 and 255),
  state text not null check(state in('pending','approved','rejected','cancelled','expired','escalated')),
  due_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  reason text check(reason is null or length(reason) between 2 and 500),
  minimum_approvals integer not null check(minimum_approvals>0),
  approval_count integer not null check(approval_count between 0 and minimum_approvals),
  escalation_count integer not null default 0 check(escalation_count>=0),
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(instance_id,sequence,assignee_kind,assignee),
  check((state in('pending','escalated') and decided_at is null and decided_by is null)
    or (state in('approved','rejected') and decided_at is not null and decided_by is not null)
    or (state in('cancelled','expired') and decided_at is null and decided_by is null)),
  check(updated_at>=created_at)
);

create index approval_task_assignee_page on approval.tasks(scope_id,assignee_kind,assignee,state,id) include(instance_id,sequence,due_at,minimum_approvals,approval_count,version);
create index approval_task_due on approval.tasks(due_at,id) include(scope_id,instance_id,sequence,assignee_kind,assignee,version,escalation_count) where state in('pending','escalated');

create table approval.decisions(
  id text primary key check(id~'^approvaldecision:'),
  tenant_id text not null,
  scope_id text not null,
  instance_id text not null references approval.instances(id),
  task_id text not null references approval.tasks(id),
  outcome text not null check(outcome in('approved','rejected')),
  reason text not null check(length(reason) between 2 and 500),
  actor_id text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  proof_id text,
  decided_at timestamptz not null,
  unique(task_id,actor_id)
);

create index approval_decision_instance_time on approval.decisions(instance_id,decided_at,id) include(task_id,outcome,actor_id,proof_id);

create table approval.proofs(
  id text primary key check(id~'^approvalproof:'),
  tenant_id text not null,
  scope_id text not null,
  instance_id text not null unique references approval.instances(id),
  token_hash bytea not null unique check(octet_length(token_hash)=32),
  checker_id text not null,
  subject_kind text not null check(subject_kind in('voucherstock','voucherissue','financerepair','withdrawal','refund','experiencepublish','riskexception')),
  subject_id text not null,
  subject_version bigint not null check(subject_version>=0),
  action text not null check(action~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
  evidence_hash char(64) not null check(evidence_hash~'^[0-9a-f]{64}$'),
  amount_minor bigint check(amount_minor>=0),
  currency char(3) check(currency~'^[A-Z]{3}$'),
  constraints jsonb not null check(jsonb_typeof(constraints)='object'),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text,
  consumer_operation text,
  consumer_request_hash char(64) check(consumer_request_hash is null or consumer_request_hash~'^[0-9a-f]{64}$'),
  check(expires_at>issued_at),
  check((amount_minor is null)=(currency is null)),
  check((consumed_at is null and consumed_by is null and consumer_operation is null and consumer_request_hash is null)
    or (consumed_at is not null and consumed_by is not null and consumer_operation is not null and consumer_request_hash is not null))
);

alter table approval.decisions add constraint approval_decision_proof foreign key(proof_id) references approval.proofs(id) deferrable initially deferred;
create index approval_proof_expiry on approval.proofs(expires_at,id) include(scope_id,instance_id,subject_kind,subject_id,action) where consumed_at is null;

create function approval.guard_template_version()
returns trigger language plpgsql as $$
begin
  raise exception 'APPROVAL_TEMPLATE_VERSION_IMMUTABLE';
end
$$;

create trigger approval_template_version_immutable before update or delete on approval.template_versions
for each row execute function approval.guard_template_version();

create function approval.guard_decision()
returns trigger language plpgsql as $$
declare requester text; taskinstance text;
begin
  if tg_op<>'INSERT' then raise exception 'APPROVAL_DECISION_IMMUTABLE'; end if;
  select requester_id into requester from approval.instances where id=new.instance_id for key share;
  select instance_id into taskinstance from approval.tasks where id=new.task_id for key share;
  if requester is null or taskinstance is distinct from new.instance_id then raise exception 'APPROVAL_DECISION_SUBJECT_INVALID'; end if;
  if requester=new.actor_id then raise exception 'APPROVAL_SELF_DECISION_FORBIDDEN'; end if;
  return new;
end
$$;

create trigger approval_decision_guard before insert or update or delete on approval.decisions
for each row execute function approval.guard_decision();

create function approval.guard_instance_transition()
returns trigger language plpgsql as $$
begin
  if old.state<>'pending' and new.state<>old.state then raise exception 'APPROVAL_ALREADY_DECIDED'; end if;
  if new.template_id<>old.template_id or new.template_version<>old.template_version or new.subject_kind<>old.subject_kind
    or new.subject_id<>old.subject_id or new.subject_version<>old.subject_version or new.subject_snapshot<>old.subject_snapshot
    or new.action<>old.action or new.evidence_hash<>old.evidence_hash or new.constraints<>old.constraints or new.requester_id<>old.requester_id then
    raise exception 'APPROVAL_INSTANCE_BINDING_IMMUTABLE';
  end if;
  return new;
end
$$;

create trigger approval_instance_transition before update on approval.instances
for each row execute function approval.guard_instance_transition();

create function approval.guard_proof_update()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'APPROVAL_PROOF_IMMUTABLE'; end if;
  if old.consumed_at is not null then raise exception 'APPROVAL_PROOF_REPLAYED'; end if;
  if new.id<>old.id or new.instance_id<>old.instance_id or new.token_hash<>old.token_hash or new.scope_id<>old.scope_id
    or new.subject_kind<>old.subject_kind or new.subject_id<>old.subject_id or new.subject_version<>old.subject_version
    or new.action<>old.action or new.evidence_hash<>old.evidence_hash or new.amount_minor is distinct from old.amount_minor
    or new.currency is distinct from old.currency or new.constraints<>old.constraints
    or new.issued_at<>old.issued_at or new.expires_at<>old.expires_at or new.checker_id<>old.checker_id then
    raise exception 'APPROVAL_PROOF_BINDING_IMMUTABLE';
  end if;
  if new.consumed_at is null then raise exception 'APPROVAL_PROOF_CONSUMPTION_INVALID'; end if;
  return new;
end
$$;

create trigger approval_proof_update before update or delete on approval.proofs
for each row execute function approval.guard_proof_update();

do $security$
declare target text;
begin
  foreach target in array array['templates','template_versions','instances','tasks','decisions','proofs'] loop
    execute format('alter table approval.%I enable row level security',target);
    execute format('alter table approval.%I force row level security',target);
    execute format('create policy appscope on approval.%I for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id))',target);
    execute format('create policy jobscope on approval.%I for all to shopjob using(true) with check(true)',target);
    execute format('revoke all on table approval.%I from public',target);
  end loop;
end
$security$;

revoke all on function approval.guard_template_version(),approval.guard_decision(),approval.guard_instance_transition(),approval.guard_proof_update() from public;
grant usage on schema approval to shopapp,shopjob;
grant select,insert,update on approval.templates,approval.instances,approval.tasks,approval.proofs to shopapp,shopjob;
grant select,insert on approval.template_versions,approval.decisions to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('approval.templates.create','approval','POST','/api/v1/approvals/templates','5.0.0'),
  ('approval.templates.revise','approval','POST','/api/v1/approvals/templates/{templateid}/versions','5.0.0'),
  ('approval.templates.enable','approval','POST','/api/v1/approvals/templates/{templateid}/enablement','5.0.0'),
  ('approval.templates.disable','approval','DELETE','/api/v1/approvals/templates/{templateid}/enablement','5.0.0'),
  ('approval.templates.get','approval','GET','/api/v1/approvals/templates/{templateid}','5.0.0'),
  ('approval.templates.list','approval','GET','/api/v1/approvals/templates','5.0.0'),
  ('approval.tasks.list','approval','GET','/api/v1/approvals/tasks','5.0.0'),
  ('approval.tasks.approve','approval','POST','/api/v1/approvals/tasks/{taskid}/approval','5.0.0'),
  ('approval.tasks.reject','approval','POST','/api/v1/approvals/tasks/{taskid}/rejection','5.0.0'),
  ('approval.instances.get','approval','GET','/api/v1/approvals/instances/{instanceid}','5.0.0');

insert into access.permission(id,code,risk,status) values
  ('permission:approval.read','approval.read','high','active'),
  ('permission:approval.task.decide','approval.task.decide','critical','active'),
  ('permission:approval.template.manage','approval.template.manage','critical','active')
on conflict(code) do update set risk=excluded.risk,status='active';

insert into capability.capability(id,kind,name,version,status) values
  ('approval.templates.create','operation','approval.templates.create',1,'active'),
  ('approval.templates.revise','operation','approval.templates.revise',1,'active'),
  ('approval.templates.enable','operation','approval.templates.enable',1,'active'),
  ('approval.templates.disable','operation','approval.templates.disable',1,'active'),
  ('approval.templates.get','operation','approval.templates.get',1,'active'),
  ('approval.templates.list','operation','approval.templates.list',1,'active'),
  ('approval.tasks.list','operation','approval.tasks.list',1,'active'),
  ('approval.tasks.approve','operation','approval.tasks.approve',1,'active'),
  ('approval.tasks.reject','operation','approval.tasks.reject',1,'active'),
  ('approval.instances.get','operation','approval.instances.get',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('approval.templates.create','approval.templates.create','approval.template.manage','console'),
  ('approval.templates.revise','approval.templates.revise','approval.template.manage','console'),
  ('approval.templates.enable','approval.templates.enable','approval.template.manage','console'),
  ('approval.templates.disable','approval.templates.disable','approval.template.manage','console'),
  ('approval.templates.get','approval.templates.get','approval.read','console'),
  ('approval.templates.list','approval.templates.list','approval.read','console'),
  ('approval.tasks.list','approval.tasks.list','approval.read','console'),
  ('approval.tasks.approve','approval.tasks.approve','approval.task.decide','console'),
  ('approval.tasks.reject','approval.tasks.reject','approval.task.decide','console'),
  ('approval.instances.get','approval.instances.get','approval.read','console');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id like 'approval.%'
on conflict(scope_id,capability_id,effective_at) do update set state='enabled',expires_at=null,version=capability.entitlement.version+1;

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active'
  and permission.code in('approval.read','approval.task.decide','approval.template.manage')
on conflict do nothing;

insert into runtime.event(type,version,owner,schema_ref) values
  ('approval.template.created',1,'approval','contract://events/approval.template.created/v1'),
  ('approval.template.revised',1,'approval','contract://events/approval.template.revised/v1'),
  ('approval.template.statechanged',1,'approval','contract://events/approval.template.statechanged/v1'),
  ('approval.instance.created',1,'approval','contract://events/approval.instance.created/v1'),
  ('approval.instance.approved',1,'approval','contract://events/approval.instance.approved/v1'),
  ('approval.instance.rejected',1,'approval','contract://events/approval.instance.rejected/v1'),
  ('approval.instance.cancelled',1,'approval','contract://events/approval.instance.cancelled/v1'),
  ('approval.instance.expired',1,'approval','contract://events/approval.instance.expired/v1'),
  ('approval.task.assigned',1,'approval','contract://events/approval.task.assigned/v1'),
  ('approval.task.decided',1,'approval','contract://events/approval.task.decided/v1'),
  ('approval.task.escalated',1,'approval','contract://events/approval.task.escalated/v1');

select runtime.record_migration_evidence(
  '20260904012000',6,6,0,0,
  'select state,count(*) from approval.instances group by state; select state,count(*) from approval.tasks group by state;',
  'select count(*) pending from approval.instances where state=''pending''; select count(*) available_proofs from approval.proofs where consumed_at is null and expires_at>clock_timestamp();'
);

insert into runtime.schemaversion(version,checksum)
values('20260904012000',encode(public.digest('20260904012000_prepare_approval','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from information_schema.tables where table_schema='approval' and table_name in('templates','template_versions','instances','tasks','decisions','proofs'))<>6 then
    raise exception 'APPROVAL_TABLE_COUNT_INVALID';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='approval' and indexname='approval_template_enabled_subject') then
    raise exception 'APPROVAL_ACTIVE_TEMPLATE_CONSTRAINT_MISSING';
  end if;
  if not exists(select 1 from pg_trigger where tgname='approval_proof_update' and not tgisinternal) then
    raise exception 'APPROVAL_PROOF_GUARD_MISSING';
  end if;
  if (select count(*) from runtime.operation where owner='approval')<>10
    or (select count(*) from runtime.event where owner='approval')<>11 then
    raise exception 'APPROVAL_CONTRACT_CATALOG_INVALID';
  end if;
end
$assert$;

commit;
