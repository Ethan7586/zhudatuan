import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { createHash, randomUUID } from 'node:crypto';

import { signal, type Signal } from '../../domain/model/Signal';
import type { RiskOutcome } from '../../domain/model/RiskPolicy';
import type { RiskCheckInput, RiskPolicyRecord, RiskRepository } from '../../application/port/RiskCheck';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgRiskPolicyStore } from './PgRiskPolicyStore';

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
  private readonly policyStore: PgRiskPolicyStore;
  constructor(private readonly database: SqlExecutor) {
    this.policyStore = new PgRiskPolicyStore(database);
  }

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
    return this.policyStore.save(input);
  }

  async activatePolicy(input: Readonly<{ id: string; scope: string; version: number; rolloutPercent: number; actor: string; trace: string }>): Promise<Readonly<Record<string, unknown>>> {
    return this.policyStore.activate(input);
  }

  async retirePolicy(id: string, scope: string): Promise<Readonly<Record<string, unknown>>> {
    return this.policyStore.retire(id, scope);
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
    return this.policyStore.replay(policy, version);
  }

  async replaySample(scope: string) {
    return this.policyStore.sample(scope);
  }

  async completeReplay(policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void> {
    return this.policyStore.complete(policy, version, preview);
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
