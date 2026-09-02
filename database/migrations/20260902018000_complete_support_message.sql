begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902017000') then
    raise exception 'SUPPORT_MESSAGE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902018000') then
    raise exception 'SUPPORT_MESSAGE_ALREADY_APPLIED';
  end if;
end
$precondition$;

alter table support.message add column client_message_id text;
alter table support.message add column sequence bigint;
alter table support.message add column version bigint not null default 1;

with sequenced as(
  select id,row_number() over(partition by conversation_id order by created_at,id) message_sequence
  from support.message
)
update support.message target
set client_message_id=target.id,sequence=sequenced.message_sequence
from sequenced where sequenced.id=target.id;

update support.message set author_type='agent',author_id=coalesce(author_id,'system') where author_type='system' or author_id is null;
alter table support.message drop constraint message_author_type_check;
alter table support.message add constraint support_message_author_type check(author_type in('member','agent'));
alter table support.message alter column author_id set not null;

alter table support.message alter column client_message_id set not null;
alter table support.message alter column sequence set not null;
alter table support.message add constraint support_message_sequence_positive check(sequence>0);
alter table support.message add constraint support_message_version_positive check(version>0);
alter table support.message add constraint support_message_conversation_sequence_unique unique(conversation_id,sequence);
alter table support.message add constraint support_message_client_unique unique(conversation_id,author_id,client_message_id);

alter table support.conversation add column latest_sequence bigint not null default 0;
update support.conversation conversation set latest_sequence=source.latest_sequence
from(select conversation_id,max(sequence) latest_sequence from support.message group by conversation_id) source
where source.conversation_id=conversation.id;
alter table support.conversation add constraint support_conversation_sequence_nonnegative check(latest_sequence>=0);

alter table support.agent add column version bigint not null default 1;
alter table support.agent add column created_at timestamptz not null default clock_timestamp();
alter table support.agent add column updated_at timestamptz not null default clock_timestamp();
alter table support.agent add column last_assigned_at timestamptz;
alter table support.agent add constraint support_agent_version_positive check(version>0);

alter table support.evidence add column original_name text;
alter table support.evidence add column content_type text;
alter table support.evidence add column upload_expires_at timestamptz;
alter table support.evidence add column uploaded_at timestamptz;
alter table support.evidence add column scanned_at timestamptz;
alter table support.evidence add column scan_reason text;
alter table support.evidence add column version bigint not null default 1;
update support.evidence set original_name=id,content_type=kind,upload_expires_at=created_at,
  uploaded_at=case when state in('clean','rejected') then created_at end,
  scanned_at=case when state in('clean','rejected') then created_at end;
alter table support.evidence alter column original_name set not null;
alter table support.evidence alter column content_type set not null;
alter table support.evidence alter column upload_expires_at set not null;
alter table support.evidence add constraint support_evidence_version_positive check(version>0);
alter table support.evidence add constraint support_evidence_name_safe check(length(original_name) between 1 and 255 and original_name!~'[[:cntrl:]/\\]');
alter table support.evidence add constraint support_evidence_content_type_allowed check(content_type in('image/jpeg','image/png','application/pdf','text/plain'));

create table support.messageevidence(
  message_id text not null references support.message(id),
  evidence_id text not null references support.evidence(id),
  primary key(message_id,evidence_id),
  unique(evidence_id)
);

create function support.enforce_evidence_transition() returns trigger language plpgsql
set search_path=support,pg_temp as $function$
begin
  if old.state<>'pending' and new.state<>old.state then raise exception 'SUPPORT_EVIDENCE_STATE_FINAL'; end if;
  if old.state='pending' and new.state not in('pending','clean','rejected') then raise exception 'SUPPORT_EVIDENCE_TRANSITION_INVALID'; end if;
  return new;
end
$function$;
revoke all on function support.enforce_evidence_transition() from public,shopapp,shopjob;
create trigger support_evidence_transition before update on support.evidence for each row execute function support.enforce_evidence_transition();

drop index if exists support.support_message_conversation_time;
drop index if exists support.support_history_ticket_sequence;
create index support_ticket_queue on support.ticket(scope_id,state,priority,updated_at desc,id desc);
create index support_ticket_agent_queue on support.ticket(assigned_agent_id,state,updated_at desc,id desc);
create index support_conversation_queue on support.conversation(scope_id,updated_at desc,id desc);
create index support_message_sequence on support.message(conversation_id,sequence desc);
create index support_history_sequence on support.history(ticket_id,sequence desc);
create index support_agent_scope_state on support.agent(scope_id,state);
create index support_agent_scope_membership on support.agent(scope_id,membership_id);

alter table support.messageevidence enable row level security;
create policy appscope on support.messageevidence for all to shopapp using(
  exists(select 1 from support.message message where message.id=message_id and access.scope_allowed(message.scope_id))
) with check(
  exists(select 1 from support.message message where message.id=message_id and access.scope_allowed(message.scope_id))
  and exists(select 1 from support.evidence evidence where evidence.id=evidence_id and access.scope_allowed(evidence.scope_id))
);
create policy jobscope on support.messageevidence for all to shopjob using(true) with check(true);
grant select,insert on support.messageevidence to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260902018000',4,4,0,0,
  'create index concurrently if not exists support_ticket_queue_live on support.ticket(scope_id,state,priority,updated_at desc,id desc);',
  'select conversation_id,count(*),min(sequence),max(sequence) from support.message group by conversation_id order by conversation_id;'
);
insert into runtime.schemaversion(version,checksum)
values('20260902018000',encode(public.digest('20260902018000_complete_support_message','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from support.message where client_message_id is null or sequence is null or version<1) then
    raise exception 'SUPPORT_MESSAGE_BACKFILL_INCOMPLETE';
  end if;
  if exists(select 1 from support.message group by conversation_id,sequence having count(*)>1) then
    raise exception 'SUPPORT_MESSAGE_SEQUENCE_DUPLICATE';
  end if;
  if exists(select 1 from support.message group by conversation_id,author_id,client_message_id having count(*)>1) then
    raise exception 'SUPPORT_MESSAGE_CLIENT_ID_DUPLICATE';
  end if;
end
$assert$;

commit;
