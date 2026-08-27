begin;

alter table risk.policy add column baseline_version integer;
alter table risk.policy add column updated_at timestamptz;
update risk.policy set updated_at=clock_timestamp();
alter table risk.policy alter column updated_at set not null;
alter table risk.policy add column next_version integer;
update risk.policy policy set next_version=coalesce((select max(version)+1 from risk.policyversion where policy_id=policy.id),1);
alter table risk.policy alter column next_version set not null;
alter table risk.policy add constraint risk_policy_nextversion check(next_version>0);

alter table risk.policyversion add column rollout_percent integer;
update risk.policyversion set rollout_percent=100;
alter table risk.policyversion alter column rollout_percent set not null;
alter table risk.policyversion add constraint risk_policyversion_rollout check(rollout_percent between 0 and 100);
alter table risk.policyversion add column status text;
update risk.policyversion version set status=case when policy.active_version=version.version then 'active' else 'retired' end
  from risk.policy policy where policy.id=version.policy_id;
alter table risk.policyversion alter column status set not null;
alter table risk.policyversion add constraint risk_policyversion_status check(status in('candidate','active','baseline','retired'));
alter table risk.policyversion add column created_by text;
update risk.policyversion set created_by='migration';
alter table risk.policyversion alter column created_by set not null;
alter table risk.policyversion add column created_at timestamptz;
update risk.policyversion set created_at=clock_timestamp();
alter table risk.policyversion alter column created_at set not null;
alter table risk.policyversion add constraint risk_policyversion_rule check(jsonb_typeof(rule)='object' and pg_column_size(rule)<=65536);
alter table risk.policy add constraint risk_policy_activeversion foreign key(id,active_version) references risk.policyversion(policy_id,version);
alter table risk.policy add constraint risk_policy_baselineversion foreign key(id,baseline_version) references risk.policyversion(policy_id,version);

alter table risk.replay add column false_positive_rate numeric(9,8);
alter table risk.replay add constraint risk_replay_falsepositive check(false_positive_rate between 0 and 1);
alter table risk.replay add column preview jsonb;
alter table risk.replay add constraint risk_replay_preview check(preview is null or (jsonb_typeof(preview)='object' and pg_column_size(preview)<=65536));

alter table risk.decision add column scope_id text;
update risk.decision set scope_id=coalesce(evidence->>'scope','identity');
alter table risk.decision alter column scope_id set not null;
alter table risk.decision add column score integer;
update risk.decision set score=0;
alter table risk.decision alter column score set not null;
alter table risk.decision add constraint risk_decision_score check(score>=0);
alter table risk.decision add column safe_reason text;
update risk.decision set safe_reason='policy';
alter table risk.decision alter column safe_reason set not null;
alter table risk.decision add constraint risk_decision_reason check(safe_reason in('policy','amount','velocity','signal','list'));
alter table risk.decision add constraint risk_decision_evidence check(jsonb_typeof(evidence)='object' and pg_column_size(evidence)<=262144);

alter table risk.case add column scope_id text;
update risk.case riskcase set scope_id=decision.scope_id from risk.decision decision where decision.id=riskcase.decision_id;
alter table risk.case alter column scope_id set not null;
alter table risk.case alter column decision_id set not null;
alter table risk.case add column outcome text;
update risk.case riskcase set outcome=decision.outcome from risk.decision decision where decision.id=riskcase.decision_id;
alter table risk.case alter column outcome set not null;
alter table risk.case add constraint risk_case_outcome check(outcome in('review','deny'));
alter table risk.case add column safe_reason text;
update risk.case riskcase set safe_reason=decision.safe_reason from risk.decision decision where decision.id=riskcase.decision_id;
alter table risk.case alter column safe_reason set not null;
alter table risk.case add column reviewed_by text;
alter table risk.case add column review_reason text;
alter table risk.case add column review_evidence jsonb not null default '{}'::jsonb;
alter table risk.case alter column review_evidence drop default;
alter table risk.case add constraint risk_case_reviewevidence check(jsonb_typeof(review_evidence)='object' and pg_column_size(review_evidence)<=16384);
alter table risk.case add column reviewed_at timestamptz;
alter table risk.case add column resolution text;
alter table risk.case add constraint risk_case_resolution check(resolution in('cleared','confirmed'));
alter table risk.case add constraint risk_case_resolution_state check(state not in('cleared','confirmed','closed') or resolution is not null);
alter table risk.case add constraint risk_case_review_complete check(
  (reviewed_at is null and reviewed_by is null and review_reason is null) or
  (reviewed_at is not null and reviewed_by is not null and review_reason is not null));

alter table risk.listentry add column scope_id text;
update risk.listentry set scope_id='organization-platform-root';
alter table risk.listentry alter column scope_id set not null;
alter table risk.listentry drop constraint listentry_list_type_token_effective_at_key;
alter table risk.listentry add constraint risk_listentry_scope_token unique(scope_id,list_type,token,effective_at);

