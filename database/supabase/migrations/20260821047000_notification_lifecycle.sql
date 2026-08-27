begin;

alter table notification.template add column created_at timestamptz not null default clock_timestamp();
alter table notification.template alter column created_at drop default;
alter table notification.template add constraint notification_template_scope_identity unique(scope_id,id,channel);

alter table notification.preference add column authorization_state text not null default 'unknown'
  check(authorization_state in('unknown','accepted','rejected'));
alter table notification.preference add column authorized_at timestamptz;
alter table notification.preference add constraint notification_preference_authorization check(
  (authorization_state='accepted')=(authorized_at is not null));
alter table notification.preference alter column authorization_state drop default;

alter table notification.dispatch add column scope_id text;
alter table notification.dispatch add column member_id text;
alter table notification.dispatch add column channel text;
alter table notification.dispatch add column subject text;
alter table notification.dispatch add column body text;
update notification.dispatch dispatch set scope_id=template.scope_id,channel=template.channel,subject=template.subject,body=template.body
  from notification.template template where template.id=dispatch.template_id;
update notification.dispatch set member_id=substring(recipient_ref from 8) where recipient_ref like 'member:%';
update notification.dispatch dispatch set member_id=membership.member_id from member.membership membership
  where dispatch.recipient_ref='membership:'||membership.id and dispatch.member_id is null;
update notification.dispatch dispatch set member_id=endpoint.member_id from notification.endpoint endpoint
  where dispatch.recipient_token=endpoint.address_token and dispatch.member_id is null;
alter table notification.dispatch alter column scope_id set not null;
alter table notification.dispatch alter column channel set not null;
alter table notification.dispatch alter column body set not null;
alter table notification.dispatch add constraint notification_dispatch_channel check(channel in('sms','email','wechat','inapp'));
alter table notification.dispatch drop constraint dispatch_template_id_fkey;
alter table notification.dispatch add constraint notification_dispatch_template_fkey foreign key(scope_id,template_id,channel)
  references notification.template(scope_id,id,channel);
alter table notification.dispatch drop constraint dispatch_idempotency_key_key;
alter table notification.dispatch add constraint notification_dispatch_scope_idempotency unique(scope_id,idempotency_key);
alter table notification.dispatch add constraint notification_dispatch_scope_identity unique(scope_id,id);

alter table notification.attempt add column scope_id text;
alter table notification.attempt add column member_id text;
update notification.attempt attempt set scope_id=dispatch.scope_id,member_id=dispatch.member_id
  from notification.dispatch dispatch where dispatch.id=attempt.dispatch_id;
alter table notification.attempt alter column scope_id set not null;
alter table notification.attempt drop constraint attempt_dispatch_id_fkey;
alter table notification.attempt add constraint notification_attempt_dispatch_fkey foreign key(scope_id,dispatch_id)
  references notification.dispatch(scope_id,id);

create table notification.announcement(
  id text primary key,
  scope_id text not null,
  title text not null check(length(title) between 1 and 500),
  body text not null check(length(body) between 1 and 20000),
  audience jsonb not null check(jsonb_typeof(audience)='object' and audience->>'kind' in('all','members')),
  state text not null check(state in('draft','published','retired')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,id),
  check(ends_at is null or ends_at>starts_at),
  check((audience->>'kind'='all' and audience=jsonb_build_object('kind','all')) or
    (audience->>'kind'='members' and jsonb_typeof(audience->'members')='array' and jsonb_array_length(audience->'members') between 1 and 1000))
);

create index notification_template_scope_event on notification.template(scope_id,event_type,status,channel,version desc);
with ranked as(select id,row_number() over(partition by scope_id,channel,event_type order by version desc,id) sequence
  from notification.template where status='active') update notification.template template set status='retired'
  from ranked where ranked.id=template.id and ranked.sequence>1;
