begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830102000') then
    raise exception 'MAKER_CHECKER_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830103000') then
    raise exception 'MAKER_CHECKER_ALREADY_APPLIED';
  end if;
end $precondition$;

create table access.actionproof(
  id uuid primary key,
  token_hash bytea not null unique,
  operation_id text not null references runtime.operation(id),
  resource_id text not null,
  request_hash char(64) not null,
  expected_version bigint,
  target text not null check(target in('console','storefront')),
  scope_id text not null,
  maker_membership_id text not null references access.membership(id),
  checker_membership_id text not null references access.membership(id),
  checker_access_version bigint not null check(checker_access_version>0),
  permission_code text not null references access.permission(code),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check(maker_membership_id<>checker_membership_id),
  check(expires_at>created_at and expires_at<=created_at+interval '15 minutes'),
  check(consumed_at is null or consumed_at>=created_at)
);
alter table access.actionproof enable row level security;
alter table access.actionproof force row level security;
create index access_actionproof_expiry on access.actionproof(expires_at,id) where consumed_at is null;
create index access_actionproof_checker on access.actionproof(checker_membership_id,checker_access_version,expires_at);

create function access.consume_action_proof(
  p_token_hash bytea,p_operation text,p_resource text,p_request_hash text,p_expected_version bigint,
  p_target text,p_scope text,p_maker_membership text,p_permission text
)
returns table(proof_id text,checker_membership_id text)
language plpgsql volatile security definer set search_path=access,capability,pg_temp as $function$
declare proof access.actionproof%rowtype; snapshot record;
begin
  select * into proof from access.actionproof candidate where candidate.token_hash=p_token_hash for update;
  if proof.id is null then raise exception 'ACTION_PROOF_INVALID'; end if;
  if proof.consumed_at is not null then raise exception 'ACTION_PROOF_REPLAYED'; end if;
  if proof.expires_at<=clock_timestamp() then raise exception 'ACTION_PROOF_INVALID'; end if;
  if proof.operation_id<>p_operation or proof.resource_id<>p_resource or proof.request_hash<>p_request_hash
    or proof.expected_version is distinct from p_expected_version or proof.target<>p_target or proof.scope_id<>p_scope
    or proof.maker_membership_id<>p_maker_membership or proof.permission_code<>p_permission then
    raise exception 'ACTION_PROOF_INVALID';
  end if;
  if proof.checker_membership_id=proof.maker_membership_id then raise exception 'MAKER_CHECKER_SEPARATION_REQUIRED'; end if;

  select * into snapshot from access.authorization_snapshot(
    proof.checker_membership_id,proof.target,proof.operation_id,proof.resource_id);
  if snapshot.membership_id is null or not snapshot.membership_active
    or snapshot.access_version<>proof.checker_access_version
    or proof.permission_code=any(snapshot.permission_denies)
    or not proof.permission_code=any(snapshot.permission_allows)
    or not proof.operation_id=any(snapshot.operation_ids)
    or snapshot.resource_scope->>'id'<>proof.scope_id then
    raise exception 'ACTION_PROOF_INVALID';
  end if;

  update access.actionproof consumed set consumed_at=clock_timestamp() where consumed.id=proof.id;
  return query select proof.id::text,proof.checker_membership_id;
end
$function$;

revoke all on table access.actionproof from public,shopapp;
revoke all on function access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text) from public;
grant execute on function access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text) to shopapp;
grant select,delete on access.actionproof to shopjob;
create policy actionproofjob on access.actionproof for all to shopjob using(true) with check(true);

select runtime.record_migration_evidence('20260830103000',0,0,0,0,
  'create index concurrently if not exists access_actionproof_expiry_live on access.actionproof(expires_at,id) where consumed_at is null;',
  'select count(*) pending,min(expires_at) oldest_expiry from access.actionproof where consumed_at is null;');
insert into runtime.schemaversion(version,checksum)
values('20260830103000',encode(public.digest('20260830103000_enforce_maker_checker','sha256'),'hex'));

do $assert$ begin
  if to_regprocedure('access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text)') is null then
    raise exception 'ACTION_PROOF_CONSUMER_MISSING';
  end if;
  if has_table_privilege('shopapp','access.actionproof','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'ACTION_PROOF_DIRECT_APP_ACCESS_REMAINS';
  end if;
end $assert$;

commit;
