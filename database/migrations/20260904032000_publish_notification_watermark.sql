begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031900') then raise exception 'NOTIFICATION_WATERMARK_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032000') then raise exception 'NOTIFICATION_WATERMARK_ALREADY_APPLIED'; end if;
end
$precondition$;

create table notification.readwatermark(
  member_id text not null,
  device_token char(64) not null check(device_token~'^[a-f0-9]{64}$'),
  notification_id text not null,
  notification_time timestamptz not null,
  read_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(member_id,device_token)
);
create index notification_readwatermark_recent on notification.readwatermark(member_id,read_at desc);

create function notification.guard_read_watermark() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if old.member_id<>new.member_id or old.device_token<>new.device_token or
    (new.notification_time,new.notification_id)<(old.notification_time,old.notification_id) or
    new.read_at<old.read_at or new.version<old.version then raise exception 'NOTIFICATION_READ_WATERMARK_REGRESSION'; end if;
  return new;
end
$function$;
revoke all on function notification.guard_read_watermark() from public,shopapp,shopjob;
create trigger notification_readwatermark_monotonic before update on notification.readwatermark
for each row execute function notification.guard_read_watermark();

alter table notification.readwatermark enable row level security;
alter table notification.readwatermark force row level security;
create policy readwatermarkapp on notification.readwatermark for all to shopapp
using(member_id=(select membership.member_id from access.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'))
with check(member_id=(select membership.member_id from access.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'));
create policy readwatermarkjob on notification.readwatermark for all to shopjob using(true) with check(true);
revoke all on notification.readwatermark from public;
grant select,insert,update on notification.readwatermark to shopapp,shopjob;

create or replace function notification.visible_notifications(p_membership text,p_include_scope boolean)
returns table(member_id text,id text,kind text,event_type text,channel text,subject text,body text,state text,created_at timestamptz)
language sql stable security definer
set search_path=access,organization,notification,pg_temp
as $function$
  with actor as materialized(
    select membership.member_id,membership.organization_id from access.membership membership
    where membership.id=p_membership and membership.status='active'
  ), visible_dispatch as(
    select actor.member_id,dispatch.id,'dispatch'::text kind,dispatch.event_type,dispatch.channel,
      dispatch.subject,dispatch.body,dispatch.state,dispatch.created_at
    from actor join notification.dispatch dispatch on dispatch.member_id=actor.member_id
    union all
    select actor.member_id,dispatch.id,'dispatch'::text kind,dispatch.event_type,dispatch.channel,
      dispatch.subject,dispatch.body,dispatch.state,dispatch.created_at
    from actor join organization.unitclosure closure on closure.descendant_id=actor.organization_id
    join notification.dispatch dispatch on p_include_scope and dispatch.member_id is null and dispatch.scope_id=closure.ancestor_id
  ), visible_announcement as(
    select actor.member_id,announcement.id,'announcement'::text kind,'notification.announcement'::text event_type,
      'inapp'::text channel,announcement.title subject,announcement.body,announcement.state,announcement.created_at
    from actor join organization.unitclosure closure on closure.descendant_id=actor.organization_id
    join notification.announcement announcement on announcement.scope_id=closure.ancestor_id
    where announcement.state='published' and announcement.starts_at<=statement_timestamp()
      and(announcement.ends_at is null or announcement.ends_at>statement_timestamp())
      and(announcement.audience->>'kind'='all' or announcement.audience->>'kind'='members'
        and announcement.audience->'members' @> jsonb_build_array(actor.member_id))
  )
  select * from visible_dispatch union all select * from visible_announcement
$function$;

select runtime.record_migration_evidence(
  '20260904032000',0,0,0,0,
  'select member_id,device_token,notification_id,notification_time,read_at,version from notification.readwatermark order by member_id,device_token;',
  'select proname,prosecdef,provolatile from pg_proc join pg_namespace on pg_namespace.oid=pg_proc.pronamespace where nspname=''notification'' and proname=''visible_notifications'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260904032000',encode(public.digest('20260904032000_publish_notification_watermark','sha256'),'hex'));

do $assert$
begin
  if not exists(select 1 from pg_class where oid='notification.readwatermark'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'NOTIFICATION_WATERMARK_RLS_MISSING'; end if;
  if (select count(*) from pg_trigger where tgrelid='notification.readwatermark'::regclass and tgname='notification_readwatermark_monotonic' and not tgisinternal)<>1 then raise exception 'NOTIFICATION_WATERMARK_GUARD_MISSING'; end if;
end
$assert$;

commit;