create unique index notification_template_active on notification.template(scope_id,channel,event_type) where status='active';
create index notification_preference_member on notification.preference(member_id,event_type,channel);
create index notification_dispatch_member_time on notification.dispatch(member_id,created_at desc,id desc);
create index notification_dispatch_scope_time on notification.dispatch(scope_id,created_at desc,id desc) where member_id is null;
create index notification_announcement_scope_time on notification.announcement(scope_id,state,starts_at desc,id desc);

alter table notification.announcement enable row level security;
drop policy appscope on notification.template;
drop policy jobscope on notification.template;
drop policy appscope on notification.preference;
drop policy jobscope on notification.preference;
drop policy appscope on notification.endpoint;
drop policy jobscope on notification.endpoint;
drop policy appscope on notification.dispatch;
drop policy jobscope on notification.dispatch;
drop policy appscope on notification.attempt;
drop policy jobscope on notification.attempt;

create policy appscope on notification.template for all to shopapp using(
  access.scope_allowed(scope_id) or status='active' and exists(select 1 from member.membership membership
    join organization.unitclosure closure on closure.descendant_id=membership.organization_id and closure.ancestor_id=scope_id
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'))
  with check(access.scope_allowed(scope_id));
create policy jobscope on notification.template for all to shopjob using(true) with check(true);
create policy appscope on notification.preference for all to shopapp using(member_id=(select membership.member_id from member.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),''))) with check(member_id=(select membership.member_id
  from member.membership membership where membership.id=nullif(current_setting('app.membership_id',true),'')));
create policy jobscope on notification.preference for all to shopjob using(true) with check(true);
create policy appscope on notification.endpoint for all to shopapp using(member_id=(select membership.member_id from member.membership membership
  where membership.id=nullif(current_setting('app.membership_id',true),''))) with check(member_id=(select membership.member_id
  from member.membership membership where membership.id=nullif(current_setting('app.membership_id',true),'')));
create policy jobscope on notification.endpoint for all to shopjob using(true) with check(true);
create policy appscope on notification.dispatch for all to shopapp using(access.scope_allowed(scope_id) or member_id=(select membership.member_id
  from member.membership membership where membership.id=nullif(current_setting('app.membership_id',true),'')))
  with check(access.scope_allowed(scope_id));
create policy jobscope on notification.dispatch for all to shopjob using(true) with check(true);
create policy appscope on notification.attempt for all to shopapp using(access.scope_allowed(scope_id) or member_id=(select membership.member_id
  from member.membership membership where membership.id=nullif(current_setting('app.membership_id',true),'')))
  with check(access.scope_allowed(scope_id));
