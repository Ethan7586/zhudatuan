import type { ContractJsonValue } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RiskAdministrationRepository, RiskCaseRecord, RiskCenterRecord } from '../../application/port/RiskAdministrationRepository';

export class PgRiskAdministrationRepository implements RiskAdministrationRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async center(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number): Promise<readonly RiskCenterRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<RiskCenterRecord>(
      `select center.id,center.kind,center.version,center.name,center.status,
      center.active_version,center.baseline_version,center.rollout_percent,center.rule_hash,center.rule,center.candidate_version,
      center.candidate_rollout,center.candidate_hash,center.candidate_rule,center.replay_state,center.sample_count,center.changed_count,
      center.false_positive_rate,center.preview,center.decision_id,center.outcome,center.case_state,center.safe_reason,center.actor_id,
      null::text actor_display_name,null::text actor_mobile_masked,center.score,
      center.evidence,center.created_at from (
      select policy.id,'policy' kind,policy.version,policy.name,policy.status,policy.active_version,policy.baseline_version,active.rollout_percent,
        active.rule_hash,active.rule,candidate.version candidate_version,candidate.rollout_percent candidate_rollout,candidate.rule_hash candidate_hash,
        candidate.rule candidate_rule,replay.state replay_state,replay.sample_count,replay.changed_count,replay.false_positive_rate,replay.preview,
        null::text decision_id,null::text outcome,null::text case_state,null::text safe_reason,null::text actor_id,null::integer score,null::jsonb evidence,null::timestamptz created_at
      from risk.policy policy left join risk.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      left join lateral(select version.policy_id,version.version,version.rollout_percent,version.rule_hash,version.rule
        from risk.policyversion version where version.policy_id=policy.id and version.status='candidate'
        order by version.version desc limit 1) candidate on true
      left join risk.replay replay on replay.policy_id=candidate.policy_id and replay.candidate_version=candidate.version
      where risk.scope_allowed(policy.scope_id) and $1=current_setting('app.scope_id',true)
      union all
      select riskcase.id,'case',riskcase.version,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,riskcase.decision_id,riskcase.outcome,riskcase.state,riskcase.safe_reason,
        decision.actor_id,decision.score,jsonb_build_object('decision',decision.evidence,'review',riskcase.review_evidence),riskcase.created_at
      from risk.case riskcase join risk.decision decision on decision.id=riskcase.decision_id
      where risk.scope_allowed(riskcase.scope_id) and $1=current_setting('app.scope_id',true)) center
      where ($2::text is null or center.id>$2) order by center.id limit $3`,
      [scope, cursor, fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }

  async savePolicy(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; name: string; rule: ContractJsonValue; ruleHash: string; rolloutPercent: number; actor: string; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<Record<string, unknown>>(
      `with target as(
      insert into risk.policy(id,scope_id,name,active_version,baseline_version,status,next_version,updated_at,version)
        select $1,$2,$3,null,null,'draft',2,clock_timestamp(),1 where $8=0
      on conflict(id) do update set name=excluded.name,next_version=risk.policy.next_version+1,
        updated_at=clock_timestamp(),version=risk.policy.version+1
        where risk.policy.scope_id=$2 and risk.policy.version=$8 returning *),
      candidate as(select target.id,target.scope_id,target.name,target.active_version,target.status,target.baseline_version,
        target.updated_at,target.next_version,target.next_version-1 candidate_version,target.version from target),
      policyversion as(insert into risk.policyversion(policy_id,version,rule,rule_hash,rollout_percent,status,created_by,created_at)
        select id,candidate_version,$4::jsonb,$5,$6,'candidate',$7,clock_timestamp() from candidate returning *),
      replay as(insert into risk.replay(policy_id,candidate_version,state,created_at)
        select policy_id,version,'queued',clock_timestamp() from policyversion returning *)
      select candidate.id,candidate.scope_id,candidate.name,candidate.status,candidate.active_version,policyversion.version candidate_version,
        policyversion.rule_hash,policyversion.rollout_percent,replay.state replay_state,candidate.version
      from candidate join policyversion on policyversion.policy_id=candidate.id and policyversion.version=candidate.candidate_version
      join replay on replay.policy_id=policyversion.policy_id and replay.candidate_version=policyversion.version`,
      [input.id, input.scope, input.name, JSON.stringify(input.rule), input.ruleHash, input.rolloutPercent, input.actor, input.expectedVersion]
    );
    return optional(result.rows[0]);
  }

  async activatePolicy(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; candidateVersion: number; rolloutPercent: number; actor: string; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<Record<string, unknown>>(
      `with candidate as(select policyversion.policy_id,policyversion.version from risk.policyversion policyversion
      join risk.policy policy on policy.id=policyversion.policy_id join risk.replay replay on replay.policy_id=policyversion.policy_id
        and replay.candidate_version=policyversion.version where policy.id=$1 and policy.scope_id=$2 and policyversion.version=$3
        and policyversion.status='candidate' and policyversion.version=policy.next_version-1 and policyversion.created_by<>$5
        and replay.state='passed' and policy.version=$6 and(policy.active_version is not null or $4=100) for update of policy,policyversion),
      retired as(update risk.policyversion previous set status='retired' from candidate,risk.policy policy
        where policy.id=candidate.policy_id and previous.policy_id=policy.id and previous.version=policy.baseline_version),
      baseline as(update risk.policyversion previous set status='baseline' from candidate,risk.policy policy
        where policy.id=candidate.policy_id and previous.policy_id=policy.id and previous.version=policy.active_version),
      activated as(update risk.policy policy set baseline_version=active_version,active_version=candidate.version,status='active',
        updated_at=clock_timestamp(),version=policy.version+1 from candidate where policy.id=candidate.policy_id returning policy.*),
      version as(update risk.policyversion version set rollout_percent=$4,status='active' from candidate
        where version.policy_id=candidate.policy_id and version.version=candidate.version returning version.*)
      select activated.id,activated.scope_id,activated.name,activated.active_version,activated.status,activated.baseline_version,
        activated.updated_at,activated.next_version,version.rollout_percent,version.rule_hash,activated.version
      from activated join version on version.policy_id=activated.id`,
      [input.id, input.scope, input.candidateVersion, input.rolloutPercent, input.actor, input.expectedVersion]
    );
    return optional(result.rows[0]);
  }

  async retirePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<Record<string, unknown>>(
      `with retired as(update risk.policy set status='retired',updated_at=clock_timestamp(),version=version+1
      where id=$1 and scope_id=$2 and version=$3 and status in('draft','active') returning *), archived as(update risk.policyversion version set status='retired'
      from retired where version.policy_id=retired.id and version.version=retired.active_version)
      select id,scope_id,name,active_version,status,baseline_version,updated_at,next_version,version from retired`,
      [input.id, input.scope, input.expectedVersion]
    );
    return optional(result.rows[0]);
  }

  async riskCase(context: WriteTransactionContext, id: string, scope: string): Promise<RiskCaseRecord | null> {
    const database = this.transactions.database(context);
    const result = await database.query<RiskCaseRecord & Record<string, unknown>>(
      `select riskcase.id,riskcase.state,riskcase.version,decision.actor_id actor from risk.case riskcase
      join risk.decision decision on decision.id=riskcase.decision_id where riskcase.id=$1 and riskcase.scope_id=$2 for update`,
      [id, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, state: row.state, actor: row.actor, version: row.version }) : null;
  }

  async reviewCase(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; state: string; reviewer: string; reason: string; evidence: Readonly<Record<string, unknown>>; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<Record<string, unknown>>(
      `update risk.case set state=$3,resolution=case when $3 in('cleared','confirmed') then $3 else resolution end,
      assigned_to=coalesce(assigned_to,$4),reviewed_by=$4,review_reason=$5,review_evidence=$6::jsonb,
      reviewed_at=clock_timestamp(),closed_at=case when $3='closed' then clock_timestamp() else closed_at end,version=version+1
      where id=$1 and scope_id=$2 and version=$7 returning *`,
      [input.id, input.scope, input.state, input.reviewer, input.reason, JSON.stringify(input.evidence), input.expectedVersion]
    );
    return optional(result.rows[0]);
  }
}

function optional<T extends Record<string, unknown>>(value: T | undefined): Readonly<T> | null {
  return value ? Object.freeze({ ...value }) : null;
}
