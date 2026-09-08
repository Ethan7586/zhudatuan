import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { OUTCOME_SEVERITY, type RiskDecisionDraft } from '../../domain/model/Decision';
import { RiskPolicy } from '../../domain/model/RiskPolicy';
import { RiskEngine } from '../../domain/policy/RiskEngine';
import { Deadline } from '@shop/kernel';
import { allParallel } from '@shop/kernel';
import type { RiskAssessment, RiskCheck, RiskCheckInput, RiskPolicyRecord, RiskRepository } from '../port/RiskCheck';

const FAIL_CLOSED = new Set<string>(RUNTIME_LIMITS.risk.failClosed);

export class EvaluateRisk implements RiskCheck {
  private readonly engine = new RiskEngine();

  constructor(private readonly repository: RiskRepository) {}

  async check(input: RiskCheckInput): Promise<RiskAssessment> {
    const expiresAt = input.mode === 'sync' ? Math.min(input.deadline, Date.now() + RUNTIME_LIMITS.risk.syncDeadlineMilliseconds) : input.deadline;
    const deadline = Deadline.at(expiresAt, input.signal);
    try {
      const records = await deadline.run(() => this.repository.policies(input.scopes));
      if (records.length === 0) return allow();
      const policies = this.select(records, input.actor);
      if (input.mode === 'sync' && policies.some((policy) => policy.complex(RUNTIME_LIMITS.risk.complexScoreRules))) {
        await deadline.run(() => this.repository.defer(input));
        return fallback(input, 'dependency');
      }
      const [storedSignals, blocked] = await allParallel([() => this.repository.signals(input.actor, input.scopes), () => this.repository.blocked(input.actor, input.scopes)] as const, { concurrency: 2, expiresAt, signal: deadline.signal });
      const signals = Object.freeze([...storedSignals, ...input.signals]);
      const windows = Object.freeze([...new Set(policies.map((policy) => policy.rule.velocity?.windowSeconds ?? 3600))]);
      const velocities = await deadline.run(() => this.repository.velocities(input.actor, input.operation, input.scopes, windows));
      let selected: Readonly<{ draft: RiskDecisionDraft; velocity: number }> | null = null;
      for (const policy of policies) {
        deadline.throwIfExpired();
        const velocity = velocities.get(policy.rule.velocity?.windowSeconds ?? 3600) ?? 0;
        const draft = this.engine.evaluate(policy, {
          actor: input.actor,
          operation: input.operation,
          resource: input.resource,
          amountMinor: input.amountMinor,
          velocity,
          blocked,
          signals,
        });
        if (!selected || OUTCOME_SEVERITY[draft.outcome] > OUTCOME_SEVERITY[selected.draft.outcome]) selected = Object.freeze({ draft, velocity });
      }
      if (!selected) return allow();
      const id = await deadline.run(() => this.repository.decision({ check: input, draft: selected.draft, scopeChain: input.scopes }));
      return Object.freeze({ outcome: selected.draft.outcome, safeReason: selected.draft.safeReason, decision: id });
    } catch (cause) {
      return fallback(input, timeout(cause) ? 'timeout' : 'dependency');
    } finally {
      deadline.dispose();
    }
  }

  private select(records: readonly RiskPolicyRecord[], actor: string): readonly RiskPolicy[] {
    return Object.freeze(
      records.map((record) => {
        const active = new RiskPolicy(record.id, record.activeVersion, record.activeRule, record.activeRollout);
        return active.selected(actor) || record.baselineVersion === null || record.baselineRule === null ? active : new RiskPolicy(record.id, record.baselineVersion, record.baselineRule, 100);
      })
    );
  }
}

function allow(): RiskAssessment {
  return Object.freeze({ outcome: 'allow', safeReason: 'policy', decision: null });
}

function fallback(input: RiskCheckInput, reason: 'timeout' | 'dependency'): RiskAssessment {
  return Object.freeze({ outcome: FAIL_CLOSED.has(input.risk) ? 'deny' : 'allow', safeReason: reason, decision: null });
}

function timeout(cause: unknown): boolean {
  return cause instanceof Error && (cause.message === 'DEADLINE_EXCEEDED' || cause.message === 'REQUEST_ABORTED');
}
