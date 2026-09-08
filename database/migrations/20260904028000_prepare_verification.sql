begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904027900') then raise exception 'VERIFICATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028000') then raise exception 'VERIFICATION_ALREADY_APPLIED'; end if;
end $precondition$;

alter table verification.nonce rename to token;
alter table verification.token rename column nonce_hash to token_hash;
alter table verification.attempt rename column nonce_hash to token_hash;

update verification.session set purpose='voucher_redeem' where purpose='voucher_redemption';
alter table verification.session
  add column operation_id text,
  add column channel text,
  add column attempts integer,
  add column maximum_attempts integer,
  add column issued_by text,
  add column created_at timestamptz,
  add column verified_at timestamptz;

update verification.session session set
  operation_id=case session.purpose when 'member_code' then 'verification.member.inspect' when 'voucher_redeem' then 'voucher.redemptions.create' else 'verification.member.inspect' end,
  channel='qrcode',
  attempts=least(5,(select count(*)::integer from verification.attempt attempt where attempt.session_id=session.id)),
  maximum_attempts=5,
  issued_by='system:migration',
  created_at=coalesce((select min(token.issued_at) from verification.token token where token.session_id=session.id),session.expires_at-interval '60 seconds'),
  verified_at=case when session.state='verified' then coalesce((select max(token.consumed_at) from verification.token token where token.session_id=session.id),session.expires_at-interval '60 seconds') end;

alter table verification.session
  alter column operation_id set not null,
  alter column channel set not null,
  alter column attempts set not null,
  alter column maximum_attempts set not null,
  alter column issued_by set not null,
  alter column created_at set not null,
  add constraint verification_session_subject_type check(subject_type in('member','voucher','principal','resource')) not valid,
  add constraint verification_session_purpose check(purpose in('member_code','voucher_redeem','login','sensitive_action','financial_approval')) not valid,
  add constraint verification_session_channel check(channel in('qrcode','sms','app')) not valid,
  add constraint verification_session_attempts check(attempts>=0 and attempts<=maximum_attempts and maximum_attempts between 1 and 10) not valid,
  add constraint verification_session_period check(expires_at>created_at) not valid,
  add constraint verification_session_verified check((state='verified')=(verified_at is not null)) not valid;

alter table verification.session validate constraint verification_session_subject_type;
alter table verification.session validate constraint verification_session_purpose;
alter table verification.session validate constraint verification_session_channel;
alter table verification.session validate constraint verification_session_attempts;
alter table verification.session validate constraint verification_session_period;
alter table verification.session validate constraint verification_session_verified;

alter table verification.token
  add column expires_at timestamptz,
  add column consumed_by_device_id text references verification.device(id),
  add column consumed_by_actor_id text;
update verification.token token set expires_at=session.expires_at from verification.session session where session.id=token.session_id;
alter table verification.token
  alter column expires_at set not null,
  add constraint verification_token_hash check(token_hash~'^[a-f0-9]{64}$') not valid,
  add constraint verification_token_period check(expires_at>issued_at) not valid,
  add constraint verification_token_consumption check((consumed_at is null)=(consumed_by_device_id is null and consumed_by_actor_id is null)) not valid;
alter table verification.token validate constraint verification_token_hash;
alter table verification.token validate constraint verification_token_period;
alter table verification.token validate constraint verification_token_consumption;

alter table verification.device
  add column trusted_at timestamptz,
  add column retired_at timestamptz,
  add column last_used_at timestamptz,
  add column created_at timestamptz;
update verification.device set created_at=clock_timestamp(),trusted_at=case when status='trusted' then clock_timestamp() end,
  retired_at=case when status='retired' then clock_timestamp() end;
alter table verification.device alter column created_at set not null;
alter table verification.device
  add constraint verification_device_hash check(fingerprint_hash~'^[a-f0-9]{64}$') not valid,
  add constraint verification_device_lifecycle check((status='trusted')=(trusted_at is not null and retired_at is null) or status='blocked' or (status='retired' and retired_at is not null)) not valid;
alter table verification.device validate constraint verification_device_hash;
alter table verification.device validate constraint verification_device_lifecycle;

alter table verification.attempt drop constraint attempt_session_id_nonce_hash_key;
alter table verification.attempt
  add column sequence integer,
  add column scope_id text,
  add column purpose text,
  add column operation_id text,
  add column actor_id text,
  add column evidence jsonb;
with numbered as(
  select id,row_number() over(partition by session_id order by attempted_at,id)::integer sequence from verification.attempt
) update verification.attempt attempt set sequence=numbered.sequence,scope_id=session.scope_id,purpose=session.purpose,
  operation_id=session.operation_id,actor_id='system:migration',evidence=jsonb_build_object('source','migration')
from numbered,verification.session session where numbered.id=attempt.id and session.id=attempt.session_id;
alter table verification.attempt
  alter column sequence set not null,
  alter column scope_id set not null,
  alter column purpose set not null,
  alter column operation_id set not null,
  alter column actor_id set not null,
  alter column evidence set not null,
  add constraint verification_attempt_sequence unique(session_id,sequence),
  add constraint verification_attempt_hash check(token_hash~'^[a-f0-9]{64}$') not valid,
  add constraint verification_attempt_evidence check(jsonb_typeof(evidence)='object') not valid;
