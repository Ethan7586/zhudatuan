begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830144000') then raise exception 'REFERRAL_SECURITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830145000') then raise exception 'REFERRAL_SECURITY_ALREADY_APPLIED'; end if;
end $precondition$;

create or replace function referral.reject_movement_mutation() returns trigger language plpgsql
set search_path=referral,pg_temp as $function$
begin raise exception 'REFERRAL_MOVEMENT_APPEND_ONLY'; end $function$;
create trigger referral_commissionmovement_immutable before update or delete on referral.commissionmovement
for each row execute function referral.reject_movement_mutation();
create trigger referral_recoverymovement_immutable before update or delete on referral.recoverymovement
for each row execute function referral.reject_movement_mutation();

alter table referral.setting enable row level security;
alter table referral.setting force row level security;
alter table referral.product enable row level security;
alter table referral.product force row level security;
alter table referral.member enable row level security;
alter table referral.member force row level security;
alter table referral.binding enable row level security;
alter table referral.binding force row level security;
alter table referral.commission enable row level security;
alter table referral.commission force row level security;
alter table referral.commissionmovement enable row level security;
alter table referral.commissionmovement force row level security;
alter table referral.recoverymovement enable row level security;
alter table referral.recoverymovement force row level security;
alter table referral.withdrawalclaim enable row level security;
alter table referral.withdrawalclaim force row level security;
create policy appscope on referral.setting for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.setting for all to shopjob using(true) with check(true);
create policy appscope on referral.product for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.product for all to shopjob using(true) with check(true);
create policy appscope on referral.member for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.member for all to shopjob using(true) with check(true);
create policy appscope on referral.binding for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.binding for all to shopjob using(true) with check(true);
create policy appscope on referral.commission for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.commission for all to shopjob using(true) with check(true);
create policy appscope on referral.commissionmovement for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.commissionmovement for all to shopjob using(true) with check(true);
create policy appscope on referral.recoverymovement for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.recoverymovement for all to shopjob using(true) with check(true);
create policy appscope on referral.withdrawalclaim for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on referral.withdrawalclaim for all to shopjob using(true) with check(true);

grant usage on schema referral to shopapp,shopjob;
grant select,insert,update on referral.setting,referral.product,referral.member,referral.binding,referral.commission,referral.withdrawalclaim to shopapp,shopjob;
grant select,insert on referral.commissionmovement,referral.recoverymovement to shopapp,shopjob;

alter table runtime.outbox add column actor_id text;
alter table runtime.outbox add column correlation_id text;
alter table runtime.outbox add column causation_id text;
alter table runtime.outbox add column payload_version integer;
update runtime.outbox set actor_id='system:migration',correlation_id=trace_id,causation_id=trace_id,payload_version=event_version
where actor_id is null or correlation_id is null or causation_id is null or payload_version is null;
create or replace function runtime.complete_outbox_envelope() returns trigger language plpgsql
set search_path=runtime,pg_temp as $function$
begin
  new.actor_id:=coalesce(nullif(new.actor_id,''),'system:'||new.aggregate_type);
  new.correlation_id:=coalesce(nullif(new.correlation_id,''),new.trace_id);
  new.causation_id:=coalesce(nullif(new.causation_id,''),new.trace_id);
  new.payload_version:=coalesce(new.payload_version,new.event_version);
  return new;
end $function$;
create trigger runtime_outbox_complete_envelope before insert on runtime.outbox
for each row execute function runtime.complete_outbox_envelope();
alter table runtime.outbox alter column actor_id set not null;
alter table runtime.outbox alter column correlation_id set not null;
alter table runtime.outbox alter column causation_id set not null;
alter table runtime.outbox alter column payload_version set not null;
alter table runtime.outbox add constraint runtime_outbox_payload_version_positive check(payload_version>0) not valid;
alter table runtime.outbox validate constraint runtime_outbox_payload_version_positive;
create index runtime_outbox_scope_delivery on runtime.outbox(scope_id,available_at,aggregate_id,aggregate_version,id)
where published_at is null and failed_at is null;

insert into runtime.schemaversion(version,checksum)
values('20260830145000',encode(public.digest('20260830145000_secure_referral_domain','sha256'),'hex'));

do $assert$ begin
  if (select count(*) from pg_class tableclass join pg_namespace namespace on namespace.oid=tableclass.relnamespace
      where namespace.nspname='referral' and tableclass.relkind='r' and tableclass.relrowsecurity and tableclass.relforcerowsecurity)<>8 then
    raise exception 'REFERRAL_RLS_INCOMPLETE';
  end if;
end $assert$;

commit;
