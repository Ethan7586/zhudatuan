begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830103000') then
    raise exception 'INVITATION_DOMAIN_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830104000') then
    raise exception 'INVITATION_DOMAIN_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.preauth alter column transaction_id drop not null;
alter table identity.preauth alter column principal_id drop not null;
alter table identity.preauth alter column candidate_hash drop not null;
alter table identity.preauth alter column candidate_memberships set default '[]'::jsonb;

create table identity.invitation(
  id text primary key,
  kind text not null check(kind in('signin','enrollment','campaign')),
  target text not null check(target in('console','storefront')),
  organization_id text not null references organization.organization(id),
  membership_id text references access.membership(id),
  principal_id text references identity.principal(id),
  recipient_hash bytea,
  token_hash bytea not null unique check(octet_length(token_hash)=32),
  token_key_version text not null check(length(token_key_version) between 1 and 128),
  issuer_membership_id text not null,
  issuer_access_version bigint not null check(issuer_access_version>0),
  grant_digest char(64) not null check(grant_digest~'^[0-9a-f]{64}$'),
  minimum_assurance smallint not null check(minimum_assurance between 1 and 3),
  max_uses integer not null check(max_uses>0),
  use_count integer not null default 0 check(use_count>=0),
  not_before timestamptz not null,
  expires_at timestamptz not null,
  status text not null check(status in('draft','active','reserved','exhausted','revoked','expired')),
  policy_id text references identity.registrationpolicy(id),
  terms_hash char(64),
  reason text not null check(length(trim(reason)) between 4 and 1000),
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  version bigint not null default 0 check(version>=0),
  check(use_count<=max_uses),
  check(expires_at>not_before and expires_at<=created_at+interval '90 days'),
  check((kind='signin' and membership_id is not null and principal_id is not null and max_uses=1 and policy_id is null and terms_hash is null)
    or (kind='enrollment' and membership_id is not null and principal_id is null and recipient_hash is not null and max_uses=1
      and policy_id is not null and terms_hash is not null)
    or (kind='campaign' and membership_id is null and principal_id is null and target='storefront'
      and policy_id is not null and terms_hash is not null)),
  check(target<>'console' or (kind='signin' and recipient_hash is not null and max_uses=1 and minimum_assurance>=2)),
  check((status='revoked')=(revoked_at is not null)),
  check((revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null and length(trim(revoke_reason)) between 4 and 1000))
);

