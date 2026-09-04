begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031600') then raise exception 'NOTIFICATION_MODEL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031700') then raise exception 'NOTIFICATION_MODEL_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table notification.template add column purpose text;
alter table notification.template add column mandatory boolean;
update notification.template set purpose=case when event_type like 'campaign.%' or event_type like 'marketing.%' then 'marketing' else 'transactional' end,
  mandatory=event_type in('identity.challenge','security.alert','finance.invoice.issued');
alter table notification.template alter column purpose set not null;
alter table notification.template alter column mandatory set not null;
alter table notification.template add constraint notification_template_purpose check(purpose in('transactional','marketing'));
alter table notification.template add constraint notification_template_mandatory check(not mandatory or purpose='transactional');

alter table notification.preference add column consent_source text;
alter table notification.preference add column quiet_start time;
alter table notification.preference add column quiet_end time;
alter table notification.preference add column quiet_timezone text;
alter table notification.preference add column version bigint;
update notification.preference set consent_source=case when authorization_state in('accepted','rejected') then 'provider' else 'system' end,version=1;
alter table notification.preference alter column consent_source set not null;
alter table notification.preference alter column version set not null;
alter table notification.preference add constraint notification_preference_consent_source check(consent_source in('member','provider','operator','system'));
alter table notification.preference add constraint notification_preference_quiet_hours check(
  (quiet_start is null and quiet_end is null and quiet_timezone is null) or
  (quiet_start is not null and quiet_end is not null and quiet_start<>quiet_end and quiet_timezone is not null and length(quiet_timezone) between 1 and 64));
alter table notification.preference add constraint notification_preference_version check(version>0);

alter table notification.endpoint add column consent_source text;
alter table notification.endpoint add column version bigint;
update notification.endpoint set consent_source=case when channel='wechat' then 'provider' else 'member' end,version=1;
alter table notification.endpoint alter column consent_source set not null;
alter table notification.endpoint alter column version set not null;
alter table notification.endpoint add constraint notification_endpoint_consent_source check(consent_source in('member','provider','operator','system'));
alter table notification.endpoint add constraint notification_endpoint_version check(version>0);

alter table notification.dispatch add column event_type text;
alter table notification.dispatch add column template_version integer;
alter table notification.dispatch add column provider_template text;
alter table notification.dispatch add column variable_schema jsonb;
alter table notification.dispatch add column purpose text;
alter table notification.dispatch add column mandatory boolean;
alter table notification.dispatch add column attempt_count integer;
alter table notification.dispatch add column max_attempts integer;
alter table notification.dispatch add column last_error_class text;
alter table notification.dispatch add column last_error_code text;
alter table notification.dispatch add column last_attempt_at timestamptz;
update notification.dispatch dispatch set event_type=template.event_type,template_version=template.version,
  provider_template=template.provider_template,variable_schema=template.variable_schema,purpose=template.purpose,mandatory=template.mandatory,
  attempt_count=coalesce((select count(*) from notification.attempt where dispatch_id=dispatch.id),0),max_attempts=5
from notification.template template where template.id=dispatch.template_id;
alter table notification.dispatch alter column event_type set not null;
alter table notification.dispatch alter column template_version set not null;
alter table notification.dispatch alter column variable_schema set not null;
alter table notification.dispatch alter column purpose set not null;
alter table notification.dispatch alter column mandatory set not null;
alter table notification.dispatch alter column attempt_count set not null;
alter table notification.dispatch alter column max_attempts set not null;
alter table notification.dispatch add constraint notification_dispatch_template_version check(template_version>0);
alter table notification.dispatch add constraint notification_dispatch_variable_schema check(jsonb_typeof(variable_schema)='object');
alter table notification.dispatch add constraint notification_dispatch_purpose check(purpose in('transactional','marketing'));
alter table notification.dispatch add constraint notification_dispatch_mandatory check(not mandatory or purpose='transactional');
alter table notification.dispatch add constraint notification_dispatch_attempt_count check(attempt_count between 0 and max_attempts and max_attempts between 1 and 20);
alter table notification.dispatch add constraint notification_dispatch_failure check(
  (last_error_class is null and last_error_code is null) or
  (last_error_class in('retryable','permanent','ambiguous') and last_error_code is not null));

