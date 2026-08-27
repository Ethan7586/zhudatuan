begin;

create table support.conversation(
  id text primary key,
  scope_id text not null,
  member_id text,
  order_id text,
  channel text not null check(channel in('inapp','wechat','email','sms')),
  subject text not null,
  reference_type text check(reference_type in('benefitlot')),
  reference_id text,
  reference_evidence jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0,
  check((reference_type is null and reference_id is null and reference_evidence is null)
    or(reference_type is not null and reference_id is not null and jsonb_typeof(reference_evidence)='object'))
);

alter table support.case rename to ticket;
alter table support.ticket add column conversation_id text;
alter table support.ticket add column skill text not null default 'general';
insert into support.conversation(id,scope_id,member_id,order_id,channel,subject,reference_type,reference_id,reference_evidence,
  created_at,updated_at,version) select 'conversation:'||id,scope_id,member_id,order_id,channel,subject,reference_type,reference_id,
  reference_evidence,created_at,updated_at,version from support.ticket;
update support.ticket set conversation_id='conversation:'||id;
alter table support.ticket alter column conversation_id set not null;
alter table support.ticket add constraint ticket_conversation_fkey foreign key(conversation_id) references support.conversation(id);
alter table support.ticket add constraint ticket_conversation_key unique(conversation_id);
alter table support.ticket alter column skill drop default;

alter table support.message add column scope_id text;
alter table support.message add column conversation_id text;
update support.message message set scope_id=ticket.scope_id,conversation_id=ticket.conversation_id
  from support.ticket ticket where ticket.id=message.case_id;
alter table support.message alter column scope_id set not null;
alter table support.message alter column conversation_id set not null;
alter table support.message add constraint message_conversation_fkey foreign key(conversation_id) references support.conversation(id);
alter table support.message drop column case_id cascade;

alter table support.caseevent rename to history;
alter table support.history rename column case_id to ticket_id;
alter table support.history add column scope_id text;
update support.history history set scope_id=ticket.scope_id from support.ticket ticket where ticket.id=history.ticket_id;
alter table support.history alter column scope_id set not null;

alter table support.assignment rename column case_id to ticket_id;
alter table support.assignment add column scope_id text;
update support.assignment assignment set scope_id=ticket.scope_id from support.ticket ticket where ticket.id=assignment.ticket_id;
alter table support.assignment alter column scope_id set not null;

alter table support.evidence add column scope_id text;
alter table support.evidence add column conversation_id text;
update support.evidence evidence set scope_id=ticket.scope_id,conversation_id=ticket.conversation_id
  from support.ticket ticket where ticket.id=evidence.case_id;
alter table support.evidence alter column scope_id set not null;
alter table support.evidence alter column conversation_id set not null;
alter table support.evidence add constraint evidence_conversation_fkey foreign key(conversation_id) references support.conversation(id);
alter table support.evidence drop column case_id;

alter table support.escalation rename column case_id to ticket_id;
alter table support.escalation add column scope_id text;
update support.escalation escalation set scope_id=ticket.scope_id from support.ticket ticket where ticket.id=escalation.ticket_id;
alter table support.escalation alter column scope_id set not null;

alter table support.ticket drop column member_id;
alter table support.ticket drop column order_id;
alter table support.ticket drop column channel;
alter table support.ticket drop column subject;
alter table support.ticket drop column reference_type;
alter table support.ticket drop column reference_id;
alter table support.ticket drop column reference_evidence;

create table support.assignmentrule(
  id text primary key,
  scope_id text not null,
  name text not null,
  skill text not null,
  priorities text[] not null check(cardinality(priorities)>0),
  weight integer not null check(weight between 1 and 1000),
  state text not null check(state in('active','disabled')),
  version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,name)
);

create index support_conversation_scope_time on support.conversation(scope_id,updated_at desc,id desc);
create index support_ticket_scope_time on support.ticket(scope_id,updated_at desc,id desc);
create index support_message_conversation_time on support.message(conversation_id,created_at,id);
create index support_history_ticket_sequence on support.history(ticket_id,sequence);
create unique index support_assignment_active on support.assignment(ticket_id) where released_at is null;
drop index support.support_escalation_once;
create unique index support_escalation_once on support.escalation(ticket_id,reason);

alter table support.conversation enable row level security;
alter table support.assignmentrule enable row level security;
create policy appscope on support.conversation for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on support.conversation for all to shopjob using(true) with check(true);
create policy appscope on support.assignmentrule for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on support.assignmentrule for all to shopjob using(true) with check(true);
grant select,insert,update,delete on support.conversation,support.assignmentrule to shopapp,shopjob;

