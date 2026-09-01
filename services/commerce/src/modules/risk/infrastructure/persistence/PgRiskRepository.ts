import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { createHash, randomUUID } from 'node:crypto';

import { signal, type Signal } from '../../domain/model/Signal';
import type { RiskOutcome } from '../../domain/model/RiskPolicy';
import type { RiskCheckInput, RiskPolicyRecord, RiskRepository } from '../../application/port/RiskCheck';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

interface PolicyRow {
  readonly id: string;
  readonly scope: string;
  readonly activeVersion: number;
  readonly activeRule: unknown;
  readonly activeRollout: number;
  readonly baselineVersion: number | null;
  readonly baselineRule: unknown | null;
}

export class PgRiskRepository implements RiskRepository {
  constructor(private readonly database: SqlExecutor) {}

  async policies(scopes: readonly string[]): Promise<readonly RiskPolicyRecord[]> {
    const result = await this.database.query<PolicyRow>(
      `select policy.id,policy.scope_id scope,policy.active_version "activeVersion",
      active.rule "activeRule",active.rollout_percent "activeRollout",policy.baseline_version "baselineVersion",baseline.rule "baselineRule"
      from risk.policy policy join risk.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      left join risk.policyversion baseline on baseline.policy_id=policy.id and baseline.version=policy.baseline_version
      where policy.scope_id=any($1::text[]) and policy.status='active' order by array_position($1::text[],policy.scope_id) desc,policy.id`,
      [scopes]
    );
    return result.rows;
  }

  async signals(actor: string, scopes: readonly string[]): Promise<readonly Signal[]> {
    const result = await this.database.query<{ type: string; amount: number; observed_at: string }>(
      `select type,
      coalesce((value->>'value')::float8,0) amount,observed_at from risk.signal where actor_id=$1 and scope_id=any($2::text[])
      and observed_at>=clock_timestamp()-interval '24 hours' and (expires_at is null or expires_at>clock_timestamp()) order by observed_at desc limit 500`,
      [actor, scopes]
    );
    return result.rows.map((item) => signal(item.type, item.amount, item.observed_at));
  }

  async velocities(actor: string, operation: string, scopes: readonly string[], seconds: readonly number[]): Promise<ReadonlyMap<number, number>> {
    const result = await this.database.query<{ seconds: number; count: number }>(
      `select period.seconds,count(decision.id)::integer count
      from unnest($4::integer[]) period(seconds) left join risk.decision decision on decision.actor_id=$1 and decision.operation=$2
        and decision.scope_id=any($3::text[]) and decision.decided_at>=clock_timestamp()-make_interval(secs=>period.seconds)
      group by period.seconds`,
      [actor, operation, scopes, seconds]
    );
    return new Map(result.rows.map((item) => [item.seconds, item.count]));
  }

  async blocked(actor: string, scopes: readonly string[]): Promise<boolean> {
    const token = createHash('sha256').update(actor).digest('hex');
    const result = await this.database.query<{ blocked: boolean }>(
      `select exists(select 1 from risk.listentry where scope_id=any($1::text[])
      and list_type='block' and token=$2 and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) blocked`,
      [scopes, token]
    );
    return result.rows[0]?.blocked === true;
  }

  async decision(input: Readonly<{ check: RiskCheckInput; policy: string; version: number; outcome: RiskOutcome; score: number; safeReason: string; evidence: Readonly<Record<string, unknown>> }>): Promise<string> {
    const id = `riskdecision:${randomUUID()}`;
    await this.database.query(
      `insert into risk.decision(id,scope_id,operation,actor_id,resource_id,policy_id,policy_version,outcome,score,
      safe_reason,evidence,trace_id,decided_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,clock_timestamp())`,
      [id, input.check.scope, input.check.operation, input.check.actor, input.check.resource, input.policy, input.version, input.outcome, input.score, input.safeReason, JSON.stringify(input.evidence), input.check.trace]
    );
    if (input.outcome === 'deny')
      await new PgRuntimeWriter(this.database).append({
        id: `event:risk:block:${id}`,
        type: 'risk.transaction.blocked',
        aggregateType: 'riskdecision',
        aggregate: id,
        scope: input.check.scope,
        payload: { decision: id, operation: input.check.operation, reason: input.safeReason },
        trace: input.check.trace,
      });
    if (input.outcome === 'review' || input.outcome === 'deny') await this.openCase(id, input);
    if (input.outcome === 'deny' && input.check.resource && input.check.operation.startsWith('catalog.listings.')) {
      await new PgRuntimeWriter(this.database).schedule({ id: `job:risk:catalog:${id}`, kind: 'riskscan', owner: 'risk', scope: input.check.scope, payload: { catalogDecision: id }, priority: 1 });
    }
    return id;
  }