alter table notification.attempt add column sequence integer;
alter table notification.attempt add column error_class text;
with numbered as(
  select id,attempted_at,row_number() over(partition by dispatch_id order by attempted_at,id)::integer sequence
  from notification.attempt
) update notification.attempt attempt set sequence=numbered.sequence from numbered
where attempt.id=numbered.id and attempt.attempted_at=numbered.attempted_at;
alter table notification.attempt alter column sequence set not null;
alter table notification.attempt add constraint notification_attempt_sequence check(sequence>0);
alter table notification.attempt add constraint notification_attempt_error_class check(error_class is null or error_class in('retryable','permanent','ambiguous'));
alter table notification.attempt add constraint notification_attempt_evidence check(
  (state='sent' and external_id is not null and error_code is null and error_class is null) or
  (state='sending' and external_id is null and error_code is null and error_class is null) or
  (state in('failed','ambiguous') and external_id is null and error_code is not null and error_class is not null));

create function notification.guard_template_version() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if row(old.id,old.scope_id,old.channel,old.event_type,old.version,old.variable_schema,old.provider_template,old.subject,old.body,old.created_at,old.purpose,old.mandatory)
    is distinct from row(new.id,new.scope_id,new.channel,new.event_type,new.version,new.variable_schema,new.provider_template,new.subject,new.body,new.created_at,new.purpose,new.mandatory)
    or not(old.status=new.status or old.status='draft' and new.status='active' or old.status='active' and new.status='retired') then
    raise exception 'NOTIFICATION_TEMPLATE_VERSION_IMMUTABLE';
  end if;
  return new;
end
$function$;
revoke all on function notification.guard_template_version() from public,shopapp,shopjob;
create trigger notification_template_version_immutable before update on notification.template
for each row execute function notification.guard_template_version();

create function notification.guard_announcement_transition() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if old.scope_id<>new.scope_id or old.id<>new.id or not(old.state=new.state or old.state='draft' and new.state='published' or old.state='published' and new.state='retired')
    or new.version<>old.version+1 then raise exception 'NOTIFICATION_ANNOUNCEMENT_TRANSITION_INVALID'; end if;
  return new;
end
$function$;
revoke all on function notification.guard_announcement_transition() from public,shopapp,shopjob;
create trigger notification_announcement_transition before update on notification.announcement
for each row execute function notification.guard_announcement_transition();

create function notification.reject_attempt_mutation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$ begin raise exception 'NOTIFICATION_ATTEMPT_IMMUTABLE'; end $function$;
revoke all on function notification.reject_attempt_mutation() from public,shopapp,shopjob;
create trigger notification_attempt_immutable before update or delete on notification.attempt
for each row execute function notification.reject_attempt_mutation();

create index notification_dispatch_due on notification.dispatch(available_at,created_at,id) where state in('queued','failed');
create index notification_attempt_dispatch_sequence on notification.attempt(dispatch_id,sequence,attempted_at);
create index notification_preference_quiet on notification.preference(member_id,event_type,channel) where quiet_start is not null;

select runtime.record_migration_evidence(
  '20260904031700',
  (select count(*) from notification.template),
  (select count(*) from notification.template),
  (select count(*) from notification.dispatch),
  (select count(*) from notification.dispatch),
  'select id,scope_id,channel,event_type,version,purpose,mandatory,status from notification.template order by scope_id,id;',
  'select id,template_id,template_version,event_type,purpose,mandatory,attempt_count,max_attempts,state from notification.dispatch order by scope_id,id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904031700',encode(public.digest('20260904031700_harden_notification_models','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from notification.template where purpose is null or mandatory is null) then raise exception 'NOTIFICATION_TEMPLATE_MODEL_INCOMPLETE'; end if;
  if exists(select 1 from notification.preference where consent_source is null or version<1) then raise exception 'NOTIFICATION_PREFERENCE_MODEL_INCOMPLETE'; end if;
  if exists(select 1 from notification.dispatch where template_version is null or variable_schema is null or attempt_count is null) then raise exception 'NOTIFICATION_DISPATCH_SNAPSHOT_INCOMPLETE'; end if;
end
$assert$;

commit;
