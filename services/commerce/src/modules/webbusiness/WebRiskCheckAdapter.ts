import { createHash } from 'node:crypto';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { RiskAssessment, RiskGate } from '../../foundation/security/RiskGate';
import { applyApiDatabaseContext } from '../../foundation/infrastructure/DatabaseContext';
import { OUTCOME_SEVERITY } from '../risk/domain/model/Decision';
import { RiskPolicy, type RiskOutcome } from '../risk/domain/model/RiskPolicy';
import { signal } from '../risk/domain/model/Signal';
import { RiskEngine } from '../risk/domain/policy/RiskEngine';

interface PolicyRow {
  readonly id: string;
  readonly activeVersion: number;
  readonly activeRule: unknown;
  readonly activeRollout: number;
  readonly baselineVersion: number | null;
  readonly baselineRule: unknown | null;
}

/**
 * WebBusiness evaluates the canonical risk policy without producing risk-domain
 * events. The access decision sink still records the final authorization result.
 * This keeps the web surface fail-closed without granting it runtime.outbox.
 */
export class WebRiskCheckAdapter implements RiskGate {
  private readonly engine = new RiskEngine();

  constructor(private readonly pool: DatabasePool) {}

  async evaluate(input: Parameters<RiskGate['evaluate']>[0]): Promise<RiskAssessment> {
    const client = await this.pool.connect();
    try {
      await client.query('begin read only');
      await applyApiDatabaseContext(client, {
        tenant: input.scope.tenant ?? '',
        membership: input.actor.membership,
        scope: input.scope.id,
        actor: input.actor.id,
        trace: input.trace,
      });
      const hierarchy = await client.query<{ id: string }>(
        'select id from access.business_membership_ancestor_scopes($1)', [input.actor.membership],
      );
      const scopes = Object.freeze([...new Set([
        ...input.scope.path.map(({ id }) => id),
        ...hierarchy.rows.map(({ id }) => id),
        input.scope.id,
      ])]);
      const records = await client.query<PolicyRow>(`select policy.id,policy.active_version "activeVersion",
        active.rule "activeRule",active.rollout_percent "activeRollout",policy.baseline_version "baselineVersion",baseline.rule "baselineRule"
        from risk.policy policy join risk.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
        left join risk.policyversion baseline on baseline.policy_id=policy.id and baseline.version=policy.baseline_version
        where policy.scope_id=any($1::text[]) and policy.status='active'
        order by array_position($1::text[],policy.scope_id) desc,policy.id`, [scopes]);
      if (records.rows.length === 0) {
        await client.query('commit');
        return Object.freeze({ outcome: 'allow', safeReason: 'policy', decision: null });
      }
      const [storedSignals, blocked] = await Promise.all([
        client.query<{ type: string; amount: number; observed_at: string }>(`select type,
          coalesce((value->>'value')::float8,0) amount,observed_at from risk.signal where actor_id=$1 and scope_id=any($2::text[])
          and observed_at>=clock_timestamp()-interval '24 hours' and (expires_at is null or expires_at>clock_timestamp())
          order by observed_at desc limit 500`, [input.actor.id, scopes]),
        client.query<{ blocked: boolean }>(`select exists(select 1 from risk.listentry where scope_id=any($1::text[])
          and list_type='block' and token=$2 and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())) blocked`,
        [scopes, createHash('sha256').update(input.actor.id).digest('hex')]),
      ]);
      const policies = records.rows.map((record) => {
        const active = new RiskPolicy(record.id, record.activeVersion, record.activeRule, record.activeRollout);
        return active.selected(input.actor.id) || record.baselineVersion === null || record.baselineRule === null
          ? active
          : new RiskPolicy(record.id, record.baselineVersion, record.baselineRule, 100);
      });
      const windows = [...new Set(policies.map((policy) => policy.rule.velocity?.windowSeconds ?? 3600))];
      const velocityRows = await client.query<{ seconds: number; count: number }>(`select period.seconds,count(decision.id)::integer count
        from unnest($4::integer[]) period(seconds) left join access.decisionaudit decision on decision.actor_id=$1 and decision.operation=$2
          and decision.scope_id=any($3::text[]) and decision.decided_at>=clock_timestamp()-make_interval(secs=>period.seconds)
        group by period.seconds`, [input.actor.id, input.operation, scopes, windows]);
      const velocities = new Map(velocityRows.rows.map(({ seconds, count }) => [seconds, count]));
      const signals = Object.freeze([
        ...storedSignals.rows.map((item) => signal(item.type, item.amount, item.observed_at)),
        ...Object.entries(input.signals ?? {}).map(([type, value]) => signal(type, value, new Date().toISOString())),
      ]);
      let selected: Readonly<{ outcome: RiskOutcome; score: number; reason: RiskAssessment['safeReason'] }> | null = null;
      for (const policy of policies) {
        const result = this.engine.evaluate(policy.rule, {
          actor: input.actor.id,
          operation: input.operation,
          amountMinor: input.amountMinor ?? null,
          velocity: (velocities.get(policy.rule.velocity?.windowSeconds ?? 3600) ?? 0) + 1,
          blocked: blocked.rows[0]?.blocked === true,
          signals,
        });
        if (!selected || OUTCOME_SEVERITY[result.outcome] > OUTCOME_SEVERITY[selected.outcome]) selected = result;
      }
      await client.query('commit');
      return Object.freeze({
        outcome: selected?.outcome ?? 'allow',
        safeReason: selected?.reason ?? 'policy',
        decision: null,
      });
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}
