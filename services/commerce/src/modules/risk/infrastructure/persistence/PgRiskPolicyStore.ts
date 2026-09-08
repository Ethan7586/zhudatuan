import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { RiskOutcome } from '../../domain/model/RiskPolicy';

/** Owns policy-version persistence so administration and replay share one immutable version model. */
export class PgRiskPolicyStore {
  constructor(private readonly database: SqlExecutor) {}

  async save(input: Readonly<{ id: string; scope: string; name: string; rule: unknown; ruleHash: string; rolloutPercent: number; actor: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `with target as(
      insert into risk.policy(id,scope_id,name,active_version,baseline_version,status,next_version,updated_at,version)
        select $1,$2,$3,null,null,'draft',2,clock_timestamp(),1 where $8=0
      on conflict(id) do update set name=excluded.name,next_version=risk.policy.next_version+1,
        updated_at=clock_timestamp(),version=risk.policy.version+1
        where risk.policy.scope_id=$2 and risk.policy.version=$8
        returning id,scope_id,name,active_version,baseline_version,status,next_version,updated_at,version),
      candidate as(select id,scope_id,name,active_version,status,baseline_version,updated_at,next_version,next_version-1 candidate_version,version from target),
      policyversion as(insert into risk.policyversion(policy_id,version,rule,rule_hash,rollout_percent,status,created_by,created_at)
        select id,candidate_version,$4::jsonb,$5,$6,'candidate',$7,clock_timestamp() from candidate
        returning policy_id,version,rule_hash,rollout_percent),
      replay as(insert into risk.replay(policy_id,candidate_version,state,created_at)
        select policy_id,version,'queued',clock_timestamp() from policyversion returning policy_id,candidate_version,state)
      select candidate.id,candidate.scope_id,candidate.name,candidate.status,candidate.active_version,policyversion.version candidate_version,
        policyversion.rule_hash,policyversion.rollout_percent,replay.state replay_state,candidate.version
      from candidate join policyversion on policyversion.policy_id=candidate.id and policyversion.version=candidate.candidate_version
      join replay on replay.policy_id=policyversion.policy_id and replay.candidate_version=policyversion.version`,
      [input.id, input.scope, input.name, JSON.stringify(input.rule), input.ruleHash, input.rolloutPercent, input.actor, input.expectedVersion]
    );
    return optional(result.rows[0]);
  }

  async activate(input: Readonly<{ id: string; scope: string; candidateVersion: number; rolloutPercent: number; actor: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `with candidate as(
        select policyversion.policy_id,policyversion.version,policyversion.rollout_percent,policyversion.rule_hash
        from risk.policyversion policyversion join risk.policy policy on policy.id=policyversion.policy_id
        join risk.replay replay on replay.policy_id=policyversion.policy_id and replay.candidate_version=policyversion.version
        where policy.id=$1 and policy.scope_id=$2 and policyversion.version=$3 and policyversion.rollout_percent=$4
          and policyversion.version=policy.next_version-1 and policyversion.version<>coalesce(policy.active_version,0)
          and policyversion.created_by<>$5 and replay.state='passed' and policy.version=$6
          and(policy.active_version is not null or policyversion.rollout_percent=100)
        for update of policy
      ),
      activated as(
        update risk.policy policy set baseline_version=active_version,active_version=candidate.version,status='active',
          updated_at=clock_timestamp(),version=policy.version+1 from candidate where policy.id=candidate.policy_id
        returning policy.id,policy.scope_id,policy.name,policy.active_version,policy.status,policy.baseline_version,
          policy.updated_at,policy.next_version,policy.version
      )
      select activated.id,activated.scope_id,activated.name,activated.active_version,activated.status,activated.baseline_version,
        activated.updated_at,activated.next_version,candidate.rollout_percent,candidate.rule_hash,activated.version
      from activated join candidate on candidate.policy_id=activated.id`,
      [input.id, input.scope, input.candidateVersion, input.rolloutPercent, input.actor, input.expectedVersion]
    );
    return optional(result.rows[0]);
  }

  async retire(input: Readonly<{ id: string; scope: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `update risk.policy set status='retired',updated_at=clock_timestamp(),version=version+1
      where id=$1 and scope_id=$2 and version=$3 and status in('draft','active')
      returning id,scope_id,name,active_version,status,baseline_version,updated_at,next_version,version`,
      [input.id, input.scope, input.expectedVersion]
    );
    return optional(result.rows[0]);
  }

  async replay(policy: string, version: number): Promise<Readonly<{ scope: string; rule: unknown }> | null> {
    const result = await this.database.query<{ scope: string; rule: unknown }>(
      `update risk.replay replay set state='running',started_at=coalesce(started_at,clock_timestamp())
      from risk.policy policy,risk.policyversion policyversion where replay.policy_id=$1 and replay.candidate_version=$2
      and replay.state in('queued','running') and policy.id=replay.policy_id and policyversion.policy_id=replay.policy_id
      and policyversion.version=replay.candidate_version returning policy.scope_id scope,policyversion.rule`,
      [policy, version]
    );
    return result.rows[0] ?? null;
  }

  async sample(scope: string) {
    const result = await this.database.query<{ actor: string; operation: string; resource: string | null; outcome: RiskOutcome; evidence: Record<string, unknown>; falsePositive: boolean }>(
      `select coalesce(decision.actor_id,'') actor,decision.operation,decision.resource_id resource,decision.outcome,decision.evidence,
      exists(select 1 from risk.case riskcase where riskcase.decision_id=decision.id and riskcase.resolution='cleared') "falsePositive"
      from risk.decision decision where decision.decided_at>=clock_timestamp()-interval '30 days'
      and decision.evidence->'scopeChain'?$1 order by decision.decided_at desc limit 10000`,
      [scope]
    );
    return result.rows;
  }

  async complete(policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void> {
    const changed = finite(preview.changed);
    const sample = finite(preview.sample);
    const falsePositive = finite(preview.falsePositiveRate);
    const state = sample === 0 || (changed / Math.max(1, sample) <= 0.2 && falsePositive <= 0.05) ? 'passed' : 'review';
    await this.database.query(
      `update risk.replay set state=$3,sample_count=$4,changed_count=$5,outcome_counts=$6::jsonb,
      false_positive_rate=$7,preview=$8::jsonb,completed_at=clock_timestamp() where policy_id=$1 and candidate_version=$2`,
      [policy, version, state, sample, changed, JSON.stringify(preview.outcomes), falsePositive, JSON.stringify(preview)]
    );
  }
}

function optional<T extends Record<string, unknown>>(value: T | undefined): Readonly<T> | null {
  return value ? Object.freeze({ ...value }) : null;
}

function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('RISK_REPLAY_PREVIEW_INVALID');
  return value;
}