alter table verification.attempt validate constraint verification_attempt_hash;
alter table verification.attempt validate constraint verification_attempt_evidence;

create table verification.proof(
  id text primary key,
  session_id text not null unique references verification.session(id),
  proof_hash char(64) not null unique check(proof_hash~'^[a-f0-9]{64}$'),
  scope_id text not null,
  subject_type text not null check(subject_type in('member','voucher','principal','resource')),
  subject_id text not null,
  purpose text not null check(purpose in('member_code','voucher_redeem','login','sensitive_action','financial_approval')),
  operation_id text not null,
  state text not null check(state in('active','consumed','revoked','expired')),
  issued_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>issued_at),
  consumed_at timestamptz,
  consumed_by text,
  version bigint not null check(version>=0),
  check((state='consumed')=(consumed_at is not null and consumed_by is not null))
);

create function verification.reject_attempt_mutation()
returns trigger language plpgsql set search_path=verification,pg_temp as $function$
begin
  raise exception 'VERIFICATION_ATTEMPT_IMMUTABLE';
end
$function$;
create trigger verificationattemptimmutable before update or delete on verification.attempt
for each row execute function verification.reject_attempt_mutation();

create index verification_issue_rate on verification.session(issued_by,purpose,created_at desc,id);
create index verification_token_expiry on verification.token(expires_at,session_id) where consumed_at is null;
create index verification_attempt_scope_time on verification.attempt(scope_id,attempted_at desc,id desc);
create index verification_proof_active on verification.proof(proof_hash,scope_id,operation_id,expires_at) where state='active';
create index verification_proof_expiry on verification.proof(expires_at,id) where state='active';

alter table verification.session force row level security;
alter table verification.token force row level security;
alter table verification.device force row level security;
alter table verification.attempt force row level security;
alter table verification.proof enable row level security;
alter table verification.proof force row level security;

drop policy if exists appscope on verification.session;
drop policy if exists jobscope on verification.session;
drop policy if exists appscope on verification.token;
drop policy if exists jobscope on verification.token;
drop policy if exists appscope on verification.device;
drop policy if exists jobscope on verification.device;
drop policy if exists appscope on verification.attempt;
drop policy if exists jobscope on verification.attempt;
create policy appscope on verification.session for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on verification.session for all to shopjob using(true) with check(true);
create policy appscope on verification.token for all to shopapp
  using(exists(select 1 from verification.session session where session.id=session_id and access.scope_allowed(session.scope_id)))
  with check(exists(select 1 from verification.session session where session.id=session_id and access.scope_allowed(session.scope_id)));
create policy jobscope on verification.token for all to shopjob using(true) with check(true);
create policy appscope on verification.device for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on verification.device for all to shopjob using(true) with check(true);
create policy appscope on verification.attempt for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on verification.attempt for all to shopjob using(true) with check(true);
create policy appscope on verification.proof for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on verification.proof for all to shopjob using(true) with check(true);

grant select,insert,update,delete on verification.session,verification.token,verification.device,verification.proof to shopapp,shopjob;
grant select,insert on verification.attempt to shopapp,shopjob;
grant select on verification.session,verification.token,verification.device,verification.attempt,verification.proof to shopverificationreader;
grant select,insert,update,delete on verification.session,verification.token,verification.device,verification.proof to shopverificationwriter;
grant select,insert on verification.attempt to shopverificationwriter;

update runtime.operation set contract_version='5.0.0' where owner='verification';
update capability.capability set version=version+1 where id in('verification.challenges.issue','verification.challenges.verify','verification.sessions.read','verification.history.read','verification.devices.read','verification.devices.manage');
update runtime.contractcatalog set checksum='bf19969858ce083b88d296b82a050e5edcdeb0a6dba89e16bf028b68fc3daaab',operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904028000',(select count(*) from verification.session),(select count(*) from verification.session),0,0,
  'select purpose,channel,state,count(*) from verification.session group by purpose,channel,state;',
  'select scope_id,purpose,operation_id,result,count(*) from verification.attempt group by scope_id,purpose,operation_id,result;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904028000',encode(public.digest('20260904028000_prepare_verification','sha256'),'hex'));

do $assert$ begin
  if to_regclass('verification.nonce') is not null or to_regclass('verification.token') is null then raise exception 'VERIFICATION_TOKEN_HARDCUT_INCOMPLETE'; end if;
  if exists(select 1 from verification.session where attempts>maximum_attempts or expires_at<=created_at) then raise exception 'VERIFICATION_SESSION_INVARIANT_INVALID'; end if;
  if exists(select 1 from verification.token where (consumed_at is null)<>(consumed_by_device_id is null and consumed_by_actor_id is null)) then raise exception 'VERIFICATION_TOKEN_CONSUMPTION_INVALID'; end if;
  if (select count(*) from runtime.operation)<>317 then raise exception 'VERIFICATION_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event where retired_at is null)<>144 then raise exception 'VERIFICATION_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
