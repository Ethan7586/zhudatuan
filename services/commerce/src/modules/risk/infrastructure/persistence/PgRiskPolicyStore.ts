import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { RiskOutcome } from '../../domain/model/RiskPolicy';

export class PgRiskPolicyStore {
  constructor(private readonly database: SqlExecutor) {}

  async save(input: Readonly<{ id: string; scope: string; name: string; rule: unknown; ruleHash: string; rolloutPercent: number; actor: string }>): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.database.query(
      `with target as(
      insert into risk.policy(id,scope_id,name,active_version,baseline_version,status,next_version,updated_at)
        values($1,$2,$3,null,null,'draft',2,clock_timestamp())
      on conflict(id) do update set name=excluded.name,next_version=risk.policy.next_version+1,updated_at=clock_timestamp()
        where risk.policy.scope_id=$2 returning *),
      candidate as(select target.id,target.scope_id,target.name,target.active_version,target.status,target.baseline_version,
        target.updated_at,target.next_version,target.next_version-1 candidate_version from target),
      version as(insert into risk.policyversion(policy_id,version,rule,rule_hash,rollout_percent,status,created_by,created_at)
        select id,candidate_version,$4::jsonb,$5,$6,'candidate',$7,clock_timestamp() from candidate returning *),
      replay as(insert into risk.replay(policy_id,candidate_version,state,created_at) select policy_id,version,'queued',clock_timestamp() from version returning *)
      select candidate.id,candidate.scope_id,candidate.name,candidate.status,candidate.active_version,version.version candidate_version,
        version.rule_hash,version.rollout_percent,replay.state replay_state from candidate join version on version.policy_id=candidate.id
        and version.version=candidate.candidate_version join replay on replay.policy_id=version.policy_id and replay.candidate_version=version.version`,
      [input.id, input.scope, input.name, JSON.stringify(input.rule), input.ruleHash, input.rolloutPercent, input.actor]
    );
    const saved = required(result.rows[0] as Readonly<Record<string, unknown>> | undefined, 'RISK_POLICY_SAVE_FAILED');
    const version = Number(saved.candidate_version);
    if (!Number.isSafeInteger(version)) throw new Error('RISK_POLICY_VERSION_INVALID');
    await new PgRuntimeWriter(this.database).schedule({ id: `job:${randomUUID()}`, kind: 'riskscan', owner: 'risk', scope: input.scope, payload: { policy: input.id, version }, priority: 20 });
    return saved;
  }

  async activate(input: Readonly<{ id: string; scope: string; version: number; rolloutPercent: number; actor: string; trace: string }>): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.database.query(
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
        activated.updated_at,activated.next_version,version.rollout_percent,version.rule_hash
        from activated join version on version.policy_id=activated.id`,
      [input.id, input.scope, input.version, input.rolloutPercent, input.actor]
    );
    const activated = required(result.rows[0], 'RISK_POLICY_ACTIVATION_NOT_ALLOWED');
    await new PgRuntimeWriter(this.database).append({
      id: `event:${randomUUID()}`,
      type: 'risk.policy.activated',
      aggregateType: 'riskpolicy',
      aggregate: input.id,
      scope: input.scope,
      payload: { policy: input.id, version: input.version, rolloutPercent: input.rolloutPercent },
      trace: input.trace,
    });
    return activated;
  }

  async retire(id: string, scope: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.database.query(
      `with retired as(update risk.policy set status='retired',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and status in('draft','active') returning *), version as(update risk.policyversion version set status='retired'
      from retired where version.policy_id=retired.id and version.version=retired.active_version)
      select id,scope_id,name,active_version,status,baseline_version,updated_at,next_version from retired`,
      [id, scope]
    );
    return required(result.rows[0], 'RISK_POLICY_NOT_RETIRABLE');
  }

  async replay(policy: string, version: number): Promise<Readonly<{ scope: string; rule: unknown }> | null> {
    const result = await this.database.query<{ scope: string; rule: unknown }>(
      `update risk.replay replay set state='running',started_at=coalesce(started_at,clock_timestamp())
      from risk.policy policy,risk.policyversion version where replay.policy_id=$1 and replay.candidate_version=$2
      and replay.state in('queued','running') and policy.id=replay.policy_id and version.policy_id=replay.policy_id
      and version.version=replay.candidate_version returning policy.scope_id scope,version.rule`,
      [policy, version]
    );
    return result.rows[0] ?? null;
  }

  async sample(scope: string) {
    const result = await this.database.query<{ actor: string; operation: string; outcome: RiskOutcome; evidence: Record<string, unknown>; falsePositive: boolean }>(
      `select coalesce(decision.actor_id,'') actor,decision.operation,decision.outcome,decision.evidence,
      exists(select 1 from risk.case riskcase where riskcase.decision_id=decision.id and riskcase.resolution='cleared') "falsePositive"
      from risk.decision decision where decision.decided_at>=clock_timestamp()-interval '30 days'
      and decision.evidence->'scopeChain'?$1 order by decision.decided_at desc limit 10000`,
      [scope]
    );
    return result.rows;
  }

  async complete(policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void> {
    const changed = number(preview.changed);
    const sample = number(preview.sample);
    const falsePositive = number(preview.falsePositiveRate);
    const state = sample === 0 || (changed / Math.max(1, sample) <= 0.2 && falsePositive <= 0.05) ? 'passed' : 'review';
    await this.database.query(
      `update risk.replay set state=$3,sample_count=$4,changed_count=$5,outcome_counts=$6::jsonb,
      false_positive_rate=$7,preview=$8::jsonb,completed_at=clock_timestamp() where policy_id=$1 and candidate_version=$2`,
      [policy, version, state, sample, changed, JSON.stringify(preview.outcomes), falsePositive, JSON.stringify(preview)]
    );
  }
}

function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('RISK_REPLAY_PREVIEW_INVALID');
  return value;
}
