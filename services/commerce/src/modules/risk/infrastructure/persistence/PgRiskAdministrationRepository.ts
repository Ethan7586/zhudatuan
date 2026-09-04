import type { ContractJsonValue } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RiskAdministrationRepository, RiskCaseRecord, RiskCenterRecord } from '../../application/port/RiskAdministrationRepository';
import { PgRiskPolicyStore } from './PgRiskPolicyStore';

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
        from risk.policyversion version where version.policy_id=policy.id and version.version=policy.next_version-1
          and version.version<>coalesce(policy.active_version,0)
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
    return new PgRiskPolicyStore(this.transactions.database(context)).save(input);
  }

  async activatePolicy(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; candidateVersion: number; rolloutPercent: number; actor: string; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>> | null> {
    return new PgRiskPolicyStore(this.transactions.database(context)).activate(input);
  }

  async retirePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null> {
    return new PgRiskPolicyStore(this.transactions.database(context)).retire(input);
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
      where id=$1 and scope_id=$2 and version=$7
      returning id,scope_id,decision_id,state,outcome,safe_reason,assigned_to,created_at,closed_at,reviewed_by,
        review_reason,review_evidence,reviewed_at,resolution,version`,
      [input.id, input.scope, input.state, input.reviewer, input.reason, JSON.stringify(input.evidence), input.expectedVersion]
    );
    return optional(result.rows[0]);
  }
}

function optional<T extends Record<string, unknown>>(value: T | undefined): Readonly<T> | null {
  return value ? Object.freeze({ ...value }) : null;
}
