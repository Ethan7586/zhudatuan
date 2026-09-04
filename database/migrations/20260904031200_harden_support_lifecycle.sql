begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031100') then raise exception 'SUPPORT_LIFECYCLE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031200') then raise exception 'SUPPORT_LIFECYCLE_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table support_lifecycle_before on commit drop as
select
  (select count(*) from support.ticket) tickets,
  (select count(*) from support.conversation) conversations,
  (select count(*) from support.assignmentrule) rules,
  (select count(*) from support.sla) slas;

alter table support.sla add column reopen_seconds integer;
update support.sla set reopen_seconds=604800;
alter table support.sla alter column reopen_seconds set not null;
alter table support.sla add constraint support_sla_reopen_positive check(reopen_seconds>0);

update support.assignmentrule set version=1 where version<1;
alter table support.assignmentrule alter column version set default 1;
alter table support.assignmentrule add constraint support_assignmentrule_version_positive check(version>0);

update support.ticket set version=1 where version<1;
alter table support.ticket alter column version set default 1;
alter table support.ticket add constraint support_ticket_version_positive check(version>0);
alter table support.ticket add column reopen_until timestamptz;
update support.ticket set reopen_until=updated_at+interval '7 days' where state='closed';
alter table support.ticket add constraint support_ticket_reopen_window check((state='closed')=(reopen_until is not null));

update support.conversation set version=1 where version<1;
alter table support.conversation alter column version set default 1;
alter table support.conversation add constraint support_conversation_version_positive check(version>0);

drop function support.resolve_sla(text,text);
create function support.resolve_sla(p_scope text,p_priority text)
returns table(response_seconds integer,resolution_seconds integer,reopen_seconds integer)
language sql
stable
security definer
set search_path=pg_catalog,pg_temp
as $function$
  select policy.response_seconds,policy.resolution_seconds,policy.reopen_seconds
  from organization.unitclosure closure
  join support.sla policy on policy.scope_id=closure.ancestor_id and policy.priority=p_priority
  where closure.descendant_id=p_scope
    and p_priority in('low','normal','high','urgent')
    and access.scope_allowed(p_scope)
  order by closure.depth,policy.version desc
  limit 1
$function$;
revoke all on function support.resolve_sla(text,text) from public,shopjob;
grant execute on function support.resolve_sla(text,text) to shopapp;

create function support.guard_ticket() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if tg_op='INSERT' then
    if new.version<1 then raise exception 'SUPPORT_TICKET_VERSION_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.scope_id,new.conversation_id,new.created_at) is distinct from
    (old.id,old.scope_id,old.conversation_id,old.created_at) then raise exception 'SUPPORT_TICKET_IDENTITY_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'SUPPORT_TICKET_VERSION_INVALID'; end if;
  if new.state<>old.state and not(
    old.state='open' and new.state in('assigned','waiting','resolved')
    or old.state='assigned' and new.state in('open','waiting','resolved')
    or old.state='waiting' and new.state in('open','assigned','resolved')
    or old.state='resolved' and new.state in('open','closed')
    or old.state='closed' and new.state='open'
  ) then raise exception 'SUPPORT_TICKET_TRANSITION_INVALID'; end if;
  if old.state='closed' and new.state='open' and (old.reopen_until is null or new.updated_at>old.reopen_until)
    then raise exception 'SUPPORT_TICKET_REOPEN_WINDOW_EXPIRED'; end if;
  return new;
end
$function$;
revoke all on function support.guard_ticket() from public,shopapp,shopjob;
create trigger support_ticket_guard before insert or update on support.ticket
for each row execute function support.guard_ticket();

create function support.guard_conversation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if tg_op='INSERT' then
    if new.version<1 or new.latest_sequence<0 then raise exception 'SUPPORT_CONVERSATION_VERSION_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.scope_id,new.member_id,new.order_id,new.channel,new.created_at) is distinct from
    (old.id,old.scope_id,old.member_id,old.order_id,old.channel,old.created_at) then raise exception 'SUPPORT_CONVERSATION_IDENTITY_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'SUPPORT_CONVERSATION_VERSION_INVALID'; end if;
  if new.latest_sequence not in(old.latest_sequence,old.latest_sequence+1) then raise exception 'SUPPORT_MESSAGE_SEQUENCE_INVALID'; end if;
  return new;
end
$function$;
revoke all on function support.guard_conversation() from public,shopapp,shopjob;
create trigger support_conversation_guard before insert or update on support.conversation
for each row execute function support.guard_conversation();

select runtime.record_migration_evidence(
  '20260904031200',before.tickets+before.conversations+before.rules+before.slas,
  after.tickets+after.conversations+after.rules+after.slas,0,0,
  'select id,state,reopen_until,version from support.ticket order by id;',
  'select id,priority,response_seconds,resolution_seconds,reopen_seconds,version from support.sla order by id;'
)
from support_lifecycle_before before cross join lateral(
  select
    (select count(*) from support.ticket) tickets,
    (select count(*) from support.conversation) conversations,
    (select count(*) from support.assignmentrule) rules,
    (select count(*) from support.sla) slas
) after;

insert into runtime.schemaversion(version,checksum)
values('20260904031200',encode(public.digest('20260904031200_harden_support_lifecycle','sha256'),'hex'));

do $assert$
declare resolved record;
begin
  if exists(select 1 from support.ticket where version<1 or (state='closed')<>(reopen_until is not null)) then raise exception 'SUPPORT_TICKET_LIFECYCLE_INVALID'; end if;
  if exists(select 1 from support.conversation where version<1 or latest_sequence<0) then raise exception 'SUPPORT_CONVERSATION_VERSION_INVALID'; end if;
  if exists(select 1 from support.assignmentrule where version<1) then raise exception 'SUPPORT_ASSIGNMENT_RULE_VERSION_INVALID'; end if;
  if exists(select 1 from support.sla where reopen_seconds<1) then raise exception 'SUPPORT_SLA_REOPEN_WINDOW_INVALID'; end if;
  if (select count(*) from pg_trigger where tgrelid='support.ticket'::regclass and tgname='support_ticket_guard' and not tgisinternal)<>1 then raise exception 'SUPPORT_TICKET_GUARD_MISSING'; end if;
  if (select count(*) from pg_trigger where tgrelid='support.conversation'::regclass and tgname='support_conversation_guard' and not tgisinternal)<>1 then raise exception 'SUPPORT_CONVERSATION_GUARD_MISSING'; end if;
  perform set_config('app.scope_id','mall-zhudatuan',true);
  select * into resolved from support.resolve_sla('mall-zhudatuan','normal');
  if resolved.reopen_seconds<>604800 then raise exception 'SUPPORT_SLA_RESOLUTION_INVALID'; end if;
end
$assert$;

commit;
