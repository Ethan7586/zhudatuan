begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902018000') then
    raise exception 'SUPPORT_REALTIME_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902019000') then
    raise exception 'SUPPORT_REALTIME_ALREADY_APPLIED';
  end if;
end
$precondition$;

create table support.readstate(
  conversation_id text not null references support.conversation(id),
  membership_id text not null,
  last_sequence bigint not null check(last_sequence>=0),
  updated_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(conversation_id,membership_id)
);
create index support_readstate_conversation_membership on support.readstate(conversation_id,membership_id);

alter table runtime.outbox add column realtime_claimed_by text;
alter table runtime.outbox add column realtime_claim_until timestamptz;
alter table runtime.outbox add column realtime_attempts integer not null default 0 check(realtime_attempts>=0);
alter table runtime.outbox add column realtime_published_at timestamptz;
alter table runtime.outbox add column realtime_cursor text;
alter table runtime.outbox add column realtime_error text;
alter table runtime.outbox add constraint runtime_outbox_realtime_cursor_shape check(realtime_cursor is null or realtime_cursor~'^[0-9]+-[0-9]+$');
create index runtime_outbox_realtime_delivery on runtime.outbox(occurred_at,id)
where event_type like 'support.%' and realtime_published_at is null;

create function support.current_member() returns text language sql stable security definer
set search_path=access,pg_temp set row_security=off as $function$
  select membership.member_id from access.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
$function$;
revoke all on function support.current_member() from public;
grant execute on function support.current_member() to shopapp;

create function support.current_client() returns text language sql stable security definer
set search_path=access,pg_temp set row_security=off as $function$
  select membership.client from access.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
$function$;
revoke all on function support.current_client() from public;
grant execute on function support.current_client() to shopapp;

create function support.can_access_conversation(p_conversation text) returns boolean language sql stable security definer
set search_path=support,access,pg_temp set row_security=off as $function$
  select coalesce((
    select case when support.current_client()='storefront' then conversation.member_id=support.current_member()
      else access.scope_allowed(conversation.scope_id) end
    from support.conversation conversation where conversation.id=p_conversation
  ),false)
$function$;
revoke all on function support.can_access_conversation(text) from public;
grant execute on function support.can_access_conversation(text) to shopapp;

create function support.can_manage_scope(p_scope text) returns boolean language sql stable security definer
set search_path=support,access,pg_temp set row_security=off as $function$
  select coalesce(support.current_client()<>'storefront' and access.scope_allowed(p_scope),false)
$function$;
revoke all on function support.can_manage_scope(text) from public;
grant execute on function support.can_manage_scope(text) to shopapp;

drop policy appscope on support.conversation;
drop policy appscope on support.ticket;
drop policy appscope on support.message;
drop policy appscope on support.history;
drop policy appscope on support.assignment;
drop policy appscope on support.agent;
drop policy appscope on support.account;
drop policy appscope on support.sla;
drop policy appscope on support.assignmentrule;
drop policy appscope on support.evidence;
drop policy appscope on support.escalation;
drop policy appscope on support.messageevidence;

create policy supportconversationapi on support.conversation for all to shopapp
using(support.can_access_conversation(id))
with check(case when support.current_client()='storefront' then member_id=support.current_member() else access.scope_allowed(scope_id) end);
create policy supportticketapi on support.ticket for all to shopapp
using(support.can_access_conversation(conversation_id)) with check(support.can_access_conversation(conversation_id));
create policy supportmessageapi on support.message for all to shopapp
using(support.can_access_conversation(conversation_id)) with check(support.can_access_conversation(conversation_id));
create policy supporthistoryapi on support.history for all to shopapp
using(exists(select 1 from support.ticket ticket where ticket.id=ticket_id and support.can_access_conversation(ticket.conversation_id)))
with check(exists(select 1 from support.ticket ticket where ticket.id=ticket_id and support.can_access_conversation(ticket.conversation_id)));
create policy supportassignmentapi on support.assignment for all to shopapp
using(support.can_manage_scope(scope_id)) with check(support.can_manage_scope(scope_id));
create policy supportagentapi on support.agent for all to shopapp
using(support.can_manage_scope(scope_id)) with check(support.can_manage_scope(scope_id));
create policy supportaccountapi on support.account for all to shopapp
using(support.can_manage_scope(scope_id)) with check(support.can_manage_scope(scope_id));
create policy supportslaapi on support.sla for all to shopapp
using(support.can_manage_scope(scope_id)) with check(support.can_manage_scope(scope_id));
create policy supportruleapi on support.assignmentrule for all to shopapp
using(support.can_manage_scope(scope_id)) with check(support.can_manage_scope(scope_id));
create policy supportevidenceapi on support.evidence for all to shopapp
using(support.can_access_conversation(conversation_id)) with check(support.can_access_conversation(conversation_id));
create policy supportescalationapi on support.escalation for all to shopapp
using(support.can_manage_scope(scope_id)) with check(support.can_manage_scope(scope_id));
create policy supportmessageevidenceapi on support.messageevidence for all to shopapp
using(exists(select 1 from support.message message where message.id=message_id and support.can_access_conversation(message.conversation_id)))
with check(
  exists(select 1 from support.message message where message.id=message_id and support.can_access_conversation(message.conversation_id))
  and exists(select 1 from support.evidence evidence where evidence.id=evidence_id and support.can_access_conversation(evidence.conversation_id))
);

alter table support.readstate enable row level security;
create policy readstateapi on support.readstate for all to shopapp using(
  current_setting('app.workload',true)='api' and membership_id=nullif(current_setting('app.membership_id',true),'')
  and exists(select 1 from support.conversation conversation where conversation.id=conversation_id and (
    case when support.current_client()='storefront' then conversation.member_id=support.current_member() else access.scope_allowed(conversation.scope_id) end
  ))
) with check(
  current_setting('app.workload',true)='api' and membership_id=nullif(current_setting('app.membership_id',true),'')
  and exists(select 1 from support.conversation conversation where conversation.id=conversation_id and (
    case when support.current_client()='storefront' then conversation.member_id=support.current_member() else access.scope_allowed(conversation.scope_id) end
  ))
);
create policy readstatejob on support.readstate for all to shopjob using(true) with check(true);
grant select,insert,update on support.readstate to shopapp,shopjob;

create or replace function support.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=support,pg_temp as $function$
  select coalesce(
    (select scope_id from support.ticket where id=p_resource),
    (select scope_id from support.conversation where id=p_resource),
    (select conversation.scope_id from support.readstate state join support.conversation conversation on conversation.id=state.conversation_id where state.conversation_id=p_resource),
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

select runtime.record_migration_evidence(
  '20260902019000',2,2,0,0,
  'create index concurrently if not exists runtime_outbox_realtime_delivery_live on runtime.outbox(occurred_at,id) where event_type like ''support.%'' and realtime_published_at is null;',
  'select count(*) from runtime.outbox where event_type like ''support.%'' and realtime_published_at is null;'
);
insert into runtime.schemaversion(version,checksum)
values('20260902019000',encode(public.digest('20260902019000_complete_support_realtime','sha256'),'hex'));

commit;