  async center(scope: string, cursor: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const result = await this.database.query(
      `select center.id,center.kind,center.name,center.status,center.active_version,
      center.baseline_version,center.rollout_percent,center.rule_hash,center.rule,center.candidate_version,center.candidate_rollout,
      center.candidate_hash,center.candidate_rule,center.replay_state,center.sample_count,center.changed_count,
      center.false_positive_rate,center.preview,center.decision_id,center.outcome,center.safe_reason,center.actor_id,center.score,
      center.evidence,center.created_at from (
      select policy.id,'policy' kind,policy.name,policy.status,policy.active_version,policy.baseline_version,active.rollout_percent,
        active.rule_hash,active.rule,candidate.version candidate_version,candidate.rollout_percent candidate_rollout,candidate.rule_hash candidate_hash,
        candidate.rule candidate_rule,replay.state replay_state,replay.sample_count,replay.changed_count,replay.false_positive_rate,replay.preview,
        null::text decision_id,null::text outcome,null::text safe_reason,null::text actor_id,null::integer score,null::jsonb evidence,null::timestamptz created_at
      from risk.policy policy left join risk.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      left join lateral(select version.policy_id,version.version,version.rule,version.rule_hash,version.rollout_percent,
        version.status,version.created_by,version.created_at from risk.policyversion version
        where version.policy_id=policy.id and version.status='candidate'
        order by version.version desc limit 1) candidate on true
      left join risk.replay replay on replay.policy_id=candidate.policy_id and replay.candidate_version=candidate.version
      where risk.scope_allowed(policy.scope_id) and $1=current_setting('app.scope_id',true)
      union all
      select riskcase.id,'case',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,riskcase.decision_id,riskcase.outcome,riskcase.safe_reason,
        decision.actor_id,decision.score,jsonb_build_object('decision',decision.evidence,'review',riskcase.review_evidence),riskcase.created_at
      from risk.case riskcase join risk.decision decision on decision.id=riskcase.decision_id
      where risk.scope_allowed(riskcase.scope_id) and $1=current_setting('app.scope_id',true)) center
      where ($2::text is null or center.id>$2) order by center.id limit $3`,
      [scope, cursor, fetch]
    );
    return result.rows;
  }