create index risk_policy_scope_status on risk.policy(scope_id,status,id);
create index risk_policyversion_state on risk.policyversion(policy_id,status,version desc);
create index risk_replay_state on risk.replay(state,created_at,policy_id,candidate_version);
create index risk_signal_actor_time on risk.signal(actor_id,scope_id,observed_at desc);
create index risk_decision_velocity on risk.decision(actor_id,operation,scope_id,decided_at desc);
create index risk_decision_scope_time on risk.decision(scope_id,decided_at desc,id);
create index risk_case_scope_state on risk.case(scope_id,state,created_at desc,id);
create index risk_case_decision on risk.case(decision_id);
create index risk_listentry_lookup on risk.listentry(scope_id,list_type,token,effective_at,expires_at);

create or replace function risk.scope_allowed(p_scope text) returns boolean language sql stable security definer
set search_path=risk,access,pg_temp as $function$
  select access.scope_allowed(p_scope) or (p_scope='identity' and nullif(current_setting('app.scope_id',true),'')='organization-platform-root')
$function$;
revoke all on function risk.scope_allowed(text) from public;
grant execute on function risk.scope_allowed(text) to shopapp;

create or replace function risk.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=risk,pg_temp as $function$
  select scope_id from (
    select scope_id,1 priority from risk.policy where id=p_resource
    union all select scope_id,2 priority from risk.case where id=p_resource
  ) candidate order by priority limit 1
$function$;
revoke all on function risk.resource_scope(text) from public;

do $rewrite$ declare definition text; replaced text; begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  replaced:=replace(definition,'select scope_id into resolved from risk.case where id=p_resource',
    'select risk.resource_scope(p_resource) into resolved');
  if replaced=definition then raise exception 'ACCESS_RESOURCE_SCOPE_RISK_REWRITE_FAILED'; end if;
  execute replaced;
end $rewrite$;

drop policy appscope on risk.policy;
drop policy appscope on risk.policyversion;
drop policy appscope on risk.replay;
drop policy appscope on risk.signal;
drop policy appscope on risk.decision;
drop policy appscope on risk.case;
drop policy appscope on risk.listentry;

create policy appselect on risk.policy for select to shopapp using(risk.scope_allowed(scope_id));
create policy appinsert on risk.policy for insert to shopapp with check(risk.scope_allowed(scope_id));
create policy appupdate on risk.policy for update to shopapp using(risk.scope_allowed(scope_id)) with check(risk.scope_allowed(scope_id));
create policy appselect on risk.policyversion for select to shopapp using(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy appinsert on risk.policyversion for insert to shopapp with check(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy appupdate on risk.policyversion for update to shopapp using(exists(select 1 from risk.policy policy where policy.id=policy_id))
  with check(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy appselect on risk.replay for select to shopapp using(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy appinsert on risk.replay for insert to shopapp with check(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy appupdate on risk.replay for update to shopapp using(exists(select 1 from risk.policy policy where policy.id=policy_id))
  with check(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy appselect on risk.signal for select to shopapp using(risk.scope_allowed(scope_id));
create policy appinsert on risk.signal for insert to shopapp with check(risk.scope_allowed(scope_id));
create policy appselect on risk.decision for select to shopapp using(risk.scope_allowed(scope_id));
create policy appinsert on risk.decision for insert to shopapp with check(risk.scope_allowed(scope_id));
create policy appselect on risk.case for select to shopapp using(risk.scope_allowed(scope_id));
create policy appinsert on risk.case for insert to shopapp with check(risk.scope_allowed(scope_id));
create policy appupdate on risk.case for update to shopapp using(risk.scope_allowed(scope_id)) with check(risk.scope_allowed(scope_id));
create policy appselect on risk.listentry for select to shopapp using(risk.scope_allowed(scope_id));
create policy appinsert on risk.listentry for insert to shopapp with check(risk.scope_allowed(scope_id));
create policy appupdate on risk.listentry for update to shopapp using(risk.scope_allowed(scope_id)) with check(risk.scope_allowed(scope_id));

insert into runtime.operation(id,owner,method,path,contract_version)
values('risk.cases.review','risk','PUT','/api/v1/risks/cases/{caseid}','1.0.0');
insert into capability.capability(id,kind,name,version,status)
values('risk.cases.review','operation','risk.cases.review',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('risk.cases.review','risk.cases.review','risk.manage','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:risk.cases.review','organization-platform-root','risk.cases.review','enabled',null,'1970-01-01T00:00:00Z',null,0);

insert into runtime.event(type,version,owner,schema_ref) values
  ('catalog.listing.unpublished',1,'catalog','contract://events/catalog.listing.unpublished/v1'),
  ('risk.case.opened',1,'risk','contract://events/risk.case.opened/v1'),
  ('risk.case.resolved',1,'risk','contract://events/risk.case.resolved/v1'),
  ('risk.transaction.blocked',1,'risk','contract://events/risk.transaction.blocked/v1');

insert into runtime.schemaversion(version,checksum)
values('20260821049000','ce22318c44152a80112731a0f791588176d9e583f8dfa3f7818104a8a171c6e0');

do $assert$ begin
  if (select count(*) from runtime.operation)<>202 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from risk.policy policy join risk.policyversion version on version.policy_id=policy.id
      where policy.active_version=version.version and version.status<>'active') then raise exception 'RISK_ACTIVE_VERSION_STATE_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821049000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