drop policy appscope on support.message;
drop policy appscope on support.history;
drop policy appscope on support.assignment;
drop policy appscope on support.evidence;
drop policy appscope on support.escalation;
create policy appscope on support.message for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy appscope on support.history for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy appscope on support.assignment for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy appscope on support.evidence for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy appscope on support.escalation for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));

create or replace function support.reject_mutation() returns trigger language plpgsql volatile
set search_path=support,pg_temp as $function$ begin raise exception 'SUPPORT_APPEND_ONLY'; end $function$;
create trigger support_message_immutable before update or delete on support.message for each row execute function support.reject_mutation();
create trigger support_history_immutable before update or delete on support.history for each row execute function support.reject_mutation();

create or replace function support.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=support,pg_temp as $function$
  select coalesce(
    (select scope_id from support.ticket where id=p_resource),
    (select scope_id from support.conversation where id=p_resource),
    (select scope_id from support.agent where id=p_resource),
    (select scope_id from support.account where id=p_resource),
    (select scope_id from support.assignmentrule where id=p_resource),
    (select scope_id from support.sla where id=p_resource),
    (select scope_id from support.assignment where id=p_resource),
    (select scope_id from support.evidence where id=p_resource),
    (select scope_id from support.escalation where id=p_resource)
  )
$function$;
revoke all on function support.resource_scope(text) from public;

do $rewrite$ declare definition text; replaced text; begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  replaced:=replace(definition,'select scope_id into resolved from support.case where id=p_resource',
    'select support.resource_scope(p_resource) into resolved');
  if replaced=definition then raise exception 'ACCESS_RESOURCE_SCOPE_SUPPORT_REWRITE_FAILED'; end if;
  execute replaced;
end $rewrite$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('support.agents.read','support','GET','/api/v1/support/agents','1.0.0'),
  ('support.accounts.read','support','GET','/api/v1/support/accounts','1.0.0'),
  ('support.rules.read','support','GET','/api/v1/support/rules','1.0.0'),
  ('support.rules.manage','support','PUT','/api/v1/support/rules/{ruleid}','1.0.0'),
  ('support.slas.read','support','GET','/api/v1/support/slas','1.0.0'),
  ('support.slas.manage','support','PUT','/api/v1/support/slas/{slaid}','1.0.0');
insert into runtime.event(type,version,owner,schema_ref) values
  ('support.ticket.assigned',1,'support','contract://events/support.ticket.assigned/v1');
insert into access.permission(id,code,risk,status) values
  ('permission:6b0945d25d1f344933b5c011','support.agent.read','high','active'),
  ('permission:f4c09b705af3e93ee9d7a30d','support.account.read','high','active'),
  ('permission:71cb7ab5cbea93dc2b2bb76c','support.rule.read','high','active'),
  ('permission:d6c5f1f2044432f2f704dc87','support.rule.manage','critical','active'),
  ('permission:a9ff1c6b9b0d3c504e83e206','support.sla.read','high','active'),
  ('permission:f3d09934ff2ae8602e244541','support.sla.manage','critical','active');
insert into capability.capability(id,kind,name,version,status) values
  ('support.agents.read','operation','support.agents.read',1,'active'),
  ('support.accounts.read','operation','support.accounts.read',1,'active'),
  ('support.rules.read','operation','support.rules.read',1,'active'),
  ('support.rules.manage','operation','support.rules.manage',1,'active'),
  ('support.slas.read','operation','support.slas.read',1,'active'),
  ('support.slas.manage','operation','support.slas.manage',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('support.agents.read','support.agents.read','support.agent.read','operator'),
  ('support.accounts.read','support.accounts.read','support.account.read','operator'),
  ('support.rules.read','support.rules.read','support.rule.read','operator'),
  ('support.rules.manage','support.rules.manage','support.rule.manage','operator'),
  ('support.slas.read','support.slas.read','support.sla.read','operator'),
  ('support.slas.manage','support.slas.manage','support.sla.manage','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:support.agents.read','organization-platform-root','support.agents.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:support.accounts.read','organization-platform-root','support.accounts.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:support.rules.read','organization-platform-root','support.rules.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:support.rules.manage','organization-platform-root','support.rules.manage','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:support.slas.read','organization-platform-root','support.slas.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:support.slas.manage','organization-platform-root','support.slas.manage','enabled',null,'1970-01-01T00:00:00Z',null,0);

insert into runtime.schemaversion(version,checksum) values('20260821046000','e83c85940d3a34311df2ee7db1e381620fab449f0a67d44b219fb47e260da03f');

do $assert$ begin
  if (select count(*) from runtime.operation)<>195 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from pg_proc where oid='access.resource_scope(text,text,text)'::regprocedure and prosrc like '%from support.case %') then
    raise exception 'LEGACY_SUPPORT_CASE_REFERENCE_REMAINS';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821046000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
