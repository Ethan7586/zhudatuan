begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830152000') then
    raise exception 'ACTION_PROOF_ISSUE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830153000') then
    raise exception 'ACTION_PROOF_ISSUE_ALREADY_APPLIED';
  end if;
end $precondition$;

create table identity.stepuprequest(
  challenge_id text primary key references identity.challenge(id) on delete cascade,
  operation_id text not null,
  resource_id text not null,
  request_hash char(64) not null check(request_hash~'^[a-f0-9]{64}$'),
  expected_version bigint check(expected_version is null or expected_version>=0),
  maker_membership_id text not null,
  checker_membership_id text not null,
  target text not null check(target in('console','storefront')),
  scope_id text not null,
  checker_access_version bigint not null check(checker_access_version>0),
  created_at timestamptz not null,
  consumed_at timestamptz,
  check(maker_membership_id<>checker_membership_id),
  check(consumed_at is null or consumed_at>=created_at)
);
create index identity_stepuprequest_pending on identity.stepuprequest(checker_membership_id,created_at,challenge_id) where consumed_at is null;
alter table identity.stepuprequest enable row level security;
alter table identity.stepuprequest force row level security;
create policy stepuprequestapp on identity.stepuprequest for all to shopapp
using(checker_membership_id=nullif(current_setting('app.membership_id',true),''))
with check(checker_membership_id=nullif(current_setting('app.membership_id',true),''));
create policy stepuprequestjob on identity.stepuprequest for select to shopjob using(true);
grant select,insert,update on identity.stepuprequest to shopapp;
grant select on identity.stepuprequest to shopjob;

create function access.issue_action_proof(
  p_id uuid,p_token_hash bytea,p_operation text,p_resource text,p_request_hash text,p_expected_version bigint,
  p_target text,p_scope text,p_maker_membership text,p_checker_membership text,p_permission text
)
returns table(proof_id text,expires_at timestamptz)
language plpgsql volatile security definer set search_path=access,capability,runtime,pg_temp as $function$
declare checker record; maker record; deadline timestamptz:=clock_timestamp()+interval '5 minutes';
begin
  if p_maker_membership=p_checker_membership then raise exception 'MAKER_CHECKER_SEPARATION_REQUIRED'; end if;
  if p_request_hash!~'^[a-f0-9]{64}$' then raise exception 'ACTION_PROOF_INVALID'; end if;
  select * into checker from access.authorization_snapshot(p_checker_membership,p_target,p_operation,p_resource);
  select * into maker from access.authorization_snapshot(p_maker_membership,p_target,p_operation,p_resource);
  if checker.membership_id is null or not checker.membership_active
    or checker.permission_denies@>array[p_permission] or not checker.permission_allows@>array[p_permission]
    or not checker.operation_ids@>array[p_operation] or checker.resource_scope->>'id'<>p_scope then
    raise exception 'ACTION_PROOF_INVALID';
  end if;
  if maker.membership_id is null or not maker.membership_active
    or maker.permission_denies@>array[p_permission] or not maker.permission_allows@>array[p_permission]
    or not maker.operation_ids@>array[p_operation] or maker.resource_scope->>'id'<>p_scope then
    raise exception 'ACTION_PROOF_INVALID';
  end if;
  insert into access.actionproof(id,token_hash,operation_id,resource_id,request_hash,expected_version,target,scope_id,
    maker_membership_id,checker_membership_id,checker_access_version,permission_code,expires_at)
  values(p_id,p_token_hash,p_operation,p_resource,p_request_hash,p_expected_version,p_target,p_scope,
    p_maker_membership,p_checker_membership,checker.access_version,p_permission,deadline);
  return query select p_id::text,deadline;
end
$function$;
revoke all on function access.issue_action_proof(uuid,bytea,text,text,text,bigint,text,text,text,text,text) from public;
grant execute on function access.issue_action_proof(uuid,bytea,text,text,text,bigint,text,text,text,text,text) to shopapp;

select runtime.record_migration_evidence('20260830153000',0,0,0,0,
  'select count(*) pending,min(created_at) oldest from identity.stepuprequest where consumed_at is null;',
  'select count(*) pending,min(expires_at) oldest_expiry from access.actionproof where consumed_at is null;');
insert into runtime.schemaversion(version,checksum)
values('20260830153000',encode(public.digest('20260830153000_issue_action_proof','sha256'),'hex'));

do $assert$ begin
  if to_regprocedure('access.issue_action_proof(uuid,bytea,text,text,text,bigint,text,text,text,text,text)') is null then
    raise exception 'ACTION_PROOF_ISSUER_MISSING';
  end if;
  if has_table_privilege('shopapp','access.actionproof','INSERT') then raise exception 'ACTION_PROOF_DIRECT_INSERT_REMAINS'; end if;
end $assert$;

commit;
