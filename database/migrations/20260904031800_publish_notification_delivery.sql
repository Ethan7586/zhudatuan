begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031700') then raise exception 'NOTIFICATION_DELIVERY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031800') then raise exception 'NOTIFICATION_DELIVERY_ALREADY_APPLIED'; end if;
end
$precondition$;

update notification.dispatch set state='retrying' where state='failed';
alter table notification.dispatch drop constraint dispatch_state_check;
alter table notification.dispatch add constraint notification_dispatch_state check(state in('queued','sending','retrying','sent','dead','cancelled'));
drop index notification.notification_dispatch_due;
create index notification_dispatch_due on notification.dispatch(available_at,created_at,id) where state in('queued','retrying');

alter table notification.attempt add constraint notification_attempt_state check(state in('sending','sent','failed','ambiguous'));

create table notification.providerreceipt(
  id text primary key check(id~'^receipt:'),
  dispatch_id text not null,
  scope_id text not null,
  provider text not null check(length(provider) between 1 and 64),
  external_id text not null check(length(external_id) between 1 and 512),
  received_at timestamptz not null,
  unique(provider,external_id),
  unique(dispatch_id),
  foreign key(scope_id,dispatch_id) references notification.dispatch(scope_id,id)
);
create index notification_providerreceipt_scope_time on notification.providerreceipt(scope_id,received_at,id);

create function notification.guard_dispatch_transition() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if row(old.id,old.scope_id,old.member_id,old.template_id,old.channel,old.recipient_token,old.recipient_ciphertext,
    old.recipient_key_version,old.recipient_ref,old.payload,old.subject,old.body,old.idempotency_key,old.created_at,
    old.event_type,old.template_version,old.provider_template,old.variable_schema,old.purpose,old.mandatory,old.max_attempts)
    is distinct from row(new.id,new.scope_id,new.member_id,new.template_id,new.channel,new.recipient_token,new.recipient_ciphertext,
    new.recipient_key_version,new.recipient_ref,new.payload,new.subject,new.body,new.idempotency_key,new.created_at,
    new.event_type,new.template_version,new.provider_template,new.variable_schema,new.purpose,new.mandatory,new.max_attempts)
    or not(
      old.state=new.state or old.state='queued' and new.state in('sending','cancelled') or
      old.state='retrying' and new.state in('sending','cancelled','dead') or
      old.state='sending' and new.state in('sent','retrying','dead','cancelled')
    ) then raise exception 'NOTIFICATION_DISPATCH_TRANSITION_INVALID'; end if;
  return new;
end
$function$;
revoke all on function notification.guard_dispatch_transition() from public,shopapp,shopjob;
create trigger notification_dispatch_transition before update on notification.dispatch
for each row execute function notification.guard_dispatch_transition();

create function notification.reject_provider_receipt_mutation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$ begin raise exception 'NOTIFICATION_PROVIDER_RECEIPT_IMMUTABLE'; end $function$;
revoke all on function notification.reject_provider_receipt_mutation() from public,shopapp,shopjob;
create trigger notification_providerreceipt_immutable before update or delete on notification.providerreceipt
for each row execute function notification.reject_provider_receipt_mutation();

alter table notification.providerreceipt enable row level security;
alter table notification.providerreceipt force row level security;
create policy providerreceiptapp on notification.providerreceipt for select to shopapp using(access.scope_allowed(scope_id));
create policy providerreceiptjob on notification.providerreceipt for all to shopjob using(true) with check(true);
revoke all on notification.providerreceipt from public;
grant select on notification.providerreceipt to shopapp;
grant select,insert on notification.providerreceipt to shopjob;

select runtime.record_migration_evidence(
  '20260904031800',0,0,0,0,
  'select id,scope_id,template_id,template_version,state,attempt_count,last_error_class from notification.dispatch order by scope_id,id;',
  'select dispatch_id,provider,external_id,received_at from notification.providerreceipt order by scope_id,dispatch_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904031800',encode(public.digest('20260904031800_publish_notification_delivery','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from notification.dispatch where state='failed') then raise exception 'NOTIFICATION_LEGACY_STATE_REMAINS'; end if;
  if not exists(select 1 from pg_class where oid='notification.providerreceipt'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'NOTIFICATION_RECEIPT_RLS_MISSING'; end if;
  if (select count(*) from pg_trigger where tgrelid='notification.dispatch'::regclass and tgname='notification_dispatch_transition' and not tgisinternal)<>1 then raise exception 'NOTIFICATION_DISPATCH_GUARD_MISSING'; end if;
end
$assert$;

commit;