create policy jobscope on notification.attempt for all to shopjob using(true) with check(true);
create policy appscope on notification.announcement for all to shopapp using(access.scope_allowed(scope_id) or state='published'
  and starts_at<=clock_timestamp() and(ends_at is null or ends_at>clock_timestamp()) and exists(select 1 from member.membership membership
    join organization.unitclosure closure on closure.descendant_id=membership.organization_id and closure.ancestor_id=scope_id
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'))
  with check(access.scope_allowed(scope_id));
create policy jobscope on notification.announcement for all to shopjob using(true) with check(true);
grant select,insert,update,delete on notification.announcement to shopapp,shopjob;

create or replace function identity.notification_recipient(p_membership text)
returns table(id text,subject_ciphertext text) language sql stable security definer
set search_path=identity,pg_temp as $function$
  select identity.id,identity.subject_ciphertext from identity.federatedidentity identity
  where identity.membership_id=p_membership and identity.provider='wechat' and identity.status='active'
  order by identity.updated_at desc limit 1
$function$;
revoke all on function identity.notification_recipient(text) from public;
grant execute on function identity.notification_recipient(text) to shopapp;

create or replace function notification.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=notification,pg_temp as $function$
  select coalesce((select scope_id from notification.dispatch where id=p_resource),
    (select scope_id from notification.template where id=p_resource),
    (select scope_id from notification.announcement where id=p_resource))
$function$;
revoke all on function notification.resource_scope(text) from public;

do $rewrite$ declare definition text; replaced text; begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  replaced:=replace(definition,'select scope_id into resolved from notification.dispatch where id=p_resource',
    'select notification.resource_scope(p_resource) into resolved');
  if replaced=definition then raise exception 'ACCESS_RESOURCE_SCOPE_NOTIFICATION_REWRITE_FAILED'; end if;
  definition:=replaced;
  replaced:=replace(definition,'''notification.templates.manage'',''risk.policies.manage''',
    '''notification.templates.manage'',''notification.announcements.manage'',''risk.policies.manage''');
  if replaced=definition then raise exception 'ACCESS_RESOURCE_SCOPE_NOTIFICATION_FALLBACK_REWRITE_FAILED'; end if;
  execute replaced;
end $rewrite$;

update capability.operation set audience='member' where operation_id='notification.notifications.read';
insert into runtime.operation(id,owner,method,path,contract_version) values
  ('notification.preferences.read','notification','GET','/api/v1/notifications/preferences','1.0.0'),
  ('notification.templates.read','notification','GET','/api/v1/notifications/templates','1.0.0'),
  ('notification.announcements.read','notification','GET','/api/v1/notifications/announcements','1.0.0'),
  ('notification.announcements.manage','notification','PUT','/api/v1/notifications/announcements/{announcementid}','1.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:36ed7b667a85e13a3b1cfb30','notification.preference.read','low','active'),
  ('permission:e1eeaf829ea43ff976ea0f3c','notification.template.read','high','active'),
  ('permission:f8f38dc8489c7e6ddcfecaef','notification.announcement.read','high','active'),
  ('permission:65ca43e720c62b0e0eafc4b0','notification.announcement.manage','critical','active');
insert into capability.capability(id,kind,name,version,status) values
  ('notification.preferences.read','operation','notification.preferences.read',1,'active'),
  ('notification.templates.read','operation','notification.templates.read',1,'active'),
  ('notification.announcements.read','operation','notification.announcements.read',1,'active'),
  ('notification.announcements.manage','operation','notification.announcements.manage',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('notification.preferences.read','notification.preferences.read','notification.preference.read','member'),
  ('notification.templates.read','notification.templates.read','notification.template.read','operator'),
  ('notification.announcements.read','notification.announcements.read','notification.announcement.read','operator'),
  ('notification.announcements.manage','notification.announcements.manage','notification.announcement.manage','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:notification.preferences.read','organization-platform-root','notification.preferences.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:notification.templates.read','organization-platform-root','notification.templates.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:notification.announcements.read','organization-platform-root','notification.announcements.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:notification.announcements.manage','organization-platform-root','notification.announcements.manage','enabled',null,'1970-01-01T00:00:00Z',null,0);

insert into access.rolepermission(role_id,permission_id,effect)
  select distinct mapping.role_id,'permission:36ed7b667a85e13a3b1cfb30','allow' from access.rolepermission mapping
  join access.permission permission on permission.id=mapping.permission_id where permission.code='notification.preference.manage'
  on conflict do nothing;
insert into access.rolepermission(role_id,permission_id,effect)
  select distinct mapping.role_id,permission.id,'allow' from access.rolepermission mapping
  join access.permission source on source.id=mapping.permission_id and source.code='notification.template.manage'
  join access.permission permission on permission.code in('notification.template.read','notification.announcement.read','notification.announcement.manage')
  on conflict do nothing;

insert into runtime.schemaversion(version,checksum) values('20260821047000','55e65f893e83aa6b77415b42c9d645e16b89fb0f9ad54a88e20a23e97c544c77');

do $assert$ begin
  if (select count(*) from runtime.operation)<>199 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from notification.dispatch where scope_id is null or channel is null or body is null) then
    raise exception 'NOTIFICATION_DISPATCH_BACKFILL_INCOMPLETE'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821047000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