  async savePolicy(input: Readonly<{ id: string; scope: string; name: string; rule: unknown; ruleHash: string; rolloutPercent: number; actor: string }>): Promise<Readonly<Record<string, unknown>>> {
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

  async activatePolicy(input: Readonly<{ id: string; scope: string; version: number; rolloutPercent: number; actor: string; trace: string }>): Promise<Readonly<Record<string, unknown>>> {
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

  async retirePolicy(id: string, scope: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.database.query(
      `with retired as(update risk.policy set status='retired',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and status in('draft','active') returning *), version as(update risk.policyversion version set status='retired'
      from retired where version.policy_id=retired.id and version.version=retired.active_version)
      select id,scope_id,name,active_version,status,baseline_version,updated_at,next_version from retired`,
      [id, scope]
    );
    return required(result.rows[0], 'RISK_POLICY_NOT_RETIRABLE');
  }

  async riskCase(id: string, scope: string) {
    const result = await this.database.query<{ id: string; state: 'open' | 'reviewing' | 'cleared' | 'confirmed' | 'closed'; actor: string | null }>(
      `select riskcase.id,
      riskcase.state,decision.actor_id actor from risk.case riskcase join risk.decision decision on decision.id=riskcase.decision_id
      where riskcase.id=$1 and riskcase.scope_id=$2 for update`,
      [id, scope]
    );
    return result.rows[0] ?? null;
  }

  async reviewCase(input: Readonly<{ id: string; scope: string; state: string; reviewer: string; reason: string; evidence: Readonly<Record<string, unknown>>; trace: string }>): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.database.query(
      `update risk.case set state=$3,resolution=case when $3 in('cleared','confirmed') then $3 else resolution end,
      assigned_to=coalesce(assigned_to,$4),reviewed_by=$4,review_reason=$5,
      review_evidence=$6::jsonb,reviewed_at=clock_timestamp(),closed_at=case when $3='closed' then clock_timestamp() else closed_at end
      where id=$1 and scope_id=$2 returning *`,
      [input.id, input.scope, input.state, input.reviewer, input.reason, JSON.stringify(input.evidence)]
    );
    const reviewed = required(result.rows[0], 'RISK_CASE_REVIEW_FAILED');
    if (input.state === 'cleared' || input.state === 'confirmed' || input.state === 'closed')
      await new PgRuntimeWriter(this.database).append({
        id: `event:${randomUUID()}`,
        type: 'risk.case.resolved',
        aggregateType: 'riskcase',
        aggregate: input.id,
        scope: input.scope,
        payload: { case: input.id, state: input.state },
        trace: input.trace,
      });
    return reviewed;
  }

  async replay(policy: string, version: number): Promise<Readonly<{ scope: string; rule: unknown }> | null> {
    const result = await this.database.query<{ scope: string; rule: unknown }>(
      `update risk.replay replay set state='running',
      started_at=coalesce(started_at,clock_timestamp()) from risk.policy policy,risk.policyversion version
      where replay.policy_id=$1 and replay.candidate_version=$2 and replay.state in('queued','running') and policy.id=replay.policy_id
      and version.policy_id=replay.policy_id and version.version=replay.candidate_version returning policy.scope_id scope,version.rule`,
      [policy, version]
    );
    return result.rows[0] ?? null;
  }

  async replaySample(scope: string) {
    const result = await this.database.query<{ actor: string; operation: string; outcome: RiskOutcome; evidence: Record<string, unknown>; falsePositive: boolean }>(
      `select coalesce(decision.actor_id,'') actor,decision.operation,decision.outcome,decision.evidence,
      exists(select 1 from risk.case riskcase where riskcase.decision_id=decision.id and riskcase.resolution='cleared') "falsePositive"
      from risk.decision decision where decision.decided_at>=clock_timestamp()-interval '30 days'
      and decision.evidence->'scopeChain'?$1 order by decision.decided_at desc limit 10000`,
      [scope]
    );
    return result.rows;
  }

  async completeReplay(policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void> {
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

  async catalogDecision(decision: string): Promise<Readonly<{ decision: string; scope: string; resource: string }> | null> {
    const result = await this.database.query<{ decision: string; scope: string; resource: string }>(
      `select id decision,scope_id scope,resource_id resource
      from risk.decision where id=$1 and outcome='deny' and operation like 'catalog.listings.%' and resource_id is not null`,
      [decision]
    );
    return result.rows[0] ?? null;
  }

  private async openCase(decision: string, input: Readonly<{ check: RiskCheckInput; policy: string; version: number; outcome: RiskOutcome; score: number; safeReason: string }>): Promise<void> {
    const id = `riskcase:${randomUUID()}`;
    await this.database.query(
      `insert into risk.case(id,scope_id,decision_id,state,outcome,safe_reason,assigned_to,created_at)
      values($1,$2,$3,'open',$4,$5,null,clock_timestamp())`,
      [id, input.check.scope, decision, input.outcome, input.safeReason]
    );
    await new PgRuntimeWriter(this.database).append({
      id: `event:${randomUUID()}`,
      type: 'risk.case.opened',
      aggregateType: 'riskcase',
      aggregate: id,
      scope: input.check.scope,
      payload: { case: id, decision, outcome: input.outcome },
      trace: input.check.trace,
    });
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
