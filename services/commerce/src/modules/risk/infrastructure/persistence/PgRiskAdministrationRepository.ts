import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ContractJsonValue } from '@shop/contract';
import type { RiskAdministrationRepository, RiskCaseRecord, RiskCenterRecord } from '../../application/port/RiskAdministrationRepository';
export class PgRiskAdministrationRepository implements RiskAdministrationRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async center(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number): Promise<readonly RiskCenterRecord[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<RiskCenterRecord>(
      `select center.id,center.kind,center.name,center.status,
      center.active_version,center.baseline_version,center.rollout_percent,center.rule_hash,center.rule,center.candidate_version,
      center.candidate_rollout,center.candidate_hash,center.candidate_rule,center.replay_state,center.sample_count,center.changed_count,
      center.false_positive_rate,center.preview,center.decision_id,center.outcome,center.safe_reason,center.actor_id,
      actorprofile.display_name actor_display_name,actorprofile.mobile_masked actor_mobile_masked,center.score,
      center.evidence,center.created_at from (
      select policy.id,'policy' kind,policy.name,policy.status,policy.active_version,policy.baseline_version,active.rollout_percent,
        active.rule_hash,active.rule,candidate.version candidate_version,candidate.rollout_percent candidate_rollout,candidate.rule_hash candidate_hash,
        candidate.rule candidate_rule,replay.state replay_state,replay.sample_count,replay.changed_count,replay.false_positive_rate,replay.preview,
        null::text decision_id,null::text outcome,null::text safe_reason,null::text actor_id,null::integer score,null::jsonb evidence,null::timestamptz created_at
      from risk.policy policy left join risk.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      left join lateral(select version.policy_id,version.version,version.rollout_percent,version.rule_hash,version.rule
        from risk.policyversion version where version.policy_id=policy.id and version.status='candidate'
        order by version.version desc limit 1) candidate on true
      left join risk.replay replay on replay.policy_id=candidate.policy_id and replay.candidate_version=candidate.version
      where risk.scope_allowed(policy.scope_id) and $1=current_setting('app.scope_id',true)
      union all
      select riskcase.id,'case',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,riskcase.decision_id,riskcase.outcome,riskcase.safe_reason,
        decision.actor_id,decision.score,jsonb_build_object('decision',decision.evidence,'review',riskcase.review_evidence),riskcase.created_at
      from risk.case riskcase join risk.decision decision on decision.id=riskcase.decision_id
      where risk.scope_allowed(riskcase.scope_id) and $1=current_setting('app.scope_id',true)) center
      left join member.profile actorprofile on actorprofile.principal_id=center.actor_id
      where ($2::text is null or center.id>$2) order by center.id limit $3`,
      [scope, cursor, fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async savePolicy(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      name: string;
      rule: ContractJsonValue;
      ruleHash: string;
      rolloutPercent: number;
      actor: string;
    }>
  ): Promise<Readonly<Record<string, unknown>>> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<Record<string, unknown>>(
      `with target as(
      insert into risk.policy(id,scope_id,name,active_version,baseline_version,status,next_version,updated_at)
        values($1,$2,$3,null,null,'draft',2,clock_timestamp())
      on conflict(id) do update set name=excluded.name,next_version=risk.policy.next_version+1,updated_at=clock_timestamp()
        where risk.policy.scope_id=$2 returning *),
      candidate as(select target.id,target.scope_id,target.name,target.active_version,target.status,target.baseline_version,
        target.updated_at,target.next_version,target.next_version-1 candidate_version from target),
      version as(insert into risk.policyversion(policy_id,version,rule,rule_hash,rollout_percent,status,created_by,created_at)
        select id,candidate_version,$4::jsonb,$5,$6,'candidate',$7,clock_timestamp() from candidate returning *),
      replay as(insert into risk.replay(policy_id,candidate_version,state,created_at)
        select policy_id,version,'queued',clock_timestamp() from version returning *)
      select candidate.id,candidate.scope_id,candidate.name,candidate.status,candidate.active_version,version.version candidate_version,
        version.rule_hash,version.rollout_percent,replay.state replay_state from candidate join version on version.policy_id=candidate.id
        and version.version=candidate.candidate_version join replay on replay.policy_id=version.policy_id and replay.candidate_version=version.version`,
      [input.id, input.scope, input.name, JSON.stringify(input.rule), input.ruleHash, input.rolloutPercent, input.actor]
    );
    return required(result.rows[0], 'RISK_POLICY_SAVE_FAILED');
  }
  async activatePolicy(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      version: number;
      rolloutPercent: number;
      actor: string;
    }>
  ): Promise<Readonly<Record<string, unknown>>> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<Record<string, unknown>>(
      `with candidate as(select version.policy_id,version.version from risk.policyversion version
      join risk.policy policy on policy.id=version.policy_id join risk.replay replay on replay.policy_id=version.policy_id
        and replay.candidate_version=version.version where policy.id=$1 and policy.scope_id=$2 and version.version=$3
        and version.status='candidate' and version.version=policy.next_version-1 and version.created_by<>$5 and replay.state='passed'
        and (policy.active_version is not null or $4=100) for update of policy,version),
      retired as(update risk.policyversion previous set status='retired' from candidate,risk.policy policy
        where policy.id=candidate.policy_id and previous.policy_id=policy.id and previous.version=policy.baseline_version),
      baseline as(update risk.policyversion previous set status='baseline' from candidate,risk.policy policy
        where policy.id=candidate.policy_id and previous.policy_id=policy.id and previous.version=policy.active_version),
      activated as(update risk.policy policy set baseline_version=active_version,active_version=candidate.version,status='active',updated_at=clock_timestamp()
        from candidate where policy.id=candidate.policy_id returning policy.*),
      version as(update risk.policyversion version set rollout_percent=$4,status='active' from candidate
        where version.policy_id=candidate.policy_id and version.version=candidate.version returning version.*)
      select activated.id,activated.scope_id,activated.name,activated.active_version,activated.status,activated.baseline_version,
        activated.updated_at,activated.next_version,version.rollout_percent,version.rule_hash from activated join version on version.policy_id=activated.id`,
      [input.id, input.scope, input.version, input.rolloutPercent, input.actor]
    );
    return required(result.rows[0], 'RISK_POLICY_ACTIVATION_NOT_ALLOWED');
  }
  async retirePolicy(context: WriteTransactionContext, id: string, scope: string): Promise<Readonly<Record<string, unknown>>> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<Record<string, unknown>>(
      `with retired as(update risk.policy set status='retired',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and status in('draft','active') returning *), version as(update risk.policyversion version set status='retired'
      from retired where version.policy_id=retired.id and version.version=retired.active_version)
      select id,scope_id,name,active_version,status,baseline_version,updated_at,next_version from retired`,
      [id, scope]
    );
    return required(result.rows[0], 'RISK_POLICY_NOT_RETIRABLE');
  }
  async riskCase(context: WriteTransactionContext, id: string, scope: string): Promise<RiskCaseRecord | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<RiskCaseRecord & Record<string, unknown>>(
      `select riskcase.id,riskcase.state,decision.actor_id actor from risk.case riskcase
      join risk.decision decision on decision.id=riskcase.decision_id where riskcase.id=$1 and riskcase.scope_id=$2 for update`,
      [id, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, state: row.state, actor: row.actor }) : null;
  }
  async reviewCase(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      state: string;
      reviewer: string;
      reason: string;
      evidence: Readonly<Record<string, unknown>>;
    }>
  ): Promise<Readonly<Record<string, unknown>>> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<Record<string, unknown>>(
      `update risk.case set state=$3,resolution=case when $3 in('cleared','confirmed') then $3 else resolution end,
      assigned_to=coalesce(assigned_to,$4),reviewed_by=$4,review_reason=$5,review_evidence=$6::jsonb,
      reviewed_at=clock_timestamp(),closed_at=case when $3='closed' then clock_timestamp() else closed_at end
      where id=$1 and scope_id=$2 returning *`,
      [input.id, input.scope, input.state, input.reviewer, input.reason, JSON.stringify(input.evidence)]
    );
    return required(result.rows[0], 'RISK_CASE_REVIEW_FAILED');
  }
}
function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return Object.freeze({ ...value });
}
