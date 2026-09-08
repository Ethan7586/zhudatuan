import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { createHash, randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { RiskCheckInput, RiskPolicyRecord, RiskRepository } from '../../application/port/RiskCheck';
import { RiskAction } from '../../domain/model/RiskAction';
import { signal, type Signal, type SignalSensitivity } from '../../domain/model/Signal';
import type { RiskDecisionDraft } from '../../domain/model/Decision';

interface PolicyRow {
  readonly id: string;
  readonly scope: string;
  readonly activeVersion: number;
  readonly activeRule: unknown;
  readonly activeRollout: number;
  readonly baselineVersion: number | null;
  readonly baselineRule: unknown | null;
}

interface SignalRow {
  readonly type: string;
  readonly version: number;
  readonly amount: number;
  readonly source: string;
  readonly sensitivity: SignalSensitivity;
  readonly observedAt: string;
}

export class PgRiskRepository implements RiskRepository {
  constructor(private readonly database: SqlExecutor) {}

  async policies(scopes: readonly string[]): Promise<readonly RiskPolicyRecord[]> {
    const result = await this.database.query<PolicyRow>(
      `select policy.id,policy.scope_id scope,policy.active_version "activeVersion",
      active.rule "activeRule",active.rollout_percent "activeRollout",policy.baseline_version "baselineVersion",baseline.rule "baselineRule"
      from risk.policy policy join risk.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      left join risk.policyversion baseline on baseline.policy_id=policy.id and baseline.version=policy.baseline_version
      where policy.scope_id=any($1::text[]) and policy.status='active'
      order by array_position($1::text[],policy.scope_id) desc,policy.id`,
      [scopes]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async signals(actor: string, scopes: readonly string[]): Promise<readonly Signal[]> {
    const result = await this.database.query<SignalRow>(
      `with maintenance as(select risk.purgesignals(current_setting('app.scope_id',true),$3) purged)
      select signal.type,signal.version,coalesce((signal.value->>'value')::float8,0) amount,signal.source,signal.sensitivity,
        signal.observed_at "observedAt"
      from risk.signal signal cross join maintenance where signal.actor_id=$1 and signal.scope_id=any($2::text[])
      and signal.observed_at>=clock_timestamp()-interval '24 hours' and signal.retention_until>clock_timestamp()
      and(signal.expires_at is null or signal.expires_at>clock_timestamp())
      order by signal.observed_at desc,signal.id limit 500`,
      [actor, scopes, RUNTIME_LIMITS.cleanup.batch]
    );
    return Object.freeze(result.rows.map((item) => signal({ type: item.type, version: item.version, value: item.amount, source: item.source, sensitivity: item.sensitivity, observedAt: item.observedAt })));
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
      and list_type='block' and token=$2 and effective_at<=clock_timestamp() and(expires_at is null or expires_at>clock_timestamp())) blocked`,
      [scopes, token]
    );
    return result.rows[0]?.blocked === true;
  }

  async decision(input: Readonly<{ check: RiskCheckInput; draft: RiskDecisionDraft; scopeChain: readonly string[] }>): Promise<string> {
    const id = `riskdecision:${randomUUID()}`;
    const evidence = Object.freeze({ ...input.draft.evidence, scopeChain: input.scopeChain });
    await this.database.query(
      `insert into risk.decision(id,scope_id,operation,actor_id,resource_id,policy_id,policy_version,outcome,score,
      safe_reason,evidence,trace_id,decided_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,clock_timestamp())`,
      [
        id,
        input.check.scope,
        input.check.operation,
        input.check.actor,
        input.check.resource,
        input.draft.policy.id,
        input.draft.policy.version,
        input.draft.outcome,
        input.draft.score,
        input.draft.safeReason,
        JSON.stringify(evidence),
        input.check.trace,
      ]
    );
    const runtime = new PgRuntimeWriter(this.database);
    if (input.draft.outcome === 'deny') {
      await runtime.append({
        id: `event:risk:block:${id}`,
        type: 'risk.transaction.blocked',
        aggregateType: 'riskdecision',
        aggregate: id,
        scope: input.check.scope,
        payload: { decision: id, operation: input.check.operation, reason: input.draft.safeReason },
        trace: input.check.trace,
      });
    }
    if (input.draft.outcome === 'review' || input.draft.outcome === 'deny') await this.openCase(id, input);
    if (input.draft.action) await this.requestAction(id, input, runtime);
    return id;
  }

  async defer(input: RiskCheckInput): Promise<string> {
    const id = `riskassessment:${randomUUID()}`;
    const signals = input.signals.map((item) => ({
      type: item.type,
      version: item.version,
      source: item.source,
      sensitivity: item.sensitivity,
      observedAt: item.observedAt,
      ...(item.sensitivity === 'sensitive' ? {} : { value: item.value }),
    }));
    await this.database.query(
      `insert into risk.assessment(id,scope_id,actor_id,operation,resource_id,scope_chain,amount_minor,signals,operation_risk,
      trace_id,state,created_at,expires_at) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,'queued',clock_timestamp(),clock_timestamp()+interval '1 hour')`,
      [id, input.scope, input.actor, input.operation, input.resource, JSON.stringify(input.scopes), input.amountMinor, JSON.stringify(signals), input.risk, input.trace]
    );
    await new PgRuntimeWriter(this.database).schedule({ id: `job:risk:assessment:${id}`, kind: 'riskscan', owner: 'risk', scope: input.scope, payload: { assessment: id }, priority: 10 });
    return id;
  }

  private async requestAction(decision: string, input: Readonly<{ check: RiskCheckInput; draft: RiskDecisionDraft }>, runtime: PgRuntimeWriter): Promise<void> {
    const proposal = input.draft.action;
    if (!proposal) return;
    const id = `riskaction:${randomUUID()}`;
    const state = proposal.approvalRequired ? 'approvalrequired' : 'proposed';
    new RiskAction(id, decision, proposal, state);
    const evidenceHash = createHash('sha256').update(JSON.stringify(input.draft.evidence)).digest('hex');
    await this.database.query(
      `insert into risk.action(id,scope_id,decision_id,kind,target_module,target_type,target_id,rationale,approval_required,state,
      evidence_hash,version,requested_at,updated_at,expires_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '24 hours')`,
      [id, input.check.scope, decision, proposal.kind, proposal.target.module, proposal.target.type, proposal.target.id, proposal.rationale, proposal.approvalRequired, state, evidenceHash]
    );
    await runtime.schedule({ id: `job:risk:action:${id}`, kind: 'riskscan', owner: 'risk', scope: input.check.scope, payload: { action: id }, priority: 5 });
  }

  private async openCase(decision: string, input: Readonly<{ check: RiskCheckInput; draft: RiskDecisionDraft }>): Promise<void> {
    const id = `riskcase:${randomUUID()}`;
    await this.database.query(
      `insert into risk.case(id,scope_id,decision_id,state,outcome,safe_reason,assigned_to,created_at)
      values($1,$2,$3,'open',$4,$5,null,clock_timestamp())`,
      [id, input.check.scope, decision, input.draft.outcome, input.draft.safeReason]
    );
    await new PgRuntimeWriter(this.database).append({
      id: `event:${randomUUID()}`,
      type: 'risk.case.opened',
      aggregateType: 'riskcase',
      aggregate: id,
      scope: input.check.scope,
      payload: { case: id, decision, outcome: input.draft.outcome },
      trace: input.check.trace,
    });
  }
}