create table identity.invitationclaim(
  id uuid primary key,
  invitation_id text not null references identity.invitation(id),
  browser_hash bytea not null check(octet_length(browser_hash)=32),
  device_hash bytea not null check(octet_length(device_hash)=32),
  target text not null check(target in('console','storefront')),
  recipient_hash bytea,
  state text not null check(state in('active','consumed','revoked','expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  check(expires_at>created_at and expires_at<=created_at+interval '10 minutes'),
  check((state='consumed')=(consumed_at is not null))
);

create table identity.invitationreceipt(
  id uuid primary key,
  invitation_id text not null references identity.invitation(id),
  principal_id text not null references identity.principal(id),
  membership_id text not null references access.membership(id),
  session_id text not null unique references identity.session(id),
  assurance smallint not null check(assurance between 1 and 3),
  issuer_access_version bigint not null check(issuer_access_version>0),
  grant_digest char(64) not null check(grant_digest~'^[0-9a-f]{64}$'),
  redeemed_at timestamptz not null default clock_timestamp(),
  trace_id text not null,
  unique(invitation_id,session_id)
);

create unique index identity_invitation_personal_active
on identity.invitation(membership_id,target)
where kind in('signin','enrollment') and status in('active','reserved');
create index identity_invitation_expiry on identity.invitation(status,expires_at,id);
create index identity_invitation_issuer on identity.invitation(issuer_membership_id,status,created_at,id);
create index identity_invitation_membership on identity.invitation(membership_id,target,status);
create index identity_invitationclaim_lookup on identity.invitationclaim(invitation_id,state,expires_at);
create unique index identity_invitationclaim_active on identity.invitationclaim(invitation_id) where state='active';
create index identity_invitationreceipt_history on identity.invitationreceipt(invitation_id,redeemed_at);

create function identity.reject_invitationreceipt_mutation() returns trigger language plpgsql as $function$
begin raise exception 'INVITATION_RECEIPT_IMMUTABLE'; end
$function$;
create trigger invitationreceiptimmutable before update or delete on identity.invitationreceipt
for each row execute function identity.reject_invitationreceipt_mutation();

insert into identity.invitation(id,kind,target,organization_id,membership_id,principal_id,recipient_hash,token_hash,
  token_key_version,issuer_membership_id,issuer_access_version,grant_digest,minimum_assurance,max_uses,use_count,
  not_before,expires_at,status,policy_id,terms_hash,reason,created_at,revoked_at,revoked_by,revoke_reason,version)
select invite.id,'campaign','storefront',invite.organization_id,null,null,decode(invite.destination_hash,'hex'),decode(invite.token_hash,'hex'),
  'retired',invite.created_by,1,encode(public.digest(concat_ws(':',invite.organization_id,invite.role_id,invite.version),'sha256'),'hex'),
  1,invite.max_uses,invite.use_count,invite.effective_at,
  greatest(invite.effective_at+interval '1 second',least(invite.expires_at,coalesce(invite.created_at,invite.effective_at)+interval '90 days')),
  'revoked',invite.registration_policy_id,
  invite.terms_hash,'legacy invitation invalidated by v3 hard cut',coalesce(invite.created_at,invite.effective_at),clock_timestamp(),
  'system:migration','legacy invitation key retired',invite.version+1
from member.invite invite;

do $rewrite$
declare definition text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  execute replace(definition,'member.invite','identity.invitation');
end
$rewrite$;

drop table member.invite;

alter table identity.invitation enable row level security;
alter table identity.invitation force row level security;
alter table identity.invitationclaim enable row level security;
alter table identity.invitationclaim force row level security;
alter table identity.invitationreceipt enable row level security;
alter table identity.invitationreceipt force row level security;
create policy invitationapi on identity.invitation for all to shopapp
  using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy invitationclaimapi on identity.invitationclaim for all to shopapp
  using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy invitationreceiptapiread on identity.invitationreceipt for select to shopapp
  using(current_setting('app.workload',true)='api');
create policy invitationreceiptapiwrite on identity.invitationreceipt for insert to shopapp
  with check(current_setting('app.workload',true)='api');
create policy invitationjob on identity.invitation for all to shopjob using(true) with check(true);
create policy invitationclaimjob on identity.invitationclaim for all to shopjob using(true) with check(true);
create policy invitationreceiptjobread on identity.invitationreceipt for select to shopjob using(true);
grant select,insert,update on identity.invitation,identity.invitationclaim to shopapp;
grant select,insert on identity.invitationreceipt to shopapp;
grant select,update,delete on identity.invitation,identity.invitationclaim to shopjob;
grant select on identity.invitationreceipt to shopjob;

select runtime.record_migration_evidence('20260830104000',
  (select count(*) from identity.invitation where token_key_version='retired'),
  (select count(*) from identity.invitation where token_key_version='retired'),0,0,
  'create index concurrently if not exists identity_invitation_expiry_live on identity.invitation(status,expires_at,id);',
  'select status,count(*) from identity.invitation group by status order by status;');
insert into runtime.schemaversion(version,checksum)
values('20260830104000',encode(public.digest('20260830104000_create_invitation_domain','sha256'),'hex'));

do $assert$ begin
  if to_regclass('member.invite') is not null then raise exception 'LEGACY_INVITATION_TABLE_REMAINS'; end if;
  if to_regclass('identity.invitation') is null or to_regclass('identity.invitationclaim') is null
    or to_regclass('identity.invitationreceipt') is null then raise exception 'INVITATION_DOMAIN_TABLE_MISSING'; end if;
  if exists(select 1 from identity.invitation where token_key_version='retired' and status<>'revoked') then
    raise exception 'LEGACY_INVITATION_REMAINS_ACTIVE';
  end if;
end $assert$;

commit;
